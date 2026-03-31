import { NextResponse } from 'next/server'
import { countWhere, executeRaw } from '../../../../src/lib/db-helpers'

export async function GET() {
  try {
    // Health check
    const healthCheck = await executeRaw('SELECT 1')
    const healthy = healthCheck.error === null

    // Count rows in key tables
    const tableNames = ['users', 'players', 'agency_players', 'clubs', 'matches', 'market_values', 'sync_status'] as const
    const counts = await Promise.all(
      tableNames.map(table => countWhere(table))
    )

    const tables: Record<string, number | null> = {}
    tableNames.forEach((name, index) => {
      tables[name] = counts[index].data
    })

    return NextResponse.json({ healthy, tables })
  } catch (error: any) {
    console.error('Error in /api/data/db-stats:', error)
    return NextResponse.json({ healthy: false, error: error.message }, { status: 500 })
  }
}
