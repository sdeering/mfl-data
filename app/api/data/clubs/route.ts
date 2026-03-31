import { NextResponse } from 'next/server'
import { dataService } from '../../../../src/services/dataService'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const walletAddress = searchParams.get('walletAddress')

  if (!walletAddress) {
    return NextResponse.json({ error: 'walletAddress is required' }, { status: 400 })
  }

  try {
    const data = await dataService.getClubsForWallet(walletAddress)
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error in /api/data/clubs:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
