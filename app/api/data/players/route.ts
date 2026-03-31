import { NextResponse } from 'next/server'
import { dataService } from '../../../../src/services/dataService'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const playerId = searchParams.get('playerId')

  if (!playerId) {
    return NextResponse.json({ error: 'playerId is required' }, { status: 400 })
  }

  try {
    const data = await dataService.getPlayer(playerId)
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error in /api/data/players:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
