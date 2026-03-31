import { NextRequest, NextResponse } from 'next/server'
import { TABLES } from '../../../src/lib/database'
import { selectAll, selectOne } from '../../../src/lib/db-helpers'

const TEST_WALLET = '0x95dc70d7d39f6f76'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Verifying sync data in database...')
    
    const results = {
      userInfo: { found: false, count: 0, error: null },
      clubs: { found: false, count: 0, error: null },
      agencyPlayers: { found: false, count: 0, error: null },
      players: { found: false, count: 0, error: null },
      marketValues: { found: false, count: 0, error: null }
    }
    
    // Check User Info
    try {
      const { data: userInfo, error } = await selectOne(TABLES.USERS, {
        where: { wallet_address: TEST_WALLET }
      })

      if (error && error.code !== 'PGRST116') {
        results.userInfo.error = error.message
      } else if (userInfo) {
        results.userInfo.found = true
        results.userInfo.count = 1
      }
    } catch (error) {
      results.userInfo.error = error instanceof Error ? error.message : 'Unknown error'
    }
    
    // Check Clubs
    try {
      const { data: clubs, error } = await selectAll(TABLES.CLUBS, { limit: 10 })

      if (error && error.code !== 'PGRST116') {
        results.clubs.error = error.message
      } else if (clubs) {
        results.clubs.found = true
        results.clubs.count = clubs.length
      }
    } catch (error) {
      results.clubs.error = error instanceof Error ? error.message : 'Unknown error'
    }
    
    // Check Agency Players
    try {
      const { data: agencyPlayers, error } = await selectAll(TABLES.AGENCY_PLAYERS, {
        where: { wallet_address: TEST_WALLET }
      })

      if (error && error.code !== 'PGRST116') {
        results.agencyPlayers.error = error.message
      } else if (agencyPlayers) {
        results.agencyPlayers.found = true
        results.agencyPlayers.count = agencyPlayers.length
      }
    } catch (error) {
      results.agencyPlayers.error = error instanceof Error ? error.message : 'Unknown error'
    }
    
    // Check Players Table
    try {
      const { data: players, error } = await selectAll(TABLES.PLAYERS, { limit: 10 })

      if (error && error.code !== 'PGRST116') {
        results.players.error = error.message
      } else if (players) {
        results.players.found = true
        results.players.count = players.length
      }
    } catch (error) {
      results.players.error = error instanceof Error ? error.message : 'Unknown error'
    }
    
    // Check Market Values
    try {
      const { data: marketValues, error } = await selectAll(TABLES.MARKET_VALUES, {
        where: { wallet_address: TEST_WALLET }
      })

      if (error && error.code !== 'PGRST116') {
        results.marketValues.error = error.message
      } else if (marketValues) {
        results.marketValues.found = true
        results.marketValues.count = marketValues.length
      }
    } catch (error) {
      results.marketValues.error = error instanceof Error ? error.message : 'Unknown error'
    }
    
    // Calculate summary
    const totalChecks = Object.keys(results).length
    const passedChecks = Object.values(results).filter(r => r.found && !r.error).length
    const successRate = ((passedChecks / totalChecks) * 100).toFixed(1)
    
    console.log('\n📊 Database Verification Results:')
    console.log('=' .repeat(50))
    console.log(`User Info: ${results.userInfo.found ? '✅' : '❌'} (${results.userInfo.count})`)
    console.log(`Clubs: ${results.clubs.found ? '✅' : '❌'} (${results.clubs.count})`)
    console.log(`Agency Players: ${results.agencyPlayers.found ? '✅' : '❌'} (${results.agencyPlayers.count})`)
    console.log(`Players: ${results.players.found ? '✅' : '❌'} (${results.players.count})`)
    console.log(`Market Values: ${results.marketValues.found ? '✅' : '❌'} (${results.marketValues.count})`)
    console.log('=' .repeat(50))
    console.log(`Success Rate: ${successRate}%`)
    
    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: totalChecks,
        passed: passedChecks,
        failed: totalChecks - passedChecks,
        successRate: parseFloat(successRate)
      }
    })
    
  } catch (error) {
    console.error('❌ Database verification error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
