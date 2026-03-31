import { NextResponse } from 'next/server'
import { dataService } from '../../../../src/services/dataService'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const walletAddress = searchParams.get('walletAddress')

  try {
    if (walletAddress) {
      const data = await dataService.getSyncStatus(walletAddress)
      return NextResponse.json(data)
    }

    // No walletAddress: return sync service status
    const { syncService } = await import('../../../../src/services/syncService')
    const data = await syncService.getSyncStatus()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error in /api/data/sync-status:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
