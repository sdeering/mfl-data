import { NextResponse } from 'next/server'
import { dataService } from '../../../../src/services/dataService'

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
