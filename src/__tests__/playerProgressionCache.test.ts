/**
 * @jest-environment node
 */
// Server-side code: it runs in Node (not a browser), so it is tested there too
import type { PlayerExperienceEntry } from '../types/playerExperience'

// These tests pin down how the progression cache decides what to ask MFL for - and that it stops
// asking the moment MFL starts rate limiting.

jest.mock('../lib/db-helpers')
jest.mock('../config/mflApi', () => ({
  MFL_API_BASE_URL: 'https://mfl.test',
  getMflAuthHeaders: () => ({ 'X-MFL-Api-Token': 'test' })
}))

const NOW = Date.parse('2025-06-10T12:00:00Z')
const HOUR = 60 * 60 * 1000

const history: PlayerExperienceEntry[] = [
  { date: 1, values: { overall: 80, pace: 70 } },
  { date: 2, values: { pace: 71 } }
]

const row = (playerId: number, ageMs: number, entries = history, totals: Record<string, number> = { pace: 1 }) => ({
  mfl_player_id: playerId,
  data: { entries, totals },
  last_synced: new Date(NOW - ageMs).toISOString()
})

const json = (body: unknown) => ({ ok: true, status: 200, headers: new Headers(), json: async () => body })
const tooManyRequests = (retryAfter: string) => ({ ok: false, status: 429, statusText: 'Too Many Requests', headers: new Headers({ 'retry-after': retryAfter }) })

describe('player progression cache', () => {
  let cache: typeof import('../services/playerProgressionCache')
  let db: jest.Mocked<typeof import('../lib/db-helpers')>
  let fetchMock: jest.Mock

  const mflCalls = () => fetchMock.mock.calls.map(([url]) => String(url).replace('https://mfl.test', ''))

  beforeEach(() => {
    jest.resetModules() // The module remembers a rate-limit block, so each test starts from a clean one
    jest.useFakeTimers({ now: NOW })
    db = require('../lib/db-helpers')
    db.selectAll.mockResolvedValue({ data: [], error: null })
    db.upsertMany.mockResolvedValue({ data: [], error: null })
    fetchMock = jest.fn()
    ;(global as any).fetch = fetchMock
    cache = require('../services/playerProgressionCache')
  })

  afterEach(() => jest.useRealTimers())

  describe('check', () => {
    test('histories checked within the last day are served without asking MFL', async () => {
      db.selectAll.mockResolvedValue({ data: [row(1, 2 * HOUR), row(2, 23 * HOUR)], error: null })

      const result = await cache.checkProgressionCache([1, 2], NOW)

      expect(result).toEqual({ histories: { 1: history, 2: history }, staleIds: [] })
      expect(fetchMock).not.toHaveBeenCalled()
    })

    test('after a day, only players whose MFL totals changed are marked for refresh', async () => {
      db.selectAll.mockResolvedValue({ data: [row(1, 25 * HOUR), row(2, 25 * HOUR)], error: null })
      fetchMock.mockResolvedValue(json({ 1: { pace: 1 }, 2: { pace: 2 }, 3: {}, 4: { shooting: 1 } }))

      const result = await cache.checkProgressionCache([1, 2, 3, 4], NOW)

      // 1 unchanged, 2 progressed since, 3 has never progressed, 4 is new to the cache
      expect(result.staleIds).toEqual([2, 4])
      expect(result.histories).toEqual({ 1: history, 2: history, 3: [] })
      expect(mflCalls()).toEqual(['/players/progressions?playersIds=1,2,3,4&interval=ALL'])

      // Confirmed players are stamped as checked now, so they are not re-checked for another day
      const written = db.upsertMany.mock.calls[0][1]
      expect(written.map(r => r.mfl_player_id)).toEqual([1, 3])
      expect(written.every(r => r.last_synced === new Date(NOW).toISOString())).toBe(true)
    })

    test('asks MFL for totals in chunks of 50 players', async () => {
      fetchMock.mockResolvedValue(json({}))

      await cache.checkProgressionCache(Array.from({ length: 120 }, (_, i) => i + 1), NOW)

      expect(fetchMock).toHaveBeenCalledTimes(3)
    })

    test('when MFL is rate limiting, serves what is cached instead of failing', async () => {
      db.selectAll.mockResolvedValue({ data: [row(1, 25 * HOUR)], error: null })
      fetchMock.mockResolvedValue(tooManyRequests('564'))

      const result = await cache.checkProgressionCache([1, 2], NOW)

      expect(result).toEqual({ histories: { 1: history }, staleIds: [], rateLimited: { retryAfterSeconds: 564 } })
      expect(db.upsertMany).not.toHaveBeenCalled()
    })
  })

  describe('refresh', () => {
    const refresh = async (ids: number[]) => {
      const pending = cache.refreshProgressionHistories(ids, NOW)
      await jest.runAllTimersAsync() // Skip the pauses between MFL requests
      return pending
    }

    test('fetches each history and stores it with its totals', async () => {
      fetchMock.mockResolvedValue(json(history))

      const result = await refresh([7, 8])

      expect(result).toEqual({ histories: { 7: history, 8: history }, errors: {}, rateLimited: undefined })
      expect(mflCalls().sort()).toEqual(['/players/7/experiences/history', '/players/8/experiences/history'])
      expect(db.upsertMany.mock.calls[0][1]).toEqual([
        expect.objectContaining({ id: '7', mfl_player_id: 7, data: { entries: history, totals: { pace: 1 } } }),
        expect.objectContaining({ id: '8', mfl_player_id: 8, data: { entries: history, totals: { pace: 1 } } })
      ])
    })

    test('one failing player does not stop the others', async () => {
      fetchMock.mockImplementation(async (url: string) =>
        url.includes('/players/7/') ? { ok: false, status: 500, statusText: 'Server Error', headers: new Headers() } : json(history)
      )

      const result = await refresh([7, 8])

      expect(result.histories).toEqual({ 8: history })
      expect(result.errors).toEqual({ 7: 'MFL API error: 500 Server Error' })
    })

    test('stops at the first rate-limit response and keeps what it already fetched', async () => {
      fetchMock
        .mockResolvedValueOnce(json(history))
        .mockResolvedValueOnce(json(history))
        .mockResolvedValue(tooManyRequests('600'))

      const result = await refresh([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])

      expect(result.rateLimited).toEqual({ retryAfterSeconds: 600 })
      expect(Object.keys(result.histories)).toHaveLength(2)
      expect(result.errors).toEqual({})
      // The request that discovers the block is the last one made: the other 7 players are never asked for
      expect(fetchMock).toHaveBeenCalledTimes(3)
      expect(db.upsertMany.mock.calls[0][1]).toHaveLength(2)
    })

    test('does not contact MFL again until the block has passed', async () => {
      fetchMock.mockResolvedValue(tooManyRequests('600'))
      await refresh([1])
      const callsDuringBlock = fetchMock.mock.calls.length

      jest.setSystemTime(NOW + 5 * 60 * 1000)
      const blocked = await cache.checkProgressionCache([1, 2], NOW)
      expect(blocked.rateLimited).toEqual({ retryAfterSeconds: 300 })
      expect(fetchMock.mock.calls.length).toBe(callsDuringBlock)

      jest.setSystemTime(NOW + 11 * 60 * 1000)
      fetchMock.mockResolvedValue(json({}))
      const after = await cache.checkProgressionCache([1, 2], NOW)
      expect(after.rateLimited).toBeUndefined()
      expect(fetchMock.mock.calls.length).toBe(callsDuringBlock + 1)
    })
  })
})
