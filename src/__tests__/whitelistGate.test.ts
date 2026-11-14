/**
 * @jest-environment node
 */
import { sessionValue } from '../lib/session'
import { whitelistDenial } from '../lib/whitelistGate'
import { GET as listings } from '../../app/api/listings/route'
import { GET as played } from '../../app/api/scout/played/route'
import { NextRequest } from 'next/server'

jest.mock('../services/playerProgressionCache', () => ({
  MflRateLimitError: class extends Error {},
  fetchMfl: jest.fn().mockResolvedValue([]),
}))

const OWNER = '0x95dc70d7d39f6f76'
const STRANGER = '0x1234567890abcdef'

const requestAs = (url: string, wallet?: string) =>
  new NextRequest(url, wallet ? { headers: { cookie: `mfldata_session=${sessionValue(wallet)}` } } : undefined)

describe('whitelisted-only APIs', () => {
  const env = { ...process.env }
  beforeEach(() => {
    process.env = { ...env, SESSION_SECRET: 'test-secret' }
    delete process.env.AI_WHITELIST
  })
  afterAll(() => {
    process.env = env
  })

  it('needs a verified wallet on the whitelist', () => {
    expect(whitelistDenial(requestAs('http://x/'))?.status).toBe(401)
    expect(whitelistDenial(requestAs('http://x/', STRANGER))?.status).toBe(403)
    expect(whitelistDenial(requestAs('http://x/', OWNER))).toBeNull()
  })

  it('keeps marketplace scouting to the whitelist', async () => {
    expect((await listings(requestAs('http://x/api/listings?limit=10'))).status).toBe(401)
    expect((await listings(requestAs('http://x/api/listings?limit=10', STRANGER))).status).toBe(403)
    expect((await listings(requestAs('http://x/api/listings?limit=10', OWNER))).status).toBe(200)
    expect((await played(requestAs('http://x/api/scout/played?ids=1', STRANGER))).status).toBe(403)
  })
})
