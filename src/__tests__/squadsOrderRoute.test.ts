/**
 * @jest-environment node
 */
// The squads API runs on the server, so it is tested in Node, on an in-memory database
jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: any, init?: any) => ({ status: init?.status ?? 200, json: async () => data }),
  },
}))

describe('putting saved squads in order', () => {
  let squadsRoute: typeof import('../../app/api/squads/route')
  let orderRoute: typeof import('../../app/api/squads/order/route')

  beforeEach(() => {
    // A new in-memory database each test
    jest.resetModules()
    process.env.TURSO_DATABASE_URL = ':memory:'
    squadsRoute = require('../../app/api/squads/route')
    orderRoute = require('../../app/api/squads/order/route')
  })

  const save = async (walletAddress: string, squadName: string) => {
    const response: any = await squadsRoute.POST({
      json: async () => ({ walletAddress, squadName, formationId: '4-4-2', players: { lineups: [], players: {} } }),
    } as any)
    return (await response.json()).squad
  }
  const list = async (walletAddress: string) => {
    const response: any = await squadsRoute.GET({ url: `http://localhost/api/squads?walletAddress=${walletAddress}` } as any)
    return (await response.json()).squads as { id: string; squad_name: string; sort_order: number | null }[]
  }
  const names = async (walletAddress: string) => (await list(walletAddress)).map(squad => squad.squad_name)
  const putOrder = (body: unknown) => orderRoute.PUT({ json: async () => body } as any) as Promise<any>

  it('lists squads in the order they were put in, with any saved since first', async () => {
    const [a, b, c] = [await save('0x1', 'A'), await save('0x1', 'B'), await save('0x1', 'C')]

    const response = await putOrder({ walletAddress: '0x1', squadIds: [c.id, a.id, b.id] })
    expect(response.status).toBe(200)
    expect(await names('0x1')).toEqual(['C', 'A', 'B'])

    await save('0x1', 'D')
    expect(await names('0x1')).toEqual(['D', 'C', 'A', 'B'])
    // Saving a squad again keeps its place
    await save('0x1', 'A')
    expect(await names('0x1')).toEqual(['D', 'C', 'A', 'B'])
  })

  it("only orders the wallet's own squads", async () => {
    const [a, b] = [await save('0x1', 'A'), await save('0x1', 'B')]
    await putOrder({ walletAddress: '0x1', squadIds: [b.id, a.id] })
    const other = await save('0x2', 'Other')

    await putOrder({ walletAddress: '0x2', squadIds: [a.id, other.id, b.id] })

    expect((await list('0x1')).map(squad => [squad.squad_name, squad.sort_order])).toEqual([['B', 0], ['A', 1]])
    expect((await list('0x2')).map(squad => [squad.squad_name, squad.sort_order])).toEqual([['Other', 1]])
  })

  it('turns away a request without the squads in order', async () => {
    expect((await putOrder({ walletAddress: '0x1' })).status).toBe(400)
    expect((await putOrder({ walletAddress: '0x1', squadIds: [] })).status).toBe(400)
    expect((await putOrder({ walletAddress: '0x1', squadIds: [1, 2] })).status).toBe(400)
    expect((await putOrder({ walletAddress: '0x1', squadIds: Array.from({ length: 201 }, (_, i) => String(i)) })).status).toBe(400)
    expect((await putOrder({ squadIds: ['a'] })).status).toBe(400)
  })

  it('gives squads saved before they had an order a place for one', async () => {
    const { getDb } = require('../lib/database')
    // The table as it was before sort_order
    await getDb().execute(`CREATE TABLE squads (
      id TEXT PRIMARY KEY, wallet_address TEXT NOT NULL, squad_name TEXT NOT NULL, formation_id TEXT NOT NULL, players TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')), UNIQUE(wallet_address, squad_name))`)
    await getDb().execute(`INSERT INTO squads (id, wallet_address, squad_name, formation_id, players) VALUES ('old', '0x1', 'Old', '4-4-2', '{}')`)

    expect(await list('0x1')).toEqual([expect.objectContaining({ id: 'old', squad_name: 'Old', sort_order: null })])
    const newer = await save('0x1', 'New')
    await putOrder({ walletAddress: '0x1', squadIds: ['old', newer.id] })
    expect(await names('0x1')).toEqual(['Old', 'New'])
  })
})
