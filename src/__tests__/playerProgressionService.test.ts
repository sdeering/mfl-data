import { loadProgressionHistories, type ProgressionLoadProgress } from '../services/playerProgressionService'

// These tests cover how the page loads histories: cached ones first, then the out-of-date players
// in small batches - and that it stops asking as soon as MFL starts rate limiting.

const history = [{ date: 1, values: { pace: 70 } }]
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body })
const ids = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i)
const historiesFor = (playerIds: number[]) => Object.fromEntries(playerIds.map(id => [id, history]))

describe('loadProgressionHistories', () => {
  let fetchMock: jest.Mock
  let updates: ProgressionLoadProgress[]

  const requests = () => fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body))
  const last = () => updates[updates.length - 1]

  beforeEach(() => {
    fetchMock = jest.fn()
    ;(global as any).fetch = fetchMock
    updates = []
  })

  test('with everything cached it makes a single request', async () => {
    fetchMock.mockResolvedValueOnce(ok({ histories: historiesFor([1, 2]), staleIds: [] }))

    await loadProgressionHistories([1, 2], update => updates.push(update))

    expect(requests()).toEqual([{ action: 'check', playerIds: [1, 2] }])
    expect(last()).toMatchObject({ histories: historiesFor([1, 2]), toRefresh: 0, done: true })
  })

  test('refreshes out-of-date players in batches of 10, reporting progress after each', async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ histories: {}, staleIds: ids(1, 25) }))
      .mockResolvedValueOnce(ok({ histories: historiesFor(ids(1, 10)), errors: {} }))
      .mockResolvedValueOnce(ok({ histories: historiesFor(ids(11, 20)), errors: {} }))
      .mockResolvedValueOnce(ok({ histories: historiesFor(ids(21, 25)), errors: {} }))

    await loadProgressionHistories(ids(1, 25), update => updates.push(update))

    expect(requests().slice(1).map(request => request.playerIds.length)).toEqual([10, 10, 5])
    expect(updates.map(update => [update.refreshed, update.done])).toEqual([[0, false], [10, false], [20, false], [25, true]])
    expect(Object.keys(last().histories)).toHaveLength(25)
  })

  test('stops asking as soon as MFL starts rate limiting, keeping what it has', async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ histories: {}, staleIds: ids(1, 30) }))
      .mockResolvedValueOnce(ok({ histories: historiesFor(ids(1, 10)), errors: {} }))
      .mockResolvedValueOnce(ok({ histories: historiesFor(ids(11, 13)), errors: {}, rateLimited: { retryAfterSeconds: 540 } }))

    await loadProgressionHistories(ids(1, 30), update => updates.push(update))

    expect(fetchMock).toHaveBeenCalledTimes(3) // The third batch is never requested
    expect(last()).toMatchObject({ refreshed: 13, toRefresh: 30, done: true, rateLimitedSeconds: 540 })
    expect(Object.keys(last().histories)).toHaveLength(13)
  })

  test('a rate-limited check shows cached histories and refreshes nothing', async () => {
    fetchMock.mockResolvedValueOnce(ok({ histories: historiesFor([1]), staleIds: [], rateLimited: { retryAfterSeconds: 300 } }))

    await loadProgressionHistories([1, 2], update => updates.push(update))

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(last()).toMatchObject({ histories: historiesFor([1]), done: true, rateLimitedSeconds: 300 })
  })

  test('a failed batch is reported without losing the other batches', async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ histories: {}, staleIds: ids(1, 20) }))
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(ok({ histories: historiesFor(ids(11, 20)), errors: { 15: 'MFL API error: 500' } }))

    await loadProgressionHistories(ids(1, 20), update => updates.push(update))

    expect(last().done).toBe(true)
    expect(last().failedIds).toEqual([...ids(1, 10), 15])
    expect(Object.keys(last().histories)).toHaveLength(10)
  })

  test('surfaces a failed check as an error', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: 'Failed to read progression cache' }) })

    await expect(loadProgressionHistories([1], update => updates.push(update))).rejects.toThrow('Failed to read progression cache')
  })
})
