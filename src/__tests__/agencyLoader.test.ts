/**
 * @jest-environment node
 */
// Server-side code: it runs in Node (not a browser), so it is tested there too, on an in-memory database

jest.mock('../config/mflApi', () => ({
  MFL_API_BASE_URL: 'https://mfl.test',
  getMflAuthHeaders: () => ({ 'X-MFL-Api-Token': 'test' }),
}))

const SECOND = 1000
const HOUR = 60 * 60 * SECOND
// The start of a 10 minute window, so a test's loads all fall in the same visitor window
const START = Math.floor(Date.parse('2026-10-25T12:00:00Z') / (10 * 60 * SECOND)) * 10 * 60 * SECOND

const WALLET = '0xedecde2008028486'
const wallet = (n: number) => `0x${String(n).padStart(16, '0')}`
const player = (id: number) => ({ id, metadata: { firstName: 'Player', lastName: String(id), overall: 70 } })
const players = (...ids: number[]) => ids.map(player)
const json = (body: unknown) => ({ ok: true, status: 200, statusText: 'OK', headers: new Headers(), json: async () => body })
const tooManyRequests = { ok: false, status: 429, statusText: 'Too Many Requests', headers: new Headers({ 'retry-after': '300' }) }

describe('loading a viewed wallet from MFL', () => {
  let loader: typeof import('../services/agencyLoader')
  let rateLimit: typeof import('../lib/rateLimit')
  let fetchMock: jest.Mock

  const mflCalls = () => fetchMock.mock.calls.map(([url]) => String(url).replace('https://mfl.test', ''))
  const ids = (result: Awaited<ReturnType<typeof loader.loadAgency>>) =>
    result.status === 'loaded' ? result.players.map(p => p.id).sort((a, b) => a - b) : result

  beforeEach(() => {
    // A new in-memory database each test, and no MFL block left over from the last one
    jest.resetModules()
    process.env.TURSO_DATABASE_URL = ':memory:'
    fetchMock = jest.fn()
    global.fetch = fetchMock as any
    loader = require('../services/agencyLoader')
    rateLimit = require('../lib/rateLimit')
  })

  it('loads a wallet nobody has stored, then shows the stored players for a day', async () => {
    fetchMock.mockResolvedValueOnce(json(players(3, 2, 1)))

    const first = await loader.loadAgency(WALLET, 'visitor', START)
    expect(first).toMatchObject({ status: 'loaded', source: 'mfl' })
    expect(ids(first)).toEqual([1, 2, 3])
    expect(mflCalls()).toEqual([`/players?ownerWalletAddress=${WALLET}&limit=1500`])

    const later = await loader.loadAgency(WALLET, 'someone else', START + 23 * HOUR)
    expect(later).toMatchObject({ status: 'loaded', source: 'stored' })
    expect(ids(later)).toEqual([1, 2, 3])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('pages through an agency bigger than one MFL response', async () => {
    const full = Array.from({ length: 1500 }, (_, i) => player(3000 - i))
    fetchMock.mockResolvedValueOnce(json(full)).mockResolvedValueOnce(json(players(1500, 1499)))

    const result = await loader.loadAgency(WALLET, 'visitor', START)

    expect(result.status === 'loaded' && result.players).toHaveLength(1502)
    expect(mflCalls()[1]).toBe(`/players?ownerWalletAddress=${WALLET}&limit=1500&beforePlayerId=1501`)
  })

  it('asks MFL again once the stored players are a day old, dropping any sold since', async () => {
    fetchMock.mockResolvedValueOnce(json(players(3, 2, 1))).mockResolvedValueOnce(json(players(4, 3)))
    await loader.loadAgency(WALLET, 'visitor', START)

    const refreshed = await loader.loadAgency(WALLET, 'visitor', START + 25 * HOUR)
    expect(refreshed).toMatchObject({ source: 'mfl' })
    expect(ids(refreshed)).toEqual([3, 4])
    expect(ids(await loader.loadAgency(WALLET, 'visitor', START + 26 * HOUR))).toEqual([3, 4])
  })

  it('lets one visitor load 10 new wallets every 10 minutes', async () => {
    fetchMock.mockImplementation(async () => json(players(1)))
    // Spaced out so the whole site's limits don't come into it
    for (let n = 1; n <= 10; n++) {
      expect(await loader.loadAgency(wallet(n), 'busy', START + n * 11 * SECOND)).toMatchObject({ status: 'loaded' })
    }

    const eleventh = await loader.loadAgency(wallet(11), 'busy', START + 121 * SECOND)
    expect(eleventh).toEqual({ status: 'limited', retryAfter: 600 - 121 })
    expect(fetchMock).toHaveBeenCalledTimes(10)
    expect(await loader.loadAgency(wallet(11), 'another visitor', START + 121 * SECOND)).toMatchObject({ status: 'loaded' })
  })

  it('keeps the whole site to 5 new wallets every 10 seconds, without charging the visitors turned away', async () => {
    fetchMock.mockImplementation(async () => json(players(1)))
    for (let n = 1; n <= 5; n++) {
      expect(await loader.loadAgency(wallet(n), `visitor ${n}`, START + 2 * SECOND)).toMatchObject({ status: 'loaded' })
    }

    expect(await loader.loadAgency(wallet(6), 'visitor 6', START + 2 * SECOND)).toEqual({ status: 'limited', retryAfter: 8 })
    expect(fetchMock).toHaveBeenCalledTimes(5)

    expect(await loader.loadAgency(wallet(6), 'visitor 6', START + 10 * SECOND)).toMatchObject({ status: 'loaded' })
    const { executeRaw } = require('../lib/db-helpers')
    const { data } = await executeRaw('SELECT count FROM rate_limits WHERE key = ?', ['mfl-wallets:visitor 6'])
    expect(data).toEqual([{ count: 1 }])
  })

  it('stops every server instance asking MFL while it says to back off', async () => {
    fetchMock.mockResolvedValueOnce(tooManyRequests)

    expect(await loader.loadAgency(WALLET, 'visitor', START)).toEqual({ status: 'limited', retryAfter: 300 })
    // Kept in the database, which every instance reads
    expect(await rateLimit.blockedFor('mfl', START + 60 * SECOND)).toBe(240)

    expect(await loader.loadAgency(wallet(2), 'visitor', START + 60 * SECOND)).toEqual({ status: 'limited', retryAfter: 240 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("shows the stored players when MFL can't be asked", async () => {
    fetchMock.mockResolvedValueOnce(json(players(2, 1))).mockResolvedValueOnce(tooManyRequests)
    await loader.loadAgency(WALLET, 'visitor', START)

    const result = await loader.loadAgency(WALLET, 'visitor', START + 25 * HOUR)
    expect(result).toMatchObject({ status: 'loaded', source: 'stored' })
    expect(ids(result)).toEqual([1, 2])
  })
})

describe('describeWait', () => {
  it('says seconds under a minute, then minutes', () => {
    const { describeWait } = require('../lib/rateLimit')
    expect(describeWait(1)).toBe('1 second')
    expect(describeWait(8)).toBe('8 seconds')
    expect(describeWait(60)).toBe('1 minute')
    expect(describeWait(300)).toBe('5 minutes')
    expect(describeWait(479)).toBe('8 minutes')
  })
})
