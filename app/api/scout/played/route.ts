import { NextRequest, NextResponse } from 'next/server'
import { MflRateLimitError, fetchMfl } from '@/src/services/playerProgressionCache'

const MAX_IDS = 5
const PAUSE_MS = 600 // MFL blocks a token that is asked too fast; see playerProgressionCache

// A player who has played a game never goes back to having played none, so that answer is kept.
// (Per server instance - a miss only costs one more request.)
const hasPlayed = new Set<number>()

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * GET /api/scout/played?ids=1,2,3 -> { success, played: { [id]: boolean } }
 * Whether each player has played a game. A 429 carries `retryAfterSeconds` and whatever was checked first.
 */
export async function GET(request: NextRequest) {
  const ids = (request.nextUrl.searchParams.get('ids') ?? '').split(',').filter(Boolean).map(Number)
  if (ids.length === 0 || ids.length > MAX_IDS || !ids.every(id => Number.isInteger(id) && id > 0)) {
    return NextResponse.json({ success: false, error: `ids must be 1-${MAX_IDS} player ids`, played: {} }, { status: 400 })
  }

  const played: Record<number, boolean> = {}
  try {
    let requested = false
    for (const id of ids) {
      if (hasPlayed.has(id)) {
        played[id] = true
        continue
      }
      if (requested) await sleep(PAUSE_MS)
      requested = true
      // One match is enough to know
      const matches = await fetchMfl(`/players/${id}/matches/stats?limit=1`)
      played[id] = Array.isArray(matches) && matches.length > 0
      if (played[id]) hasPlayed.add(id)
    }
    return NextResponse.json({ success: true, played })
  } catch (error) {
    if (error instanceof MflRateLimitError) {
      return NextResponse.json({ success: false, error: error.message, retryAfterSeconds: error.retryAfterSeconds, played }, { status: 429 })
    }
    console.error('Error in /api/scout/played:', error)
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed to check games played', played }, { status: 500 })
  }
}
