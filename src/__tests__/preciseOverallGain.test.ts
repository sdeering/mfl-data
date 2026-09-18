import { getOverallPointsEvents, getOverallPointsSince } from '../utils/preciseOverallGain'
import { calculatePreciseOverallRating } from '../utils/overallRatingCalculator'
import { buildDailySeries, getWindowStart } from '../utils/progressionCounts'
import type { MFLPlayer } from '../types/mflApi'
import type { PlayerExperienceEntry } from '../types/playerExperience'

// "Overall points" is the rise in a player's precise overall: the 2-decimal overall on the player page

const START = { pace: 70, shooting: 72, passing: 65, dribbling: 71, defense: 40, physical: 68, goalkeeping: 0 }
const day = (n: number, hour = 12) => new Date(2025, 5, n, hour).getTime()

const history: PlayerExperienceEntry[] = [
  { date: day(1), values: { age: 21, overall: 70, ...START } },
  { date: day(3), values: { age: 22 } },
  { date: day(5), values: { shooting: 73 } },
  { date: day(9), values: { overall: 71, shooting: 74, pace: 71 } },
  { date: day(12), values: { defense: 41 } }
]

const striker = { id: 1, metadata: { ...START, shooting: 74, pace: 71, defense: 41, positions: ['ST'] } } as unknown as MFLPlayer
const precise = (attributes: typeof START, positions = ['ST']) => calculatePreciseOverallRating({ ...attributes, positions })
const sum = (events: { points: number }[]) => events.reduce((total, event) => total + event.points, 0)

describe('getOverallPointsEvents', () => {
  test('the gains add up to the precise overall now minus the precise overall at the start', () => {
    const events = getOverallPointsEvents(striker, history)

    const before = precise(START)
    const after = precise({ ...START, shooting: 74, pace: 71, defense: 41 })
    expect(after).toBeGreaterThan(before)
    expect(sum(events)).toBeCloseTo(after - before, 10)
  })

  test('counts only the gains inside a period', () => {
    const events = getOverallPointsEvents(striker, history)
    const sinceDay8 = events.filter(event => event.date >= day(8))

    const atDay8 = precise({ ...START, shooting: 73 })
    const now = precise({ ...START, shooting: 74, pace: 71, defense: 41 })
    expect(sum(sinceDay8)).toBeCloseTo(now - atDay8, 10)
  })

  test('dates each gain, and only attributes that count for the position add anything', () => {
    const events = getOverallPointsEvents(striker, history)

    // Day 1 only sets the starting attributes and day 3 is a birthday. Day 12 raises defense, which
    // carries no weight for a striker.
    expect(events.map(event => event.date)).toEqual([day(5), day(9)])
    expect(events[0].points).toBeCloseTo(0.46, 10) // Shooting +1
    expect(events[1].points).toBeCloseTo(0.56, 10) // Shooting +1 and pace +1
  })

  test('weights attributes for the primary position: shooting moves a striker more than a centre back', () => {
    const shootingOnly: PlayerExperienceEntry[] = [
      { date: day(1), values: { ...START } },
      { date: day(5), values: { shooting: 75 } }
    ]
    const centreBack = { ...striker, metadata: { ...striker.metadata, positions: ['CB'] } } as unknown as MFLPlayer

    expect(sum(getOverallPointsEvents(striker, shootingOnly))).toBeGreaterThan(sum(getOverallPointsEvents(centreBack, shootingOnly)))
  })

  test('a player with no history has gained nothing', () => {
    expect(getOverallPointsEvents(striker, [])).toEqual([])
  })
})

describe('getOverallPointsSince', () => {
  test('adds up the gains since a date, measured against the value the player had before it', () => {
    expect(getOverallPointsSince(striker, history, 0)).toBe(1.02) // Shooting +1 (0.46), then shooting +1 and pace +1 (0.56)
    expect(getOverallPointsSince(striker, history, day(8))).toBe(0.56)
    expect(getOverallPointsSince(striker, history, day(10))).toBe(0) // Only defense rose, which adds nothing for a striker
  })

  test('a player with no history has gained nothing', () => {
    expect(getOverallPointsSince(striker, [], day(1))).toBe(0)
  })
})

describe('getWindowStart', () => {
  test('is midnight on the first of the days the daily series covers', () => {
    const now = day(30, 15)
    expect(getWindowStart(90, now)).toBe(buildDailySeries([], 90, now)[0].dayStart)
    expect(getWindowStart(1, now)).toBe(day(30, 0))
  })
})

describe('daily overall points', () => {
  test('are bucketed by day and rounded to the 2 places the page shows', () => {
    const days = buildDailySeries([], 3, day(10, 15), [
      { date: day(10, 1), points: 0.1 },
      { date: day(10, 23), points: 0.2 },
      { date: day(9, 9), points: 0.456 },
      { date: day(1), points: 5 } // Outside the window
    ])

    expect(days.map(d => d.overallPoints)).toEqual([0, 0.46, 0.3])
  })
})
