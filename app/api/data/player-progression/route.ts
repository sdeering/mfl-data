import { NextResponse } from 'next/server'
import { checkProgressionCache, refreshProgressionHistories } from '../../../../src/services/playerProgressionCache'

// A refresh batch is paced to stay under MFL's rate limit, so it can outlast the default timeout
export const maxDuration = 30

const MAX_CHECK_IDS = 2000
const MAX_REFRESH_IDS = 10 // Each one is a paced MFL request, so refreshes are requested in small batches

function parsePlayerIds(value: unknown, max: number): number[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > max) return null
  const ids = [...new Set(value.map(Number))]
  return ids.every(id => Number.isInteger(id) && id > 0) ? ids : null
}

/**
 * POST { action: 'check', playerIds }   -> { histories, staleIds }  cached histories + who needs a refresh
 * POST { action: 'refresh', playerIds } -> { histories, errors }    refetch those players from MFL
 * Either response carries `rateLimited: { retryAfterSeconds }` if MFL started rate limiting.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const isRefresh = body.action === 'refresh'

    if (!isRefresh && body.action !== 'check') {
      return NextResponse.json({ error: "Invalid action. Use 'check' or 'refresh'" }, { status: 400 })
    }

    const max = isRefresh ? MAX_REFRESH_IDS : MAX_CHECK_IDS
    const playerIds = parsePlayerIds(body.playerIds, max)
    if (!playerIds) {
      return NextResponse.json({ error: `playerIds must be 1-${max} positive integers` }, { status: 400 })
    }

    const result = isRefresh ? await refreshProgressionHistories(playerIds) : await checkProgressionCache(playerIds)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error in /api/data/player-progression:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
