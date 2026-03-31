import { NextRequest, NextResponse } from 'next/server'
import { TABLES } from '../../../src/lib/database'
import { selectAll, selectWithJoin } from '../../../src/lib/db-helpers'

const TEST_WALLET = '0x95dc70d7d39f6f76'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Debug: Checking players table structure...')
    
    // Check players table
    const { data: players, error: playersError } = await selectAll(TABLES.PLAYERS, { limit: 5 })

    if (playersError) {
      return NextResponse.json({
        success: false,
        error: playersError.message
      })
    }

    // Check agency players with their related player data
    const { data: agencyPlayers, error: agencyError } = await selectWithJoin({
      from: TABLES.AGENCY_PLAYERS,
      join: { table: TABLES.PLAYERS, as: 'player', on: 'mfl_player_id' },
      where: { wallet_address: TEST_WALLET },
      limit: 5
    })

    if (agencyError) {
      return NextResponse.json({
        success: false,
        error: agencyError.message
      })
    }
    
    return NextResponse.json({
      success: true,
      playersTable: {
        count: players?.length || 0,
        sample: players?.[0] || null
      },
      agencyPlayersWithRelations: {
        count: agencyPlayers?.length || 0,
        sample: agencyPlayers?.[0] || null
      }
    })
    
  } catch (error) {
    console.error('❌ Debug players error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
