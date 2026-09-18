import type { PlayerExperienceEntry } from '../types/playerExperience'

export type PlayerHistories = Record<number, PlayerExperienceEntry[]>

export interface ProgressionLoadProgress {
  histories: PlayerHistories
  refreshed: number // Players refetched from MFL so far
  toRefresh: number // Players that needed refetching
  failedIds: number[]
  done: boolean
  // Set when MFL started rate limiting: loading stopped early, and everything fetched so far is saved
  rateLimitedSeconds?: number
}

interface RateLimited {
  retryAfterSeconds: number
}

// Histories are fetched from MFL at ~1 per second, so a batch stays well inside a request timeout
const REFRESH_BATCH_SIZE = 10

async function post<T>(body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch('/api/data/player-progression', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal
  })
  if (!res.ok) {
    const message = await res.json().then(data => data.error).catch(() => null)
    throw new Error(message || `Failed to load player progression (${res.status})`)
  }
  return res.json()
}

/**
 * Load progression histories for the given players. Cached histories arrive first; players whose
 * history is out of date are then refetched in batches, with `onProgress` called after each batch
 * so the page can fill in as it goes.
 */
export async function loadProgressionHistories(
  playerIds: number[],
  onProgress: (progress: ProgressionLoadProgress) => void,
  signal?: AbortSignal
): Promise<void> {
  if (playerIds.length === 0) {
    onProgress({ histories: {}, refreshed: 0, toRefresh: 0, failedIds: [], done: true })
    return
  }

  const { histories, staleIds, rateLimited } = await post<{
    histories: PlayerHistories
    staleIds: number[]
    rateLimited?: RateLimited
  }>({ action: 'check', playerIds }, signal)

  let current = histories
  let refreshed = 0
  const failedIds: number[] = []
  const report = (done: boolean, rateLimitedSeconds?: number) =>
    onProgress({ histories: current, refreshed, toRefresh: staleIds.length, failedIds: [...failedIds], done, rateLimitedSeconds })

  if (rateLimited || staleIds.length === 0) {
    report(true, rateLimited?.retryAfterSeconds)
    return
  }
  report(false)

  for (let i = 0; i < staleIds.length; i += REFRESH_BATCH_SIZE) {
    const batch = staleIds.slice(i, i + REFRESH_BATCH_SIZE)
    try {
      const result = await post<{ histories: PlayerHistories; errors: Record<number, string>; rateLimited?: RateLimited }>(
        { action: 'refresh', playerIds: batch },
        signal
      )
      current = { ...current, ...result.histories }
      refreshed += Object.keys(result.histories).length
      failedIds.push(...Object.keys(result.errors).map(Number))

      if (result.rateLimited) {
        // Asking again would only extend the block, so stop here; the rest loads on a later visit
        report(true, result.rateLimited.retryAfterSeconds)
        return
      }
    } catch (error) {
      if (signal?.aborted) throw error
      // One failed batch shouldn't lose the rest: those players keep any older cached history
      failedIds.push(...batch)
    }
    report(i + REFRESH_BATCH_SIZE >= staleIds.length)
  }
}
