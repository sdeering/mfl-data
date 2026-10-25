// Server-only: talks to the MFL API and the database. Never import this from client code.
import type { MFLPlayer } from '../types/mflApi'
import { TABLES } from '../lib/database'
import { deleteWhere, selectAll, selectMaybeOne, upsertMany } from '../lib/db-helpers'
import { RateLimit, blockFor, blockedFor, takeRateLimits } from '../lib/rateLimit'
import { MflRateLimitError, fetchMfl } from './playerProgressionCache'
import { dataService } from './dataService'
import { incrementUsage } from './apiUsage'

// MFL doesn't document its limit, but blocks the token for ~10 minutes after a burst (seen after ~65 requests in
// ~10s), so wallet lookups stay under a request a second: 5 every 10 seconds and 50 a minute across the site.
// Anyone can paste any wallet, so one visitor gets 10 new wallets every 10 minutes, plenty to look through a few.
export const MFL_WALLET_LIMITS: RateLimit[] = [
  { key: 'mfl-wallets:10s', limit: 5, windowMs: 10 * 1000 },
  { key: 'mfl-wallets:1m', limit: 50, windowMs: 60 * 1000 },
]
export const visitorWalletsLimit = (visitor: string): RateLimit => ({ key: `mfl-wallets:${visitor}`, limit: 10, windowMs: 10 * 60 * 1000 })
export const MFL_BLOCK = 'mfl'

// Stored players this recent are shown as they are, without asking MFL again
const FRESH_MS = 24 * 60 * 60 * 1000
// The most players MFL returns at once
const PAGE_SIZE = 1500
const MAX_PAGES = 10
const PAGE_PAUSE_MS = 1000

export type AgencyLoad =
  | { status: 'loaded'; players: MFLPlayer[]; source: 'stored' | 'mfl' }
  | { status: 'limited'; retryAfter: number }

/** Every player a wallet owns. MFL lists them newest first, so each page carries on from the last one's oldest. */
export async function fetchOwnerPlayers(walletAddress: string): Promise<MFLPlayer[]> {
  const players: MFLPlayer[] = []
  for (let page = 0; page < MAX_PAGES; page++) {
    if (page > 0) await new Promise(resolve => setTimeout(resolve, PAGE_PAUSE_MS))
    const params = new URLSearchParams({ ownerWalletAddress: walletAddress, limit: String(PAGE_SIZE) })
    if (players.length > 0) params.set('beforePlayerId', String(players[players.length - 1].id))
    const batch = await fetchMfl(`/players?${params}`)
    if (!Array.isArray(batch)) throw new Error('MFL API returned an unexpected player list')
    try { await incrementUsage('mfl', '/players') } catch {}
    players.push(...batch)
    if (batch.length < PAGE_SIZE) break
  }
  return players
}

/** Stores a wallet's players as its agency, dropping any it no longer owns. */
async function storeAgency(walletAddress: string, players: MFLPlayer[], now: number): Promise<void> {
  const synced = new Date(now).toISOString()
  const { error: playersError } = await upsertMany(
    TABLES.PLAYERS,
    players.map(player => ({ mfl_player_id: player.id, data: player, last_synced: synced })),
    'mfl_player_id'
  )
  if (playersError) throw new Error(`Couldn't store players: ${playersError.message}`)

  const { error: agencyError } = await upsertMany(
    TABLES.AGENCY_PLAYERS,
    players.map(player => ({ wallet_address: walletAddress, mfl_player_id: player.id, last_synced: synced })),
    'wallet_address,mfl_player_id'
  )
  if (agencyError) throw new Error(`Couldn't store the agency: ${agencyError.message}`)

  const owned = new Set(players.map(player => player.id))
  const { data: stored } = await selectAll(TABLES.AGENCY_PLAYERS, { columns: ['mfl_player_id'], where: { wallet_address: walletAddress } })
  const gone = (stored ?? []).map(row => row.mfl_player_id).filter(id => !owned.has(id))
  if (gone.length > 0) await deleteWhere(TABLES.AGENCY_PLAYERS, { wallet_address: walletAddress, mfl_player_id: { in: gone } })

  dataService.clearCache(`agency_players_${walletAddress}`)
}

/**
 * A wallet's players for someone viewing it: the stored ones when they were synced in the last day, otherwise
 * loaded from MFL and stored. A load counts against the visitor's and the site's limits. When one is used up,
 * or MFL has said to back off, any players already stored are shown instead.
 */
export async function loadAgency(walletAddress: string, visitor: string, now = Date.now()): Promise<AgencyLoad> {
  const { data: latest } = await selectMaybeOne(TABLES.AGENCY_PLAYERS, {
    columns: ['last_synced'],
    where: { wallet_address: walletAddress },
    orderBy: { column: 'last_synced', ascending: false },
    limit: 1,
  })
  const stored = async (): Promise<AgencyLoad> => {
    // Another server instance may have stored them since this one last read the wallet
    dataService.clearCache(`agency_players_${walletAddress}`)
    return { status: 'loaded', players: await dataService.getAgencyPlayers(walletAddress), source: 'stored' }
  }
  const limited = async (retryAfter: number) => (latest ? stored() : { status: 'limited' as const, retryAfter })

  if (latest?.last_synced && now - Date.parse(latest.last_synced) < FRESH_MS) return stored()

  const blocked = await blockedFor(MFL_BLOCK, now)
  if (blocked > 0) return limited(blocked)
  const wait = await takeRateLimits([visitorWalletsLimit(visitor), ...MFL_WALLET_LIMITS], now)
  if (wait > 0) return limited(wait)

  let players: MFLPlayer[]
  try {
    players = await fetchOwnerPlayers(walletAddress)
  } catch (error) {
    if (error instanceof MflRateLimitError) {
      // Asking again during a block seems to extend it, so no server instance asks until it ends
      await blockFor(MFL_BLOCK, error.retryAfterSeconds, now)
      return limited(error.retryAfterSeconds)
    }
    if (latest) return stored()
    throw error
  }
  await storeAgency(walletAddress, players, now)
  return { status: 'loaded', players, source: 'mfl' }
}
