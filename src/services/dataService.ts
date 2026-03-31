import { TABLES } from '../lib/database'
import { selectAll, selectOne, selectMaybeOne, upsertOne, upsertMany } from '../lib/db-helpers'
import type { MFLMatch, MFLPlayer, MFLClub } from '../types/mflApi'

/**
 * Optimized data service for database operations
 * Implements query optimization and caching
 */
class DataService {
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
        console.log(`🔍 Querying market values for agency players for wallet: ${walletAddress}`)

        // First, get the agency players for this wallet
        const { data: agencyPlayers, error: agencyError } = await selectAll(
          TABLES.AGENCY_PLAYERS,
          { columns: ['mfl_player_id'], where: { wallet_address: walletAddress } }
        )

        if (agencyError) {
          console.error('Error fetching agency players:', agencyError)
          throw agencyError
        }

        if (!agencyPlayers || agencyPlayers.length === 0) {
          console.log(`📊 No agency players found for wallet: ${walletAddress}`)
          return []
        }

        const playerIds = agencyPlayers.map((ap: any) => ap.mfl_player_id)
        console.log(`📊 Found ${playerIds.length} agency players for wallet: ${walletAddress}`)

        // Now get market values only for these specific players
        const { data, error } = await selectAll(
          TABLES.MARKET_VALUES,
          {
            where: { mfl_player_id: { in: playerIds } },
            orderBy: { column: 'created_at', ascending: false }
          }
        )

        if (error) {
          if (error.message?.includes('no such table')) {
            console.log('📊 Market values table does not exist yet, returning empty array')
            return []
          }
          console.error('Error fetching market values:', error)
          throw error
        }

        console.log(`📊 Raw market values query result:`, data)
        console.log(`📊 Fetched market values from database: ${data?.length || 0} players for wallet: ${walletAddress}`)

        // Transform the data to match what the agency page expects
        const transformedData = (data || []).map((item: any) => ({
          player_id: item.mfl_player_id,
          market_value: (item.data?.estimatedValue ?? item.data?.market_value ?? 0),
          position_ratings: item.data?.position_ratings || {},
          confidence: item.data?.confidence || 'medium',
          created_at: item.created_at,
          last_calculated: (item.data?.last_calculated ?? item.data?.calculated_at ?? null)
        }));

        return transformedData
      } catch (error) {
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
      const { data, error } = await selectOne(
        TABLES.USERS,
        { where: { wallet_address: walletAddress } }
      )

      if (error && error.code !== 'PGRST116') {
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

      const { data, error } = await selectAll(
        TABLES.CLUBS,
        {
          where: { wallet_address: walletAddress },
          orderBy: { column: 'last_synced', ascending: false }
        }
      )

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
    const AGENCY_PLAYERS_CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

    return this.getCachedData(cacheKey, async () => {
      console.log(`🔍 Querying agency players for wallet: ${walletAddress}`)

      // First get the agency player IDs
      const { data: agencyData, error: agencyError } = await selectAll(
        TABLES.AGENCY_PLAYERS,
        {
          columns: ['mfl_player_id', 'last_synced'],
          where: { wallet_address: walletAddress },
          orderBy: { column: 'last_synced', ascending: false }
        }
      )

      if (agencyError) {
        console.error('❌ Error querying agency players:', agencyError)
        throw agencyError
      }

      if (!agencyData || agencyData.length === 0) {
        console.log(`📊 No agency players found for wallet: ${walletAddress}`)
        return []
      }

      // Get the player IDs
      const playerIds = agencyData.map((item: any) => item.mfl_player_id)

      // Then get the player data
      const { data: playersData, error: playersError } = await selectAll(
        TABLES.PLAYERS,
        { where: { mfl_player_id: { in: playerIds } } }
      )

      if (playersError) {
        console.error('❌ Error querying players data:', playersError)
        throw playersError
      }

      console.log(`📊 Fetched agency players from database: ${agencyData?.length || 0} players`)
      console.log(`📊 Fetched player data: ${playersData?.length || 0} players`)

      const players = playersData?.map((player: any) => player.data) || []
      console.log(`📊 Mapped players data:`, players.length, 'players')

      return players
    }, AGENCY_PLAYERS_CACHE_TTL)
  }

  /**
   * Get matches data for a wallet address
   */
  async getMatchesData(walletAddress: string, matchType?: 'upcoming' | 'previous') {
    const cacheKey = `matches_${walletAddress}_${matchType || 'all'}`

    return this.getCachedData(cacheKey, async () => {
      console.log('🔍 Querying matches table for wallet:', walletAddress);

      const where: Record<string, any> = { wallet_address: walletAddress }
      if (matchType) {
        where.match_type = matchType
      }

      const { data, error } = await selectAll(
        TABLES.MATCHES,
        {
          where,
          orderBy: { column: 'last_synced', ascending: false }
        }
      )

      if (error) {
        console.error('❌ Error querying matches table:', error);
        throw error;
      }

      const matches = data || []
      console.log('📊 Found', matches.length, 'matches in database for wallet:', walletAddress);

      const upcoming = matches.filter((item: any) => item.match_type === 'upcoming').map((item: any) => item.data) || [];
      const previous = matches.filter((item: any) => item.match_type === 'previous').map((item: any) => item.data) || [];

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
    const PLAYER_CACHE_TTL = 6 * 60 * 60 * 1000 // 6 hours

    return this.getCachedData(cacheKey, async () => {
      const { data, error } = await selectOne(
        TABLES.PLAYERS,
        { columns: ['data'], where: { mfl_player_id: playerId } }
      )

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      return data?.data || null
    }, PLAYER_CACHE_TTL)
  }

  /**
   * Upsert player data
   */
  async upsertPlayer(playerId: string, playerData: MFLPlayer) {
    const { error } = await upsertOne(
      TABLES.PLAYERS,
      {
        mfl_player_id: playerId,
        data: playerData,
        last_synced: new Date().toISOString()
      },
      'mfl_player_id'
    )

    if (error) throw error

    // Clear player cache
    this.clearCache(`player_${playerId}`)
  }

  /**
   * Upsert multiple players
   */
  async upsertPlayers(players: Array<{ id: string; data: MFLPlayer }>) {
    if (players.length === 0) return

    const { error } = await upsertMany(
      TABLES.PLAYERS,
      players.map(player => ({
        mfl_player_id: player.id,
        data: player.data,
        last_synced: new Date().toISOString()
      })),
      'mfl_player_id'
    )

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
    const PROGRESSION_CACHE_TTL = 60 * 60 * 1000 // 1 hour

    return this.getCachedData(cacheKey, async () => {
      const { data, error } = await selectOne(
        TABLES.PLAYER_PROGRESSION,
        {
          columns: ['data'],
          where: { mfl_player_id: playerId },
          orderBy: { column: 'last_synced', ascending: false },
          limit: 1
        }
      )

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      return data?.data || null
    }, PROGRESSION_CACHE_TTL)
  }

  /**
   * Get player sale history
   */
  async getPlayerSaleHistory(playerId: string, limit: number = 25) {
    const cacheKey = `player_sales_${playerId}_${limit}`
    const SALE_HISTORY_CACHE_TTL = 60 * 60 * 1000 // 1 hour

    return this.getCachedData(cacheKey, async () => {
      const { data, error } = await selectAll(
        TABLES.PLAYER_SALE_HISTORY,
        {
          columns: ['data'],
          where: { mfl_player_id: playerId },
          orderBy: { column: 'last_synced', ascending: false },
          limit
        }
      )

      if (error) throw error

      return data?.map((item: any) => item.data) || []
    }, SALE_HISTORY_CACHE_TTL)
  }

  /**
   * Batch operations for better performance
   */
  async batchUpsert(tableName: string, records: any[]) {
    if (records.length === 0) return

    // Determine conflict column based on table
    const conflictMap: Record<string, string> = {
      players: 'mfl_player_id',
      users: 'wallet_address',
      clubs: 'mfl_club_id',
      matches: 'mfl_match_id',
      agency_players: 'wallet_address, mfl_player_id',
      market_values: 'mfl_player_id',
      sync_status: 'data_type',
    }
    const onConflict = conflictMap[tableName] || 'id'

    const { error } = await upsertMany(tableName, records, onConflict)
    if (error) throw error
  }

  /**
   * Get sync status for all data types
   */
  async getSyncStatus(walletAddress: string) {
    const cacheKey = `sync_status_${walletAddress}`

    return this.getCachedData(cacheKey, async () => {
      const tables = [
        { table: TABLES.USERS, where: { wallet_address: walletAddress } },
        { table: TABLES.AGENCY_PLAYERS, where: { wallet_address: walletAddress } },
        { table: TABLES.CLUBS, where: { wallet_address: walletAddress } },
        { table: TABLES.MATCHES, where: undefined },
        { table: TABLES.PLAYERS, where: undefined },
      ]

      const results = await Promise.all(
        tables.map(({ table, where }) =>
          selectMaybeOne(table, {
            columns: ['last_synced'],
            where,
            orderBy: { column: 'last_synced', ascending: false },
            limit: 1
          })
        )
      )

      const tableNames = tables.map(t => t.table)

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
export const dataService = new DataService()

// Backward-compatible alias
export const supabaseDataService = dataService
