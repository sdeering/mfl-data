import { supabase, TABLES } from '../lib/supabase'
import type { MFLMatch, MFLPlayer, MFLClub } from '../types/mflApi'

/**
 * Optimized data service for Supabase operations
 * Implements connection pooling, query optimization, and caching
 */
class SupabaseDataService {
  private queryCache = new Map<string, { data: any; timestamp: number; ttl: number }>()
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  /**
   * Get cached data or fetch from database
   */
  private async getCachedData<T>(
    cacheKey: string,
    queryFn: () => Promise<T>,
    ttl: number = this.CACHE_TTL
  ): Promise<T> {
    const cached = this.queryCache.get(cacheKey)
    const now = Date.now()

    if (cached && (now - cached.timestamp) < cached.ttl) {
      return cached.data
    }

    const data = await queryFn()
    this.queryCache.set(cacheKey, { data, timestamp: now, ttl })
    return data
  }

  /**
   * Clear cache for specific key or all cache
   */
  clearCache(cacheKey?: string) {
    if (cacheKey) {
      this.queryCache.delete(cacheKey)
    } else {
      this.queryCache.clear()
    }
  }

  /**
   * Get market values for agency players
   */
  async getAgencyPlayerMarketValues(walletAddress: string) {
    const cacheKey = `agency_market_values_${walletAddress}`
    
    return this.getCachedData(cacheKey, async () => {
      try {
        const { data, error } = await supabase
          .from(TABLES.MARKET_VALUES)
          .select('*')
          .eq('wallet_address', walletAddress)
          .order('market_value', { ascending: false })

        if (error) {
          // Check if it's a table not found error
          if (error.code === 'PGRST116' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
            console.log('📊 Market values table does not exist yet, returning empty array')
            return []
          }
          console.error('Error fetching agency player market values:', error)
          throw error
        }

        console.log(`📊 Fetched market values from database: ${data?.length || 0} players`)
        return data || []
      } catch (error) {
        // If there's any other error (like network issues), return empty array instead of throwing
        console.warn('Warning: Could not fetch market values, returning empty array:', error)
        return []
      }
    })
  }

  /**
   * Get user information
   */
  async getUserInfo(walletAddress: string) {
    const cacheKey = `user_${walletAddress}`
    
    return this.getCachedData(cacheKey, async () => {
      const { data, error } = await supabase
        .from(TABLES.USERS)
        .select('*')
        .eq('wallet_address', walletAddress)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error
      }

      return data?.data || null
    })
  }

  /**
   * Get clubs for a wallet address
   */
  async getClubsForWallet(walletAddress: string): Promise<any[]> {
    const cacheKey = `clubs_${walletAddress}`
    
    return this.getCachedData(cacheKey, async () => {
      console.log('🔍 Querying clubs table for wallet:', walletAddress);
      
      // Try to query with wallet_address filter first (new schema)
      let { data, error } = await supabase
        .from(TABLES.CLUBS)
        .select('*')
        .eq('wallet_address', walletAddress)
        .order('last_synced', { ascending: false })

      // If wallet_address column doesn't exist, fall back to getting all clubs (old schema)
      if (error && (error.message?.includes('column clubs.wallet_address does not exist') || error.message?.includes('column "wallet_address" does not exist'))) {
        console.log('⚠️ wallet_address column not found, falling back to old schema');
        const fallbackResult = await supabase
          .from(TABLES.CLUBS)
          .select('*')
          .order('last_synced', { ascending: false })
        
        data = fallbackResult.data;
        error = fallbackResult.error;
      }

      if (error) {
        console.error('❌ Error querying clubs table:', error);
        throw error;
      }

      const clubs = data || []
      console.log('📊 Found', clubs.length, 'clubs in database for wallet:', walletAddress);

      return clubs
    })
  }

  /**
   * Get agency players for a wallet address
   */
  async getAgencyPlayers(walletAddress: string): Promise<MFLPlayer[]> {
    const cacheKey = `agency_players_${walletAddress}`
    
    return this.getCachedData(cacheKey, async () => {
      // Join agency_players with players table to get player data
      const { data, error } = await supabase
        .from(TABLES.AGENCY_PLAYERS)
        .select(`
          mfl_player_id,
          last_synced,
          players!inner(data)
        `)
        .eq('wallet_address', walletAddress)
        .order('last_synced', { ascending: false })

      if (error) throw error

      return data?.map(item => item.players.data) || []
    })
  }

  /**
   * Get matches data for a wallet address
   */
  async getMatchesData(walletAddress: string, matchType?: 'upcoming' | 'previous') {
    const cacheKey = `matches_${walletAddress}_${matchType || 'all'}`
    
    return this.getCachedData(cacheKey, async () => {
      // Filter matches by wallet address directly
      console.log('🔍 Querying matches table for wallet:', walletAddress);
      let query = supabase
        .from(TABLES.MATCHES)
        .select('*')
        .eq('wallet_address', walletAddress)
        .order('last_synced', { ascending: false })

      if (matchType) {
        query = query.eq('match_type', matchType)
      }

      const { data, error } = await query

      if (error) {
        console.error('❌ Error querying matches table:', error);
        throw error;
      }

      const matches = data || []
      console.log('📊 Found', matches.length, 'matches in database for wallet:', walletAddress);

      const upcoming = matches.filter(item => item.match_type === 'upcoming').map(item => item.data) || [];
      const previous = matches.filter(item => item.match_type === 'previous').map(item => item.data) || [];
      
      console.log('📊 Upcoming matches:', upcoming.length, 'Previous matches:', previous.length);

      return {
        upcoming,
        previous
      }
    })
  }

  /**
   * Get upcoming matches for a wallet address
   */
  async getUpcomingMatches(walletAddress: string): Promise<MFLMatch[]> {
    const matchesData = await this.getMatchesData(walletAddress)
    return matchesData.upcoming
  }

  /**
   * Get previous matches for a wallet address
   */
  async getPreviousMatches(walletAddress: string): Promise<MFLMatch[]> {
    const matchesData = await this.getMatchesData(walletAddress)
    return matchesData.previous
  }

  /**
   * Get player by ID (with caching)
   */
  async getPlayer(playerId: string): Promise<MFLPlayer | null> {
    const cacheKey = `player_${playerId}`
    
    return this.getCachedData(cacheKey, async () => {
      const { data, error } = await supabase
        .from(TABLES.PLAYERS)
        .select('data')
        .eq('mfl_player_id', playerId)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      return data?.data || null
    })
  }

  /**
   * Upsert player data
   */
  async upsertPlayer(playerId: string, playerData: MFLPlayer) {
    const { error } = await supabase
      .from(TABLES.PLAYERS)
      .upsert({
        mfl_player_id: playerId,
        data: playerData,
        last_synced: new Date().toISOString()
      })

    if (error) throw error

    // Clear player cache
    this.clearCache(`player_${playerId}`)
  }

  /**
   * Upsert multiple players
   */
  async upsertPlayers(players: Array<{ id: string; data: MFLPlayer }>) {
    if (players.length === 0) return

    const { error } = await supabase
      .from(TABLES.PLAYERS)
      .upsert(players.map(player => ({
        mfl_player_id: player.id,
        data: player.data,
        last_synced: new Date().toISOString()
      })))

    if (error) throw error

    // Clear player caches
    players.forEach(player => {
      this.clearCache(`player_${player.id}`)
    })
  }

  /**
   * Get player progression data
   */
  async getPlayerProgression(playerId: string) {
    const cacheKey = `player_progression_${playerId}`
    
    return this.getCachedData(cacheKey, async () => {
      const { data, error } = await supabase
        .from(TABLES.PLAYER_PROGRESSION)
        .select('data')
        .eq('mfl_player_id', playerId)
        .order('last_synced', { ascending: false })
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      return data?.data || null
    })
  }

  /**
   * Get player sale history
   */
  async getPlayerSaleHistory(playerId: string, limit: number = 25) {
    const cacheKey = `player_sales_${playerId}_${limit}`
    
    return this.getCachedData(cacheKey, async () => {
      const { data, error } = await supabase
        .from(TABLES.PLAYER_SALE_HISTORY)
        .select('data')
        .eq('mfl_player_id', playerId)
        .order('last_synced', { ascending: false })
        .limit(limit)

      if (error) throw error

      return data?.map(item => item.data) || []
    })
  }

  /**
   * Batch operations for better performance
   */
  async batchUpsert(tableName: string, records: any[]) {
    if (records.length === 0) return

    const { error } = await supabase
      .from(tableName)
      .upsert(records)

    if (error) throw error
  }

  /**
   * Get sync status for all data types
   */
  async getSyncStatus(walletAddress: string) {
    const cacheKey = `sync_status_${walletAddress}`
    
    return this.getCachedData(cacheKey, async () => {
      const statusPromises = [
        // Users table has wallet_address
        supabase
          .from(TABLES.USERS)
          .select('last_synced')
          .eq('wallet_address', walletAddress)
          .order('last_synced', { ascending: false })
          .limit(1)
          .maybeSingle(),
        
        // Agency players table has wallet_address
        supabase
          .from(TABLES.AGENCY_PLAYERS)
          .select('last_synced')
          .eq('wallet_address', walletAddress)
          .order('last_synced', { ascending: false })
          .limit(1)
          .maybeSingle(),
        
        // Get latest clubs sync for this wallet
        supabase
          .from(TABLES.CLUBS)
          .select('last_synced')
          .eq('wallet_address', walletAddress)
          .order('last_synced', { ascending: false })
          .limit(1)
          .maybeSingle(),
        
        // Matches table doesn't have wallet_address, get latest
        supabase
          .from(TABLES.MATCHES)
          .select('last_synced')
          .order('last_synced', { ascending: false })
          .limit(1)
          .maybeSingle(),
        
        // Players table doesn't have wallet_address, get latest
        supabase
          .from(TABLES.PLAYERS)
          .select('last_synced')
          .order('last_synced', { ascending: false })
          .limit(1)
          .maybeSingle()
      ]

      const results = await Promise.all(statusPromises)
      const tableNames = [TABLES.USERS, TABLES.AGENCY_PLAYERS, TABLES.CLUBS, TABLES.MATCHES, TABLES.PLAYERS]
      
      return results.reduce((acc, result, index) => {
        const tableName = tableNames[index]
        acc[tableName] = {
          lastSynced: result.data?.last_synced || null,
          error: result.error?.code === 'PGRST116' ? null : result.error
        }
        return acc
      }, {} as Record<string, { lastSynced: string | null; error: any }>)
    })
  }

  /**
   * Optimized query for tactics page data
   */
  async getTacticsPageData(walletAddress: string) {
    const cacheKey = `tactics_data_${walletAddress}`
    
    return this.getCachedData(cacheKey, async () => {
      // Fetch all required data in parallel
      const [clubs, upcomingMatches, previousMatches] = await Promise.all([
        this.getClubsForWallet(walletAddress),
        this.getUpcomingMatches(walletAddress),
        this.getPreviousMatches(walletAddress)
      ])

      return {
        clubs,
        upcomingMatches,
        previousMatches
      }
    })
  }

  /**
   * Optimized query for player page data
   */
  async getPlayerPageData(playerId: string) {
    const cacheKey = `player_page_${playerId}`
    
    return this.getCachedData(cacheKey, async () => {
      // Fetch player data and related information in parallel
      const [player, progression, saleHistory] = await Promise.all([
        this.getPlayer(playerId),
        this.getPlayerProgression(playerId),
        this.getPlayerSaleHistory(playerId, 10)
      ])

      return {
        player,
        progression,
        saleHistory
      }
    })
  }
}

// Export singleton instance
export const supabaseDataService = new SupabaseDataService()