/**
 * One-time data migration script: Supabase -> Turso
 *
 * Usage: npx tsx scripts/migrate-from-supabase.ts
 *
 * Requires old Supabase env vars still set:
 *   SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY
 *
 * And new Turso env vars:
 *   TURSO_DATABASE_URL
 *   TURSO_AUTH_TOKEN
 */

import 'dotenv/config'

// Tables to migrate (order matters for any FK-like relationships)
const TABLES_TO_MIGRATE = [
  'users',
  'players',
  'agency_players',
  'clubs',
  'matches',
  'opponent_matches',
  'player_sale_history',
  'player_progression',
  'squad_ids',
  'match_formations',
  'competitions',
  'team_statistics',
  'player_ratings',
  'market_values',
  'transfer_history',
  'seasons',
  'league_standings',
  'sync_status',
  'squads',
  'api_usage_daily',
]

async function main() {
  console.log('🔄 Starting Supabase → Turso migration...\n')

  // Connect to Supabase (source)
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase env vars (SUPABASE_URL, SUPABASE_ANON_KEY)')
    process.exit(1)
  }

  // Use raw fetch to read from Supabase REST API (PostgREST)
  const supabaseFetch = async (table: string) => {
    const res = await fetch(`${supabaseUrl}/rest/v1/${table}?select=*`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      }
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Supabase fetch failed for ${table}: ${res.status} ${text}`)
    }
    return res.json()
  }

  // Connect to Turso (destination)
  const { initializeSchema } = await import('../src/lib/schema')
  const { upsertMany } = await import('../src/lib/db-helpers')

  // Initialize schema
  console.log('📦 Initializing Turso schema...')
  await initializeSchema()
  console.log('✅ Schema initialized\n')

  // Migrate each table
  let totalRows = 0

  for (const table of TABLES_TO_MIGRATE) {
    try {
      console.log(`📋 Migrating ${table}...`)
      const rows = await supabaseFetch(table)

      if (!rows || rows.length === 0) {
        console.log(`   ⏭️  ${table}: 0 rows (skipped)`)
        continue
      }

      // For api_usage_daily, the primary key is composite (date, source, endpoint)
      // For other tables, determine the conflict column
      let onConflict = 'id'
      if (table === 'api_usage_daily') onConflict = 'date, source, endpoint'
      else if (table === 'users') onConflict = 'wallet_address'
      else if (table === 'players' || table === 'player_ratings' || table === 'market_values') onConflict = 'mfl_player_id'
      else if (table === 'clubs') onConflict = 'mfl_club_id'
      else if (table === 'matches') onConflict = 'mfl_match_id'
      else if (table === 'agency_players') onConflict = 'wallet_address, mfl_player_id'
      else if (table === 'opponent_matches') onConflict = 'opponent_squad_id, match_limit'
      else if (table === 'squad_ids') onConflict = 'mfl_club_id, mfl_squad_id'
      else if (table === 'match_formations') onConflict = 'mfl_match_id'
      else if (table === 'competitions') onConflict = 'mfl_competition_id'
      else if (table === 'transfer_history') onConflict = 'mfl_transfer_id'
      else if (table === 'seasons') onConflict = 'mfl_season_id'
      else if (table === 'sync_status') onConflict = 'data_type'
      else if (table === 'squads') onConflict = 'wallet_address, squad_name'

      // Upsert in batches of 100
      const batchSize = 100
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize)
        const { error } = await upsertMany(table, batch, onConflict)
        if (error) {
          console.error(`   ❌ Error inserting batch for ${table}:`, error.message)
        }
      }

      totalRows += rows.length
      console.log(`   ✅ ${table}: ${rows.length} rows migrated`)
    } catch (error: any) {
      console.error(`   ❌ Failed to migrate ${table}:`, error.message)
    }
  }

  console.log(`\n🎉 Migration complete! ${totalRows} total rows migrated.`)
}

main().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
