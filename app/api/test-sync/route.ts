import { NextRequest, NextResponse } from 'next/server'
import { supabaseSyncService } from '../../../src/services/supabaseSyncService'

const TEST_WALLET = '0x95dc70d7d39f6f76'

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 API: Starting sync test...')
    
    // Test: Full Sync (this will test all components)
    console.log('🔍 Testing full sync...')
    let fullSyncResult = { success: false, error: null }
    
    try {
      await supabaseSyncService.syncAllData(TEST_WALLET, { forceRefresh: true })
      fullSyncResult = { success: true, error: null }
      console.log('✅ Full sync: PASSED')
    } catch (error) {
      fullSyncResult = { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
      console.log(`❌ Full sync: FAILED - ${fullSyncResult.error}`)
    }
    
    // Calculate summary
    const totalTests = 1
    const passedTests = fullSyncResult.success ? 1 : 0
    const successRate = ((passedTests / totalTests) * 100).toFixed(1)
    
    console.log('\n📊 Test Results Summary:')
    console.log('=' .repeat(50))
    console.log(`Total Tests: ${totalTests}`)
    console.log(`Passed: ${passedTests}`)
    console.log(`Failed: ${totalTests - passedTests}`)
    console.log(`Success Rate: ${successRate}%`)
    console.log('=' .repeat(50))
    
    return NextResponse.json({
      success: true,
      results: {
        fullSync: fullSyncResult
      },
      summary: {
        total: totalTests,
        passed: passedTests,
        failed: totalTests - passedTests,
        successRate: parseFloat(successRate)
      }
    })
    
  } catch (error) {
    console.error('❌ API: Test runner error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
