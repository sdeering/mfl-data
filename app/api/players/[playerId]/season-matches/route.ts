import { NextRequest, NextResponse } from 'next/server'
import { MflRateLimitError, fetchMfl } from '@/src/services/playerProgressionCache'
import { coversSeasons } from '@/src/utils/playerSeasons'
import type { PlayerMatchStats } from '@/src/types/playerMatches'

// The most MFL returns at once
const PAGE_SIZE = 25
// Two seasons are usually 2-3 pages; a player who skipped seasons could otherwise page through years
const MAX_PAGES = 6
const SEASONS = 2
// Between pages, so one page view never bursts MFL (see the rate limit notes in playerProgressionCache)
const PAGE_PAUSE_MS = 600
const CACHE_MS = 60 * 60 * 1000

const cache = new Map<string, { data: PlayerMatchStats[]; fetchedAt: number }>()
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * GET /api/players/:playerId/season-matches -> { success, data }  the player's match stats, newest
 * first, reaching back over their last two seasons (and a little before, to know where those began).
 * A 429 carries `retryAfterSeconds` if MFL is rate limiting.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ playerId: string }> }) {
  const { playerId } = await params
  if (!/^\d+$/.test(playerId)) {
    return NextResponse.json({ success: false, error: 'Player ID must be a number', data: [] }, { status: 400 })
  }

  const cached = cache.get(playerId)
  if (cached && Date.now() - cached.fetchedAt < CACHE_MS) {
    return NextResponse.json({ success: true, data: cached.data })
  }

  try {
    const matches: PlayerMatchStats[] = []
    for (let page = 0; page < MAX_PAGES; page++) {
      if (page > 0) await sleep(PAGE_PAUSE_MS)
      // beforeId is the stat id of the oldest match so far: MFL pages back from it
      const beforeId = matches.length > 0 ? `&beforeId=${matches[matches.length - 1].id}` : ''
      const data = await fetchMfl(`/players/${playerId}/matches/stats?limit=${PAGE_SIZE}${beforeId}`)
      const pageMatches: PlayerMatchStats[] = Array.isArray(data) ? data : []
      matches.push(...pageMatches)
      // A short page is the start of the player's history
      if (pageMatches.length < PAGE_SIZE || coversSeasons(matches, SEASONS)) break
    }

    cache.set(playerId, { data: matches, fetchedAt: Date.now() })
    return NextResponse.json({ success: true, data: matches })
  } catch (error) {
    if (error instanceof MflRateLimitError) {
      return NextResponse.json(
        { success: false, error: error.message, retryAfterSeconds: error.retryAfterSeconds, data: [] },
        { status: 429 }
      )
    }
    console.error(`Error in /api/players/${playerId}/season-matches:`, error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch player matches', data: [] },
      { status: 500 }
    )
  }
}
