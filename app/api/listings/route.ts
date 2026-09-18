import { NextRequest, NextResponse } from 'next/server'
import { MflRateLimitError, fetchMfl } from '@/src/services/playerProgressionCache'

const MAX_LIMIT = 50

const STAT_FILTERS = ['age', 'overall', 'pace', 'shooting', 'passing', 'dribbling', 'defense', 'physical', 'goalkeeping']

// Only MFL's own listing filters are passed on, so this can't be used to reach anything else with our token
const ALLOWED_PARAMS = new Set([
  'limit', 'type', 'status', 'sorts', 'sortsOrders', 'view', 'isFreeAgent', 'positions', 'beforeListingId',
  ...STAT_FILTERS.flatMap(stat => [`${stat}Min`, `${stat}Max`])
])

/**
 * GET /api/listings?<MFL listing filters> -> { success, data }  marketplace listings, straight from MFL
 * A 429 carries `retryAfterSeconds` if MFL is rate limiting.
 */
export async function GET(request: NextRequest) {
  const query = new URLSearchParams()
  for (const [key, value] of new URL(request.url).searchParams) {
    if (ALLOWED_PARAMS.has(key)) query.append(key, value)
  }

  const limit = Number(query.get('limit') ?? 25)
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    return NextResponse.json({ success: false, error: `limit must be 1-${MAX_LIMIT}`, data: [] }, { status: 400 })
  }

  try {
    const data = await fetchMfl(`/listings?${query}`)
    return NextResponse.json({ success: true, data: Array.isArray(data) ? data : [] })
  } catch (error) {
    if (error instanceof MflRateLimitError) {
      return NextResponse.json(
        { success: false, error: error.message, retryAfterSeconds: error.retryAfterSeconds, data: [] },
        { status: 429 }
      )
    }
    console.error('Error in /api/listings:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch listings', data: [] },
      { status: 500 }
    )
  }
}
