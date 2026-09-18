import { attributeTotal, buildDailySeries, getDayStart, getProgressionEvents, sumEvents } from '../utils/progressionCounts'
import { CACHE_MAX_AGE_MS, isRecentlySynced, normalizeTotals, totalsEqual } from '../services/playerProgressionCache'
import type { PlayerExperienceEntry } from '../types/playerExperience'

const utc = (iso: string) => Date.parse(`${iso}Z`)

// Shaped like a real MFL history: a full INITIAL entry, then only the stats that changed
const history: PlayerExperienceEntry[] = [
  { date: utc('2025-03-03T10:00:00'), values: { age: 21, overall: 86, pace: 79, dribbling: 82, passing: 91, shooting: 81, defense: 84, physical: 84, goalkeeping: 0 } },
  { date: utc('2025-03-10T09:00:00'), values: { age: 22 } },
  { date: utc('2025-03-12T09:00:00'), values: { dribbling: 83 } },
  { date: utc('2025-03-16T23:59:00'), values: { overall: 87, dribbling: 84 } },
  { date: utc('2025-03-17T00:00:00'), values: { pace: 81 } }
]

describe('getProgressionEvents', () => {
  test('counts stat gains and ignores the starting values and age changes', () => {
    expect(getProgressionEvents(history)).toEqual([
      { date: utc('2025-03-12T09:00:00'), stat: 'dribbling', points: 1 },
      { date: utc('2025-03-16T23:59:00'), stat: 'overall', points: 1 },
      { date: utc('2025-03-16T23:59:00'), stat: 'dribbling', points: 1 },
      { date: utc('2025-03-17T00:00:00'), stat: 'pace', points: 2 }
    ])
  })

  test('does not depend on the order entries arrive in', () => {
    expect(getProgressionEvents([...history].reverse())).toEqual(getProgressionEvents(history))
  })

  test('does not count a stat going down as a progression', () => {
    const events = getProgressionEvents([
      { date: 1, values: { pace: 80 } },
      { date: 2, values: { pace: 79 } },
      { date: 3, values: { pace: 80 } }
    ])
    expect(events).toEqual([{ date: 3, stat: 'pace', points: 1 }])
  })
})

describe('totals', () => {
  test('the attribute total excludes overall', () => {
    const totals = sumEvents(getProgressionEvents(history))
    expect(totals).toEqual({ dribbling: 2, overall: 1, pace: 2 })
    expect(attributeTotal(totals)).toBe(4)
  })
})

describe('daily buckets', () => {
  // Days follow the viewer's clock, so these dates are built in local time
  const local = (month: number, day: number, hour = 12) => new Date(2025, month - 1, day, hour).getTime()
  const gain = (date: number, stat: 'pace' | 'overall' | 'shooting', points = 1) => ({ date, stat, points })

  test('a day runs from midnight to midnight', () => {
    expect(getDayStart(local(3, 16, 23))).toBe(local(3, 16, 0))
    expect(getDayStart(local(3, 17, 0))).toBe(local(3, 17, 0))
  })

  test('covers exactly the requested days, ending today, and keeps empty days', () => {
    const days = buildDailySeries([], 90, local(6, 10, 15))

    expect(days).toHaveLength(90)
    expect(days[89].dayStart).toBe(local(6, 10, 0))
    expect(days[0].dayStart).toBe(local(3, 13, 0)) // 89 days before today
    expect(days.every(day => day.total === 0)).toBe(true)
  })

  test('buckets by day, leaves overall out of the total, and ignores anything outside the window', () => {
    const days = buildDailySeries(
      [
        gain(local(6, 10, 1), 'pace'),
        gain(local(6, 10, 23), 'shooting', 2),
        gain(local(6, 10, 9), 'overall'),
        gain(local(6, 9, 23), 'pace'),
        gain(local(6, 7, 12), 'pace') // Before a 3-day window
      ],
      3,
      local(6, 10, 15)
    )

    expect(days.map(day => day.total)).toEqual([0, 1, 3])
    expect(days[2]).toMatchObject({ pace: 1, shooting: 2, overall: 1 })
  })

  test('every day is a calendar day, even across a daylight-saving change', () => {
    const days = buildDailySeries([], 400, local(12, 31))
    const calendarDays = days.map(day => new Date(day.dayStart))

    expect(calendarDays.every(date => date.getHours() === 0)).toBe(true)
    expect(new Set(calendarDays.map(date => date.toDateString())).size).toBe(400)
  })
})

describe('progression cache freshness', () => {
  const now = utc('2025-06-10T12:00:00')

  test('a history is trusted for a day, then re-checked', () => {
    expect(isRecentlySynced(new Date(now - CACHE_MAX_AGE_MS + 1000).toISOString(), now)).toBe(true)
    expect(isRecentlySynced(new Date(now - CACHE_MAX_AGE_MS - 1000).toISOString(), now)).toBe(false)
    expect(isRecentlySynced(null, now)).toBe(false)
    expect(isRecentlySynced('not a date', now)).toBe(false)
  })

  test('MFL totals are compared on progressed stats only', () => {
    expect(normalizeTotals({ overall: 4, pace: 1, shooting: 0, somethingElse: 9 })).toEqual({ overall: 4, pace: 1 })
    expect(normalizeTotals(null)).toEqual({})
    expect(normalizeTotals({})).toEqual({})

    expect(totalsEqual({ pace: 1 }, { pace: 1, shooting: 0 })).toBe(true)
    expect(totalsEqual({ pace: 1 }, { pace: 2 })).toBe(false)
    expect(totalsEqual({}, { overall: 1 })).toBe(false)
  })
})
