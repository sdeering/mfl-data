import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  try {
    const { syncService } = await import('../../../../src/services/syncService')

    if (action === 'progress') {
      const progress = syncService.getCurrentProgress()
      return NextResponse.json(progress)
    }

    if (action === 'isSyncing') {
      return NextResponse.json({ isSyncing: syncService.isSyncInProgress() })
    }

    return NextResponse.json({ error: 'Invalid action. Use ?action=progress or ?action=isSyncing' }, { status: 400 })
  } catch (error: any) {
    console.error('Error in /api/data/sync GET:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { syncService } = await import('../../../../src/services/syncService')

    if (body.action === 'stop') {
      syncService.stopSync()
      return NextResponse.json({ success: true })
    }

    const { walletAddress, options } = body

    if (!walletAddress) {
      return NextResponse.json({ error: 'walletAddress is required' }, { status: 400 })
    }

    // Kick off sync in the background (don't await)
    syncService.syncAllData(walletAddress, options).catch((error: any) => {
      console.error('Background sync error:', error)
    })

    return NextResponse.json({ success: true, message: 'Sync started' })
  } catch (error: any) {
    console.error('Error in /api/data/sync POST:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
