/**
 * @jest-environment node
 */
jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: any, init?: any) => ({
      status: init?.status ?? 200,
      headers: new Headers(init?.headers),
      json: async () => data,
    }),
  },
}))
jest.mock('../services/agencyLoader', () => ({ loadAgency: jest.fn() }))
jest.mock('../services/dataService', () => ({ dataService: {} }))

import { POST } from '../../app/api/data/agency-players/route'
import { loadAgency } from '../services/agencyLoader'

const mockLoadAgency = loadAgency as jest.Mock
const post = (body: unknown, ip = '203.0.113.7') =>
  POST({ json: async () => body, headers: new Headers({ 'x-real-ip': ip }) } as any) as Promise<any>

describe('POST /api/data/agency-players', () => {
  beforeEach(() => mockLoadAgency.mockReset())

  it('loads the wallet for the visitor, without keeping their IP address', async () => {
    mockLoadAgency.mockResolvedValue({ status: 'loaded', players: [{ id: 1 }], source: 'mfl' })

    const response = await post({ walletAddress: ' EDECDE2008028486 ' })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual([{ id: 1 }])
    const [address, visitor] = mockLoadAgency.mock.calls[0]
    expect(address).toBe('0xedecde2008028486')
    expect(visitor).toMatch(/^[0-9a-f]{16}$/)
    expect(visitor).not.toContain('203')
  })

  it('turns away anything that isn\'t a wallet address', async () => {
    const response = await post({ walletAddress: 'not a wallet' })

    expect(response.status).toBe(400)
    expect(mockLoadAgency).not.toHaveBeenCalled()
  })

  it('says how long to wait when the lookups are used up', async () => {
    mockLoadAgency.mockResolvedValue({ status: 'limited', retryAfter: 300 })

    const response = await post({ walletAddress: '0xedecde2008028486' })

    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('300')
    expect(await response.json()).toEqual({ error: 'Too many wallet lookups right now. Try again in 5 minutes.', retryAfter: 300 })
  })

  it('reports a failed load without the internal error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    mockLoadAgency.mockRejectedValue(new Error('SQLITE_BUSY: database is locked'))

    const response = await post({ walletAddress: '0xedecde2008028486' })

    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({ error: "Couldn't load this wallet's players from MFL. Please try again." })
  })
})
