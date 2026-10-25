import { NextResponse } from 'next/server'
import { dataService } from '../../../../src/services/dataService'
import { loadAgency } from '../../../../src/services/agencyLoader'
import { describeWait, visitorKey } from '../../../../src/lib/rateLimit'
import { normalizeWalletAddress } from '../../../../src/utils/walletAddress'

// A large agency comes from MFL a page at a time
export const maxDuration = 60

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const walletAddress = searchParams.get('walletAddress')
  const marketValues = searchParams.get('marketValues')

  if (!walletAddress) {
    return NextResponse.json({ error: 'walletAddress is required' }, { status: 400 })
  }

  try {
    if (marketValues === 'true') {
      const data = await dataService.getAgencyPlayerMarketValues(walletAddress)
      return NextResponse.json(data)
    }
    const data = await dataService.getAgencyPlayers(walletAddress)
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error in /api/data/agency-players:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/** A wallet pasted in to view: its players, loaded from MFL first when they aren't stored or are a day old. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const walletAddress = normalizeWalletAddress(typeof body?.walletAddress === 'string' ? body.walletAddress : '')
  if (!walletAddress) {
    return NextResponse.json({ error: "That isn't an MFL wallet address." }, { status: 400 })
  }

  try {
    const result = await loadAgency(walletAddress, visitorKey(request))
    if (result.status === 'limited') {
      return NextResponse.json(
        { error: `Too many wallet lookups right now. Try again in ${describeWait(result.retryAfter)}.`, retryAfter: result.retryAfter },
        { status: 429, headers: { 'Retry-After': String(result.retryAfter) } }
      )
    }
    return NextResponse.json(result.players)
  } catch (error: any) {
    console.error('Error loading agency players in /api/data/agency-players:', error)
    return NextResponse.json({ error: "Couldn't load this wallet's players from MFL. Please try again." }, { status: 502 })
  }
}
