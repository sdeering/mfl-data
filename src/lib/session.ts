import { createHmac, randomBytes, timingSafeEqual } from 'crypto'
import { normalizeWalletAddress } from '../utils/walletAddress'

/*
 * Server-only. A verified login: the wallet proves it holds its Flow account by signing a one-time code of ours
 * (an FCL account proof at login, or a signed message), which Flow checks; then a signed cookie keeps the session.
 * Without it, a wallet address in a request is only a claim, and addresses are public.
 */

export const SESSION_COOKIE = 'mfldata_session'
/** How long a login lasts */
export const SESSION_DAYS = 30
/** How long a one-time code can be signed for */
const NONCE_MS = 10 * 60 * 1000
export { APP_IDENTIFIER, signInMessage } from '../utils/signIn'

/** Kept in SESSION_SECRET; without one it is derived from the MFL token, which is already a server secret */
const secret = () => process.env.SESSION_SECRET || createHmac('sha256', process.env.MFL_API_TOKEN ?? 'mfldata').update('mfldata-session').digest('hex')
const mac = (text: string, bytes = 32) => createHmac('sha256', secret()).update(text).digest().subarray(0, bytes)

const sameBytes = (a: Buffer, b: Buffer) => a.length === b.length && timingSafeEqual(a, b)

/**
 * A one-time code to sign: when it was made, 8 random bytes and our MAC of both, 64 hex digits as FCL wants. It
 * needs no storage, since only we can make one that checks out.
 */
export function makeNonce(now = Date.now()): string {
  const head = Buffer.alloc(16)
  head.writeBigUInt64BE(BigInt(now))
  randomBytes(8).copy(head, 8)
  return Buffer.concat([head, mac(`nonce:${head.toString('hex')}`, 16)]).toString('hex')
}

/** Whether a code is one of ours and recent */
export function checkNonce(nonce: unknown, now = Date.now()): boolean {
  if (typeof nonce !== 'string' || !/^[0-9a-f]{64}$/.test(nonce)) return false
  const bytes = Buffer.from(nonce, 'hex')
  const head = bytes.subarray(0, 16)
  if (!sameBytes(bytes.subarray(16), mac(`nonce:${head.toString('hex')}`, 16))) return false
  const age = now - Number(head.readBigUInt64BE())
  return age >= -60 * 1000 && age <= NONCE_MS
}

/** A wallet, when its proof expires, and our MAC of both, for one purpose */
function signedWallet(purpose: string, wallet: string, days: number, now: number): string {
  const expires = now + days * 24 * 3600 * 1000
  return `${wallet}.${expires}.${mac(`${purpose}:${wallet}.${expires}`).toString('hex')}`
}

/** The wallet a signed value names, or null when it isn't ours, is for another purpose, has expired or is missing */
function walletOfSigned(purpose: string, value: string | undefined | null, now: number): string | null {
  const [wallet, expires, signature] = (value ?? '').split('.')
  const address = normalizeWalletAddress(wallet ?? '')
  if (!address || address !== wallet || !/^\d+$/.test(expires ?? '') || !/^[0-9a-f]{64}$/.test(signature ?? '')) return null
  if (!sameBytes(Buffer.from(signature, 'hex'), mac(`${purpose}:${wallet}.${expires}`))) return null
  return Number(expires) > now ? address : null
}

/** The cookie's value for a verified wallet */
export const sessionValue = (wallet: string, now = Date.now()) => signedWallet('session', wallet, SESSION_DAYS, now)

/** The verified wallet a cookie's value names, or null */
export const walletOfSession = (value: string | undefined | null, now = Date.now()) => walletOfSigned('session', value, now)

/** How long an MFL import bookmark works */
export const IMPORT_TOKEN_DAYS = 365

/**
 * The MFL import bookmark's key: it runs on app.playmfl.com, where our session cookie isn't sent, so it carries
 * this instead. It only lets the bookmark log tactics for the wallet's own clubs.
 */
export const importToken = (wallet: string, now = Date.now()) => signedWallet('import', wallet, IMPORT_TOKEN_DAYS, now)

export const walletOfImportToken = (value: string | undefined | null, now = Date.now()) => walletOfSigned('import', value, now)

/** The verified wallet of the request's session, or null */
export const sessionWallet = (request: { cookies: { get: (name: string) => { value: string } | undefined } }) =>
  walletOfSession(request.cookies.get(SESSION_COOKIE)?.value)

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_DAYS * 24 * 3600,
}
