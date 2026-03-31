import { NextResponse } from 'next/server'
import { dataService } from '../../../../src/services/dataService'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const walletAddress = searchParams.get('walletAddress')
  const type = searchParams.get('type')

  if (!walletAddress) {
    return NextResponse.json({ error: 'walletAddress is required' }, { status: 400 })
  }

  try {
    if (type === 'upcoming') {
      const data = await dataService.getUpcomingMatches(walletAddress)
      return NextResponse.json(data)
    }
    if (type === 'previous') {
      const data = await dataService.getPreviousMatches(walletAddress)
      return NextResponse.json(data)
    }
    const data = await dataService.getMatchesData(walletAddress)
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error in /api/data/matches:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
