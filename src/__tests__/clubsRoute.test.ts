/**
 * @jest-environment node
 */
jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: any, init?: any) => ({ status: init?.status ?? 200, json: async () => data }),
  },
}))

import { GET } from '../../app/api/clubs/route'

describe('GET /api/clubs', () => {
  const realFetch = global.fetch
  const token = process.env.MFL_API_TOKEN
  beforeEach(() => {
    process.env.MFL_API_TOKEN = 'test-token'
  })
  afterEach(() => {
    global.fetch = realFetch
    process.env.MFL_API_TOKEN = token
  })

  it("leaves out the wallet's Arena mode clubs", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { id: 28, name: 'DogeSports Japan', division: 4 },
        { id: 5001987, name: 'DogeSports', type: 'ARENA', offChain: true, division: null },
      ],
    }) as any

    const response: any = await GET({ url: 'http://localhost/api/clubs?walletAddress=0x95dc70d7d39f6f76' } as any)
    const body = await response.json()

    expect(body.success).toBe(true)
    expect(body.data.map((item: any) => item.club.id)).toEqual([28])
  })
})
