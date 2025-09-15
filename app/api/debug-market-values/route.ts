import { NextRequest, NextResponse } from 'next/server'
import { supabaseSyncService } from '../../../src/services/supabaseSyncService'

const TEST_WALLET = '0x95dc70d7d39f6f76'

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Debug: Testing market values sync specifically...')
    
    // Set up progress tracking
    const progressLog: string[] = []
    const originalConsoleLog = console.log
    console.log = (...args) => {
      const message = args.join(' ')
      progressLog.push(message)
      originalConsoleLog(...args)
    }
    
    try {
      // Run only the market values sync (LIMITED TO 10 PLAYERS TO PROTECT API)
      await supabaseSyncService.syncAgencyPlayerMarketValues(TEST_WALLET, { forceRefresh: true }, 10)
      
      console.log = originalConsoleLog
      
      return NextResponse.json({
        success: true,
        message: 'Market values sync completed',
        progressLog: progressLog.filter(log => 
          log.includes('market') || 
          log.includes('Market') || 
          log.includes('value') || 
          log.includes('Value') ||
          log.includes('error') ||
          log.includes('Error') ||
          log.includes('❌') ||
          log.includes('✅') ||
          log.includes('🔍') ||
          log.includes('⚠️') ||
          log.includes('Processing player')
        )
      })
      
    } catch (error) {
      console.log = originalConsoleLog
      
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        progressLog: progressLog.filter(log => 
          log.includes('market') || 
          log.includes('Market') || 
          log.includes('value') || 
          log.includes('Value') ||
          log.includes('error') ||
          log.includes('Error') ||
          log.includes('❌') ||
          log.includes('✅')
        )
      })
    }
    
  } catch (error) {
    console.error('❌ Debug API error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
