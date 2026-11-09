const usage = new Map<string, number>()
jest.mock('../lib/rateLimit', () => ({
  usageOf: async ({ key }: { key: string }) => ({ used: usage.get(key) ?? 0, resetsIn: 7200 }),
}))

import { DAILY_ANALYSES, analysisAllowance, analysisLimits, isWhitelisted, walletOf } from '../lib/aiAccess'

const OWNER = '0x95dc70d7d39f6f76'
const STRANGER = '0x1234567890abcdef'

describe('AI analysis access', () => {
  beforeEach(() => {
    usage.clear()
    delete process.env.AI_WHITELIST
  })

  it('whitelists the four named wallets, however they are written', () => {
    for (const wallet of ['0x95dc70d7d39f6f76', '0xedecde2008028486', '0x960e08852ea945d2', '0xf16d5fbca5a5ed4f']) expect(isWhitelisted(walletOf(wallet))).toBe(true)
    expect(isWhitelisted(walletOf(' 0X95DC70D7D39F6F76 '))).toBe(true)
    expect(isWhitelisted(walletOf(STRANGER))).toBe(false)
    expect(isWhitelisted(null)).toBe(false)
    expect(walletOf('not a wallet')).toBeNull()
  })

  it('takes more whitelisted wallets from AI_WHITELIST', () => {
    process.env.AI_WHITELIST = `${STRANGER}, junk`
    expect(isWhitelisted(walletOf(STRANGER))).toBe(true)
  })

  it('caps everyone else by the day, per wallet and per connection, and the site', () => {
    const keys = analysisLimits(STRANGER, 'visitor-1').map(limit => limit.key)
    expect(keys).toEqual([`ai-day:wallet:${STRANGER}`, 'ai-day:visitor:visitor-1', 'ai-analysis:1h', 'ai-day:site'])
    expect(analysisLimits(null, 'visitor-1').map(limit => limit.key)[0]).toBe('ai-day:visitor:visitor-1')
    expect(analysisLimits(STRANGER, 'v')[0].limit).toBe(DAILY_ANALYSES)
  })

  it('gives whitelisted wallets only an hourly safety cap', () => {
    expect(analysisLimits(OWNER, 'visitor-1')).toEqual([{ key: `ai-hour:wallet:${OWNER}`, limit: 40, windowMs: 3600 * 1000 }])
  })

  it("counts what's left by the wallet or the connection, whichever has used more", async () => {
    expect(await analysisAllowance(STRANGER, 'v')).toEqual({ whitelisted: false, remaining: 5, limit: 5, resetsIn: 7200 })
    usage.set(`ai-day:wallet:${STRANGER}`, 2)
    usage.set('ai-day:visitor:v', 4)
    expect((await analysisAllowance(STRANGER, 'v')).remaining).toBe(1)
    usage.set('ai-day:visitor:v', 9)
    expect((await analysisAllowance(STRANGER, 'v')).remaining).toBe(0)
    expect((await analysisAllowance(null, 'other')).remaining).toBe(5)
    expect(await analysisAllowance(OWNER, 'v')).toMatchObject({ whitelisted: true, remaining: null })
  })
})
