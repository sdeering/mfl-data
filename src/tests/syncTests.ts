/**
 * Comprehensive Sync Tests
 * Tests the sync functionality using real wallet data from 0x95dc70d7d39f6f76
 */

import { supabase, TABLES } from '../lib/supabase'
import { supabaseSyncService } from '../services/supabaseSyncService'

const TEST_WALLET = '0x95dc70d7d39f6f76'
const SYNC_SERVICE = supabaseSyncService

interface TestResult {
  name: string
  passed: boolean
  error?: string
  details?: any
}

class SyncTestRunner {
  private results: TestResult[] = []

  async runAllTests(): Promise<void> {
    console.log('🧪 Starting comprehensive sync tests...')
    console.log(`📊 Using wallet: ${TEST_WALLET}`)
    
    // Clear any existing test data
    await this.cleanupTestData()
    
    // Run all tests
    await this.testUserInfoSync()
    await this.testClubDataSync()
    await this.testAgencyPlayersSync()
    await this.testMarketValuesSync()
    await this.testFullSyncFlow()
    
    // Report results
    this.reportResults()
  }

  private async cleanupTestData(): Promise<void> {
    console.log('🧹 Cleaning up test data...')
    try {
      // Clear market values for test wallet
      await supabase
        .from(TABLES.MARKET_VALUES)
        .delete()
        .eq('wallet_address', TEST_WALLET)
      
      // Clear agency players for test wallet
      await supabase
        .from(TABLES.AGENCY_PLAYERS)
        .delete()
        .eq('wallet_address', TEST_WALLET)
      
      console.log('✅ Test data cleanup completed')
    } catch (error) {
      console.warn('⚠️ Test data cleanup failed:', error)
    }
  }

  private async testUserInfoSync(): Promise<void> {
    console.log('\n🔍 Testing User Info Sync...')
    
    try {
      const result = await SYNC_SERVICE.syncUserInfo(TEST_WALLET, { forceRefresh: true })
      
      if (result.success) {
        // Verify user info was stored
        const { data: userInfo, error } = await supabase
          .from(TABLES.USER_INFO)
          .select('*')
          .eq('wallet_address', TEST_WALLET)
          .single()
        
        if (error) {
          this.addResult('User Info Sync - Database Check', false, error.message)
        } else if (userInfo) {
          this.addResult('User Info Sync', true, 'User info synced and stored successfully', userInfo)
        } else {
          this.addResult('User Info Sync - Database Check', false, 'No user info found in database')
        }
      } else {
        this.addResult('User Info Sync', false, result.error)
      }
    } catch (error) {
      this.addResult('User Info Sync', false, error instanceof Error ? error.message : 'Unknown error')
    }
  }

  private async testClubDataSync(): Promise<void> {
    console.log('\n🔍 Testing Club Data Sync...')
    
    try {
      const result = await SYNC_SERVICE.syncClubData(TEST_WALLET, { forceRefresh: true })
      
      if (result.success) {
        // Verify clubs were stored
        const { data: clubs, error } = await supabase
          .from(TABLES.CLUBS)
          .select('*')
          .eq('wallet_address', TEST_WALLET)
        
        if (error) {
          this.addResult('Club Data Sync - Database Check', false, error.message)
        } else if (clubs && clubs.length > 0) {
          this.addResult('Club Data Sync', true, `Synced ${clubs.length} clubs successfully`, clubs)
        } else {
          this.addResult('Club Data Sync - Database Check', false, 'No clubs found in database')
        }
      } else {
        this.addResult('Club Data Sync', false, result.error)
      }
    } catch (error) {
      this.addResult('Club Data Sync', false, error instanceof Error ? error.message : 'Unknown error')
    }
  }

  private async testAgencyPlayersSync(): Promise<void> {
    console.log('\n🔍 Testing Agency Players Sync...')
    
    try {
      const result = await SYNC_SERVICE.syncAgencyPlayers(TEST_WALLET, { forceRefresh: true })
      
      if (result.success) {
        // Verify agency players were stored
        const { data: agencyPlayers, error } = await supabase
          .from(TABLES.AGENCY_PLAYERS)
          .select('*')
          .eq('wallet_address', TEST_WALLET)
        
        if (error) {
          this.addResult('Agency Players Sync - Database Check', false, error.message)
        } else if (agencyPlayers && agencyPlayers.length > 0) {
          this.addResult('Agency Players Sync', true, `Synced ${agencyPlayers.length} agency players successfully`, agencyPlayers.slice(0, 3))
          
          // Verify players table was populated
          const { data: players, error: playersError } = await supabase
            .from(TABLES.PLAYERS)
            .select('*')
            .limit(5)
          
          if (playersError) {
            this.addResult('Agency Players Sync - Players Table Check', false, playersError.message)
          } else if (players && players.length > 0) {
            this.addResult('Agency Players Sync - Players Table Check', true, `Players table populated with ${players.length} players`, players)
          } else {
            this.addResult('Agency Players Sync - Players Table Check', false, 'Players table not populated')
          }
        } else {
          this.addResult('Agency Players Sync - Database Check', false, 'No agency players found in database')
        }
      } else {
        this.addResult('Agency Players Sync', false, result.error)
      }
    } catch (error) {
      this.addResult('Agency Players Sync', false, error instanceof Error ? error.message : 'Unknown error')
    }
  }

  private async testMarketValuesSync(): Promise<void> {
    console.log('\n🔍 Testing Market Values Sync...')
    
    try {
      const result = await SYNC_SERVICE.syncAgencyPlayerMarketValues(TEST_WALLET, { forceRefresh: true })
      
      if (result.success) {
        // Verify market values were stored
        const { data: marketValues, error } = await supabase
          .from(TABLES.MARKET_VALUES)
          .select('*')
          .eq('wallet_address', TEST_WALLET)
          .order('market_value', { ascending: false })
        
        if (error) {
          this.addResult('Market Values Sync - Database Check', false, error.message)
        } else if (marketValues && marketValues.length > 0) {
          this.addResult('Market Values Sync', true, `Synced ${marketValues.length} market values successfully`, marketValues.slice(0, 3))
          
          // Verify market values are reasonable
          const validValues = marketValues.filter(mv => mv.market_value > 0 && mv.market_value < 1000000)
          if (validValues.length === marketValues.length) {
            this.addResult('Market Values Sync - Value Validation', true, 'All market values are within reasonable range')
          } else {
            this.addResult('Market Values Sync - Value Validation', false, `Some market values are invalid: ${marketValues.length - validValues.length} out of ${marketValues.length}`)
          }
        } else {
          this.addResult('Market Values Sync - Database Check', false, 'No market values found in database')
        }
      } else {
        this.addResult('Market Values Sync', false, result.error)
      }
    } catch (error) {
      this.addResult('Market Values Sync', false, error instanceof Error ? error.message : 'Unknown error')
    }
  }

  private async testFullSyncFlow(): Promise<void> {
    console.log('\n🔍 Testing Full Sync Flow...')
    
    try {
      const result = await SYNC_SERVICE.syncAllData(TEST_WALLET, { forceRefresh: true })
      
      if (result.success) {
        this.addResult('Full Sync Flow', true, 'Complete sync flow executed successfully')
        
        // Verify all data is present
        const { data: userInfo } = await supabase
          .from(TABLES.USER_INFO)
          .select('*')
          .eq('wallet_address', TEST_WALLET)
          .single()
        
        const { data: clubs } = await supabase
          .from(TABLES.CLUBS)
          .select('*')
          .eq('wallet_address', TEST_WALLET)
        
        const { data: agencyPlayers } = await supabase
          .from(TABLES.AGENCY_PLAYERS)
          .select('*')
          .eq('wallet_address', TEST_WALLET)
        
        const { data: marketValues } = await supabase
          .from(TABLES.MARKET_VALUES)
          .select('*')
          .eq('wallet_address', TEST_WALLET)
        
        const allDataPresent = userInfo && clubs && clubs.length > 0 && agencyPlayers && agencyPlayers.length > 0 && marketValues && marketValues.length > 0
        
        if (allDataPresent) {
          this.addResult('Full Sync Flow - Data Completeness', true, 'All data types present after full sync', {
            userInfo: !!userInfo,
            clubs: clubs?.length || 0,
            agencyPlayers: agencyPlayers?.length || 0,
            marketValues: marketValues?.length || 0
          })
        } else {
          this.addResult('Full Sync Flow - Data Completeness', false, 'Some data missing after full sync', {
            userInfo: !!userInfo,
            clubs: clubs?.length || 0,
            agencyPlayers: agencyPlayers?.length || 0,
            marketValues: marketValues?.length || 0
          })
        }
      } else {
        this.addResult('Full Sync Flow', false, result.error)
      }
    } catch (error) {
      this.addResult('Full Sync Flow', false, error instanceof Error ? error.message : 'Unknown error')
    }
  }

  private addResult(name: string, passed: boolean, error?: string, details?: any): void {
    this.results.push({ name, passed, error, details })
    const status = passed ? '✅' : '❌'
    console.log(`${status} ${name}: ${passed ? 'PASSED' : 'FAILED'}`)
    if (error) {
      console.log(`   Error: ${error}`)
    }
    if (details) {
      console.log(`   Details:`, details)
    }
  }

  private reportResults(): void {
    console.log('\n📊 Test Results Summary:')
    console.log('=' .repeat(50))
    
    const passed = this.results.filter(r => r.passed).length
    const total = this.results.length
    
    console.log(`Total Tests: ${total}`)
    console.log(`Passed: ${passed}`)
    console.log(`Failed: ${total - passed}`)
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`)
    
    if (total - passed > 0) {
      console.log('\n❌ Failed Tests:')
      this.results.filter(r => !r.passed).forEach(result => {
        console.log(`  - ${result.name}: ${result.error}`)
      })
    }
    
    console.log('\n' + '=' .repeat(50))
  }

  getResults(): TestResult[] {
    return this.results
  }
}

export { SyncTestRunner, TEST_WALLET }
