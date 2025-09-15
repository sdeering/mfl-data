/**
 * Direct test runner for sync functionality
 * This script runs the sync tests and reports results
 */

const { createClient } = require('@supabase/supabase-js')

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

const TEST_WALLET = '0x95dc70d7d39f6f76'

// Import the sync service (we'll need to adapt this for Node.js)
async function runTests() {
  console.log('🧪 Starting sync tests...')
  console.log(`📊 Using wallet: ${TEST_WALLET}`)
  
  // Test 1: Check database connection
  console.log('\n🔍 Testing database connection...')
  try {
    const { data, error } = await supabase
      .from('user_info')
      .select('count')
      .limit(1)
    
    if (error) {
      console.log('❌ Database connection failed:', error.message)
      return
    }
    console.log('✅ Database connection successful')
  } catch (error) {
    console.log('❌ Database connection error:', error.message)
    return
  }
  
  // Test 2: Check if we have any existing data
  console.log('\n🔍 Checking existing data...')
  
  const { data: userInfo } = await supabase
    .from('user_info')
    .select('*')
    .eq('wallet_address', TEST_WALLET)
    .single()
  
  const { data: clubs } = await supabase
    .from('clubs')
    .select('*')
    .eq('wallet_address', TEST_WALLET)
  
  const { data: agencyPlayers } = await supabase
    .from('agency_players')
    .select('*')
    .eq('wallet_address', TEST_WALLET)
  
  const { data: marketValues } = await supabase
    .from('market_values')
    .select('*')
    .eq('wallet_address', TEST_WALLET)
  
  console.log('📊 Current data status:')
  console.log(`  User Info: ${userInfo ? '✅ Present' : '❌ Missing'}`)
  console.log(`  Clubs: ${clubs ? `${clubs.length} found` : '❌ None'}`)
  console.log(`  Agency Players: ${agencyPlayers ? `${agencyPlayers.length} found` : '❌ None'}`)
  console.log(`  Market Values: ${marketValues ? `${marketValues.length} found` : '❌ None'}`)
  
  // Test 3: Check players table
  console.log('\n🔍 Checking players table...')
  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('*')
    .limit(5)
  
  if (playersError) {
    console.log('❌ Players table error:', playersError.message)
  } else {
    console.log(`✅ Players table accessible, ${players ? players.length : 0} sample records`)
    if (players && players.length > 0) {
      console.log('📋 Sample player structure:', JSON.stringify(players[0], null, 2))
    }
  }
  
  // Test 4: Check agency players structure
  if (agencyPlayers && agencyPlayers.length > 0) {
    console.log('\n🔍 Checking agency players structure...')
    const sampleAgencyPlayer = agencyPlayers[0]
    console.log('📋 Sample agency player structure:', JSON.stringify(sampleAgencyPlayer, null, 2))
    
    // Check if it has the expected nested structure
    if (sampleAgencyPlayer.player && sampleAgencyPlayer.player.data) {
      console.log('✅ Agency player has nested player data structure')
      console.log('📋 Sample player data:', JSON.stringify(sampleAgencyPlayer.player.data, null, 2))
    } else {
      console.log('❌ Agency player missing nested player data structure')
    }
  }
  
  console.log('\n📊 Test Summary:')
  console.log('=' .repeat(50))
  console.log('Database connection: ✅')
  console.log(`User info: ${userInfo ? '✅' : '❌'}`)
  console.log(`Clubs: ${clubs && clubs.length > 0 ? '✅' : '❌'}`)
  console.log(`Agency players: ${agencyPlayers && agencyPlayers.length > 0 ? '✅' : '❌'}`)
  console.log(`Market values: ${marketValues && marketValues.length > 0 ? '✅' : '❌'}`)
  console.log('=' .repeat(50))
}

// Run the tests
runTests().catch(console.error)
