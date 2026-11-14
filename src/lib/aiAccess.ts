import { normalizeWalletAddress } from '../utils/walletAddress'
import { usageOf, type RateLimit } from './rateLimit'

// Server-only. Who may ask for AI match analyses, and how many: each one costs AI credits.

const HOUR_MS = 3600 * 1000
const DAY_MS = 24 * HOUR_MS

/**
 * Wallets with no daily cap: the site's owner and the friends they named (Nov 2026). AI_WHITELIST adds more,
 * comma-separated, without a deploy. The same list is the only one let into Player Scouting (whitelistGate.ts).
 */
const WHITELIST = [
  '0x95dc70d7d39f6f76', // the site's owner
  '0xedecde2008028486', // McBrideAce
  '0x960e08852ea945d2', // bruce
  '0xf16d5fbca5a5ed4f', // rootcoors
]

/** Fresh analyses a day for everyone else, per wallet and per connection; one asked for again within 6 hours is free */
export const DAILY_ANALYSES = 5
/** Fresh analyses a day for everyone not whitelisted together */
const SITE_DAILY_ANALYSES = 200
/** A whitelisted wallet's hourly cap: a wallet address is public, so this bounds what anyone using one could spend */
const WHITELISTED_HOURLY = 40

const whitelist = () =>
  new Set(
    [...WHITELIST, ...(process.env.AI_WHITELIST ?? '').split(',')].flatMap(item => {
      const wallet = normalizeWalletAddress(item)
      return wallet ? [wallet] : []
    }),
  )

export const isWhitelisted = (wallet: string | null) => !!wallet && whitelist().has(wallet)

/** The wallet a request names, lower-cased, or null for none or a malformed one */
export const walletOf = (value: unknown) => (typeof value === 'string' ? normalizeWalletAddress(value) : null)

/** The daily limits on someone not whitelisted: their wallet's, when connected, and their connection's */
const dailyLimits = (wallet: string | null, visitor: string): RateLimit[] => [
  ...(wallet ? [{ key: `ai-day:wallet:${wallet}`, limit: DAILY_ANALYSES, windowMs: DAY_MS }] : []),
  { key: `ai-day:visitor:${visitor}`, limit: DAILY_ANALYSES, windowMs: DAY_MS },
]

/** Every limit a fresh analysis counts against, narrowest first */
export function analysisLimits(wallet: string | null, visitor: string): RateLimit[] {
  if (isWhitelisted(wallet)) return [{ key: `ai-hour:wallet:${wallet}`, limit: WHITELISTED_HOURLY, windowMs: HOUR_MS }]
  return [...dailyLimits(wallet, visitor), { key: 'ai-analysis:1h', limit: 100, windowMs: HOUR_MS }, { key: 'ai-day:site', limit: SITE_DAILY_ANALYSES, windowMs: DAY_MS }]
}

export interface AnalysisAllowance {
  /** No daily cap */
  whitelisted: boolean
  /** Fresh analyses left today, null when whitelisted */
  remaining: number | null
  limit: number | null
  /** Seconds until the day's count starts again */
  resetsIn: number
}

/** How many fresh analyses someone has left today */
export async function analysisAllowance(wallet: string | null, visitor: string, now = Date.now()): Promise<AnalysisAllowance> {
  if (isWhitelisted(wallet)) return { whitelisted: true, remaining: null, limit: null, resetsIn: 0 }
  const usage = await Promise.all(dailyLimits(wallet, visitor).map(limit => usageOf(limit, now)))
  return {
    whitelisted: false,
    remaining: Math.max(0, DAILY_ANALYSES - Math.max(...usage.map(item => item.used))),
    limit: DAILY_ANALYSES,
    resetsIn: usage[0].resetsIn,
  }
}
