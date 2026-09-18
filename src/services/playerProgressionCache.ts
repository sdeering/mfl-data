// Server-only: talks to the MFL API and the database. Never import this from client code.
import { MFL_API_BASE_URL, getMflAuthHeaders } from '../config/mflApi'
import { TABLES } from '../lib/database'
import { selectAll, upsertMany } from '../lib/db-helpers'
import type { PlayerExperienceEntry } from '../types/playerExperience'
import { PROGRESSION_STATS, getProgressionEvents, sumEvents, type ProgressionTotals } from '../utils/progressionCounts'

// A cached history is trusted for a day; after that it is re-checked the next time the page loads
export const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000

const BULK_CHUNK_SIZE = 50 // Max player IDs the MFL progressions endpoint accepts per request
const DB_CHUNK_SIZE = 500
const REQUEST_TIMEOUT_MS = 30000

// MFL blocks a token for ~10 minutes after a burst of requests (seen after ~65 requests in ~10s).
// Its real limit isn't documented, and the first load is a one-off, so histories are fetched one at
// a time with a pause in between: roughly 1 request/second. Slow is cheap; a block is not.
const HISTORY_CONCURRENCY = 1
const HISTORY_PAUSE_MS = 600

export type PlayerHistories = Record<number, PlayerExperienceEntry[]>

export interface RateLimited {
  retryAfterSeconds: number
}

export class MflRateLimitError extends Error {
  constructor(public retryAfterSeconds: number) {
    super('MFL API rate limit exceeded')
  }
}

interface CachedProgression {
  entries: PlayerExperienceEntry[]
  totals: ProgressionTotals // All-time totals of the entries; these match what MFL's bulk endpoint reports
}

interface CacheRow {
  mfl_player_id: number
  data: CachedProgression | null
  last_synced: string | null
}

const chunk = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

// When MFL last told us to back off until. Requests made during a block appear to extend it, so
// until this passes we answer "rate limited" ourselves instead of asking MFL again.
let blockedUntil = 0

async function fetchMfl(path: string): Promise<any> {
  const remainingMs = blockedUntil - Date.now()
  if (remainingMs > 0) throw new MflRateLimitError(Math.ceil(remainingMs / 1000))

  const response = await fetch(`${MFL_API_BASE_URL}${path}`, {
    headers: { Accept: 'application/json', ...getMflAuthHeaders() },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: 'no-store'
  })
  if (response.status === 429) {
    const retryAfter = Number(response.headers.get('retry-after'))
    const retryAfterSeconds = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 600
    blockedUntil = Date.now() + retryAfterSeconds * 1000
    throw new MflRateLimitError(retryAfterSeconds)
  }
  if (!response.ok) throw new Error(`MFL API error: ${response.status} ${response.statusText}`)
  return response.json()
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/** Keep only the stats that actually progressed, so totals compare cleanly. */
export function normalizeTotals(raw: unknown): ProgressionTotals {
  const totals: ProgressionTotals = {}
  if (!raw || typeof raw !== 'object') return totals

  for (const stat of PROGRESSION_STATS) {
    const value = (raw as Record<string, unknown>)[stat]
    if (typeof value === 'number' && value > 0) totals[stat] = value
  }
  return totals
}

export function totalsEqual(a: ProgressionTotals, b: ProgressionTotals): boolean {
  return PROGRESSION_STATS.every(stat => (a[stat] ?? 0) === (b[stat] ?? 0))
}

export function isRecentlySynced(lastSynced: string | null, now: number): boolean {
  if (!lastSynced) return false
  const syncedAt = Date.parse(lastSynced)
  return !Number.isNaN(syncedAt) && now - syncedAt < CACHE_MAX_AGE_MS
}

/** All-time progression totals for many players in as few MFL requests as possible. */
async function fetchBulkTotals(playerIds: number[]): Promise<Map<number, ProgressionTotals>> {
  const totals = new Map<number, ProgressionTotals>()
  for (const ids of chunk(playerIds, BULK_CHUNK_SIZE)) {
    const data = await fetchMfl(`/players/progressions?playersIds=${ids.join(',')}&interval=ALL`)
    for (const id of ids) totals.set(id, normalizeTotals(data?.[id]))
  }
  return totals
}

async function readCacheRows(playerIds: number[]): Promise<Map<number, CacheRow>> {
  const rows = new Map<number, CacheRow>()
  for (const ids of chunk(playerIds, DB_CHUNK_SIZE)) {
    const { data, error } = await selectAll<CacheRow>(TABLES.PLAYER_PROGRESSION, {
      columns: ['mfl_player_id', 'data', 'last_synced'],
      where: { mfl_player_id: { in: ids } }
    })
    if (error) throw new Error(`Failed to read progression cache: ${error.message}`)
    for (const row of data ?? []) rows.set(Number(row.mfl_player_id), row)
  }
  return rows
}

async function writeCacheRows(entries: Array<{ playerId: number; data: CachedProgression }>, now: number) {
  const lastSynced = new Date(now).toISOString()
  for (const rows of chunk(entries, DB_CHUNK_SIZE)) {
    const { error } = await upsertMany(
      TABLES.PLAYER_PROGRESSION,
      // One row per player: the player ID doubles as the row ID so re-syncs overwrite in place
      rows.map(({ playerId, data }) => ({ id: String(playerId), mfl_player_id: playerId, data, last_synced: lastSynced })),
      'id'
    )
    if (error) throw new Error(`Failed to write progression cache: ${error.message}`)
  }
}

/**
 * Return every history that can be served from the cache, plus the players that need a refresh.
 *
 * Histories checked within the last day are served as-is with no MFL requests. Older ones are
 * compared against MFL's bulk totals: unchanged totals mean the cached history is still complete,
 * so only players who have actually progressed since go back to MFL.
 *
 * If MFL is rate limiting, whatever is cached is served and nothing is marked stale.
 */
export async function checkProgressionCache(
  playerIds: number[],
  now: number = Date.now()
): Promise<{ histories: PlayerHistories; staleIds: number[]; rateLimited?: RateLimited }> {
  const cached = await readCacheRows(playerIds)
  const histories: PlayerHistories = {}
  const needsCheck: number[] = []

  for (const id of playerIds) {
    const row = cached.get(id)
    if (row?.data && isRecentlySynced(row.last_synced, now)) {
      histories[id] = row.data.entries
    } else {
      needsCheck.push(id)
    }
  }

  if (needsCheck.length === 0) return { histories, staleIds: [] }

  let bulkTotals: Map<number, ProgressionTotals>
  try {
    bulkTotals = await fetchBulkTotals(needsCheck)
  } catch (error) {
    if (!(error instanceof MflRateLimitError)) throw error
    for (const id of needsCheck) {
      const data = cached.get(id)?.data
      if (data) histories[id] = data.entries
    }
    return { histories, staleIds: [], rateLimited: { retryAfterSeconds: error.retryAfterSeconds } }
  }

  const staleIds: number[] = []
  const confirmed: Array<{ playerId: number; data: CachedProgression }> = []

  for (const id of needsCheck) {
    const totals = bulkTotals.get(id) ?? {}
    const data = cached.get(id)?.data
    // Never progressed: nothing to chart, so there is no history worth fetching
    const neverProgressed = !data && Object.keys(totals).length === 0

    const upToDate = data && totalsEqual(data.totals, totals) ? data : neverProgressed ? { entries: [], totals } : null
    if (upToDate) {
      confirmed.push({ playerId: id, data: upToDate })
      histories[id] = upToDate.entries
    } else {
      staleIds.push(id)
      // Serve the older history meanwhile so the page has something to draw while it refreshes
      if (data) histories[id] = data.entries
    }
  }

  await writeCacheRows(confirmed, now)
  return { histories, staleIds }
}

/**
 * Fetch fresh histories from MFL for the given players and store them in the cache.
 *
 * Stops at the first rate-limit response rather than hammering a blocked API: whatever was fetched
 * is still saved, and the players that were not reached simply stay stale until the next attempt.
 */
export async function refreshProgressionHistories(
  playerIds: number[],
  now: number = Date.now()
): Promise<{ histories: PlayerHistories; errors: Record<number, string>; rateLimited?: RateLimited }> {
  const histories: PlayerHistories = {}
  const errors: Record<number, string> = {}
  let rateLimited: RateLimited | undefined

  const queue = [...playerIds]
  const worker = async () => {
    for (let id = queue.shift(); id !== undefined && !rateLimited; id = queue.shift()) {
      try {
        const data = await fetchMfl(`/players/${id}/experiences/history`)
        histories[id] = Array.isArray(data) ? data : []
      } catch (error) {
        if (error instanceof MflRateLimitError) {
          rateLimited = { retryAfterSeconds: error.retryAfterSeconds }
          return
        }
        errors[id] = error instanceof Error ? error.message : 'Failed to fetch experience history'
      }
      if (queue.length > 0) await sleep(HISTORY_PAUSE_MS)
    }
  }
  await Promise.all(Array.from({ length: Math.min(HISTORY_CONCURRENCY, playerIds.length) }, worker))

  await writeCacheRows(
    Object.entries(histories).map(([id, entries]) => ({
      playerId: Number(id),
      data: { entries, totals: sumEvents(getProgressionEvents(entries)) }
    })),
    now
  )
  return { histories, errors, rateLimited }
}
