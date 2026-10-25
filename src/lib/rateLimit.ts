import { createHmac } from 'crypto'
import { executeRaw } from './db-helpers'

// Server-only. Counts are kept in the database, so every server instance shares them.

export interface RateLimit {
  key: string
  limit: number
  windowMs: number
}

const DAY_MS = 24 * 60 * 60 * 1000

const windowStartOf = (windowMs: number, now: number) => Math.floor(now / windowMs) * windowMs

/**
 * Counts one use against each limit in turn. At the first one used up it stops and gives back the uses it took
 * from the limits before, so a use that is refused costs nothing. Resolves to the seconds to wait before trying
 * again, or 0 when the use is allowed. List the narrowest limit first, such as a visitor's own before the site's,
 * so someone over theirs doesn't use up everyone else's.
 */
export async function takeRateLimits(limits: RateLimit[], now = Date.now()): Promise<number> {
  const taken: [string, number][] = []
  for (const { key, limit, windowMs } of limits) {
    const windowStart = windowStartOf(windowMs, now)
    const { data, error } = await executeRaw(
      `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
       ON CONFLICT (key, window_start) DO UPDATE SET count = count + 1
       RETURNING count`,
      [key, windowStart]
    )
    if (error) throw new Error(`Rate limit check failed: ${error.message}`)
    const count = Number(data?.[0]?.count)
    // A new window has opened, so it's a good moment to drop the old ones
    if (count === 1) await executeRaw('DELETE FROM rate_limits WHERE window_start < ?', [now - DAY_MS])
    if (count > limit) {
      for (const [takenKey, takenWindow] of taken) {
        await executeRaw('UPDATE rate_limits SET count = count - 1 WHERE key = ? AND window_start = ?', [takenKey, takenWindow])
      }
      return Math.max(1, Math.ceil((windowStart + windowMs - now) / 1000))
    }
    taken.push([key, windowStart])
  }
  return 0
}

// A block is kept as a row whose window_start is when it ends
const blockKey = (key: string) => `block:${key}`

/** Stops every server instance using something for a while, such as an API that has said to back off. */
export async function blockFor(key: string, seconds: number, now = Date.now()): Promise<void> {
  await executeRaw('INSERT OR IGNORE INTO rate_limits (key, window_start, count) VALUES (?, ?, 0)', [blockKey(key), now + seconds * 1000])
}

/** The seconds left until a block on key ends, or 0 when there is none. */
export async function blockedFor(key: string, now = Date.now()): Promise<number> {
  const { data, error } = await executeRaw('SELECT MAX(window_start) AS until FROM rate_limits WHERE key = ?', [blockKey(key)])
  if (error) throw new Error(`Rate limit check failed: ${error.message}`)
  const until = Number(data?.[0]?.until) || 0
  return until > now ? Math.ceil((until - now) / 1000) : 0
}

/** "Try again in …" for a wait in seconds */
export const describeWait = (seconds: number) =>
  seconds < 60 ? `${seconds} second${seconds === 1 ? '' : 's'}` : `${Math.ceil(seconds / 60)} minute${seconds > 60 ? 's' : ''}`

/**
 * Who a request comes from, as a hash so no IP address is stored. It is keyed with a server secret, so the
 * stored keys can't be matched back to addresses by hashing every IP. Vercel sets x-real-ip and
 * x-forwarded-for itself, so a visitor can't pick their own.
 */
export function visitorKey(request: Request): string {
  const ip = request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
  return createHmac('sha256', process.env.MFL_API_TOKEN ?? '').update(ip).digest('hex').slice(0, 16)
}
