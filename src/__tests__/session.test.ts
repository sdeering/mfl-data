import { checkNonce, makeNonce, sessionValue, signInMessage, walletOfSession } from '../lib/session'

const WALLET = '0x95dc70d7d39f6f76'

describe('verified sessions', () => {
  const env = { ...process.env }
  beforeEach(() => {
    process.env = { ...env, SESSION_SECRET: 'test-secret' }
  })
  afterAll(() => {
    process.env = env
  })

  it('makes one-time codes FCL accepts, which only we can make', () => {
    const now = Date.now()
    const nonce = makeNonce(now)
    expect(nonce).toMatch(/^[0-9a-f]{64}$/)
    expect(checkNonce(nonce, now + 60 * 1000)).toBe(true)
    expect(makeNonce(now)).not.toBe(nonce)
    // Tampered, expired, from another secret, or not a code
    expect(checkNonce(nonce.slice(0, 63) + (nonce.endsWith('0') ? '1' : '0'), now)).toBe(false)
    expect(checkNonce(nonce, now + 11 * 60 * 1000)).toBe(false)
    process.env.SESSION_SECRET = 'other'
    expect(checkNonce(nonce, now)).toBe(false)
    expect(checkNonce('nope', now)).toBe(false)
    expect(checkNonce(undefined, now)).toBe(false)
  })

  it('keeps a wallet in a cookie no one else can forge', () => {
    const now = Date.now()
    const value = sessionValue(WALLET, now)
    expect(walletOfSession(value, now)).toBe(WALLET)
    // Expired after 30 days
    expect(walletOfSession(value, now + 31 * 24 * 3600 * 1000)).toBeNull()
    // Another wallet put in, or a later expiry
    const [, expires, signature] = value.split('.')
    expect(walletOfSession(`0xedecde2008028486.${expires}.${signature}`, now)).toBeNull()
    expect(walletOfSession(`${WALLET}.${Number(expires) + 1}.${signature}`, now)).toBeNull()
    expect(walletOfSession(undefined, now)).toBeNull()
    expect(walletOfSession('', now)).toBeNull()
    process.env.SESSION_SECRET = 'other'
    expect(walletOfSession(value, now)).toBeNull()
  })

  it('signs in with a message naming the code, as hex', () => {
    expect(Buffer.from(signInMessage('ab12'), 'hex').toString('utf8')).toBe('Sign in to MFL Data: ab12')
  })
})
