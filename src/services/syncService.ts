import { TABLES, CACHE_DURATIONS, SYNC_STATUS, type SyncStatus } from '../lib/database'
import { selectAll, selectMaybeOne, upsertOne, upsertMany, countWhere, deleteWhere, selectWithJoin, executeRaw } from '../lib/db-helpers'
import { matchesService } from './matchesService'
import { clubsService } from './clubsService'
import { mflApi } from './mflApi'
import { dataService } from './dataService'
import { calculateAllPositionOVRs } from '../utils/ruleBasedPositionCalculator'
import { marketValueCache } from './marketValueCache'
import { calculateMarketValue } from '../utils/marketValueCalculator'
import { fetchMarketData } from './marketDataService'
import { fetchPlayerSaleHistory } from './playerSaleHistoryService'
import { fetchPlayerExperienceHistory, processProgressionData } from './playerExperienceService'
import { fetchPlayerMatches } from './playerMatchesService'

export interface SyncProgress {
  dataType: string
  status: SyncStatus
  progress: number
  message: string
  error?: string
}

export interface SyncOptions {
  forceRefresh?: boolean
  onProgress?: (progress: SyncProgress) => void
  onComplete?: () => void
  onError?: (error: Error) => void
  maxRetries?: number
  retryDelay?: number
}

class SyncService {
  private isSyncing = false
  private currentProgress: SyncProgress[] = []
  private defaultMaxRetries = 3
  private defaultRetryDelay = 1000 // 1 second
  private connectionAvailable = true
  private syncCancelled = false
  private onProgressCallback?: (progress: SyncProgress) => void
  private abortController?: AbortController

  /**
   * Retry wrapper for async operations
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries?: number,
    retryDelay?: number
  ): Promise<T> {
    const retries = maxRetries ?? this.defaultMaxRetries
    const delay = retryDelay ?? this.defaultRetryDelay

    for (let attempt = 1; attempt <= retries; attempt++) {
      // Check for cancellation before each attempt
      if (this.syncCancelled || this.abortController?.signal.aborted) {
        throw new Error(`${operationName} cancelled by user`)
      }

      try {
        return await operation()
      } catch (error) {
        const isLastAttempt = attempt === retries
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'

        // Don't retry if cancelled
        if (this.syncCancelled || this.abortController?.signal.aborted) {
          throw new Error(`${operationName} cancelled by user`)
        }

        console.warn(`${operationName} failed (attempt ${attempt}/${retries}):`, errorMessage)

        if (isLastAttempt) {
          throw error
        }

        // Wait before retrying (but check for cancellation during wait)
        await new Promise(resolve => {
          const timeoutId = setTimeout(resolve, delay * attempt)
          if (this.abortController?.signal) {
            this.abortController.signal.addEventListener('abort', () => {
              clearTimeout(timeoutId)
              resolve(undefined)
            })
          }
        })
      }
    }

    throw new Error(`${operationName} failed after ${retries} attempts`)
  }

  /**
   * Check if data needs to be synced based on cache duration
   */
  private needsSync(dataType: string, lastSynced: string | null, forceRefresh = false): boolean {
    if (forceRefresh) {
      console.log(`🔄 Force refresh requested for ${dataType}`)
      return true
    }

    if (!lastSynced) {
      console.log(`🔄 No previous sync found for ${dataType}`)
      return true
    }

    const cacheDuration = CACHE_DURATIONS[dataType as keyof typeof CACHE_DURATIONS]
    if (!cacheDuration) {
      console.log(`🔄 No cache duration set for ${dataType}`)
      return true
    }

    const lastSyncTime = new Date(lastSynced).getTime()
    const now = Date.now()
    const timeSinceSync = now - lastSyncTime
    const needsSync = timeSinceSync > cacheDuration

    console.log(`🔍 Cache check for ${dataType}:`, {
      lastSynced,
      cacheDuration: `${cacheDuration / (1000 * 60 * 60)} hours`,
      timeSinceSync: `${timeSinceSync / (1000 * 60 * 60)} hours`,
      needsSync
    })

    return needsSync
  }

  /**
   * Update sync status in database
   */
  private async updateSyncStatus(
    dataType: string,
    status: SyncStatus,
    progress = 0,
    errorMessage?: string
  ) {
    try {
      const { error } = await upsertOne(TABLES.SYNC_STATUS, {
        data_type: dataType,
        status,
        progress_percentage: progress,
        last_synced: status === SYNC_STATUS.COMPLETED ? new Date().toISOString() : null,
        error_message: errorMessage || null,
        updated_at: new Date().toISOString()
      }, 'data_type')

      if (error) {
        console.warn(`Warning: Could not update sync status for ${dataType}:`, error.message || 'Unknown error')
        // Don't throw error - continue with sync even if status update fails
      }
    } catch (error) {
      console.warn(`Warning: Could not update sync status for ${dataType}:`, error instanceof Error ? error.message : 'Unknown error')
      // Don't throw error - continue with sync even if status update fails
    }
  }

  /**
   * Update progress callback
   */
  private updateProgress(dataType: string, status: SyncStatus, progress: number, message: string, error?: string) {
    const progressUpdate: SyncProgress = {
      dataType,
      status,
      progress,
      message,
      error
    }

    // Update local progress array
    const existingIndex = this.currentProgress.findIndex(p => p.dataType === dataType)
    if (existingIndex >= 0) {
      this.currentProgress[existingIndex] = progressUpdate
    } else {
      this.currentProgress.push(progressUpdate)
    }

    // Call the progress callback if set
    if (this.onProgressCallback) {
      this.onProgressCallback(progressUpdate)
    }

    // Update database
    this.updateSyncStatus(dataType, status, progress, error)
  }

  /**
   * Sync user information
   */
  private async syncUserInfo(walletAddress: string, options: SyncOptions = {}) {
    const dataType = 'user_info'

    try {
      this.updateProgress(dataType, SYNC_STATUS.IN_PROGRESS, 0, 'Fetching user information...')

      // Check if we need to sync
      const { data: existingUser, error: checkError } = await selectMaybeOne(TABLES.USERS, {
        columns: ['last_synced'],
        where: { wallet_address: walletAddress }
      })

      // If there's an error and it's not "no rows found", log it but continue
      if (checkError && checkError.code !== 'PGRST116') {
        console.warn('Warning: Could not check user sync status:', checkError.message)
      }

      if (!this.needsSync(dataType, existingUser?.last_synced, options.forceRefresh)) {
        this.updateProgress(dataType, SYNC_STATUS.COMPLETED, 100, 'User information is up to date')
        return
      }

      // Fetch user data from MFL API
      const { userService } = await import('./userService')
      const mflUser = await userService.fetchUserByWallet(walletAddress)

      const userData = {
        wallet_address: walletAddress,
        data: mflUser || {},
        last_synced: new Date().toISOString()
      }

      // Upsert user data
      const { error } = await upsertOne(TABLES.USERS, userData, 'wallet_address')

      if (error) throw error

      this.updateProgress(dataType, SYNC_STATUS.COMPLETED, 100, 'User information synced successfully')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Error in syncUserInfo:', error)
      this.updateProgress(dataType, SYNC_STATUS.FAILED, 0, 'Failed to sync user information', errorMessage)
      throw error
    }
  }

  /**
   * Sync player data
   */
  private async syncPlayerData(options: SyncOptions = {}) {
    const dataType = 'player_data'

    try {
      this.updateProgress(dataType, SYNC_STATUS.IN_PROGRESS, 0, 'Fetching player data...')

      // Check if we need to sync
      const { data: existingData, error: checkError } = await selectMaybeOne(TABLES.PLAYERS, {
        columns: ['last_synced'],
        orderBy: { column: 'last_synced', ascending: false },
        limit: 1
      })

      // If there's an error and it's not "no rows found", log it but continue
      if (checkError && checkError.code !== 'PGRST116') {
        console.warn('Warning: Could not check players sync status:', checkError.message)
      }

      if (!this.needsSync(dataType, existingData?.last_synced, options.forceRefresh)) {
        this.updateProgress(dataType, SYNC_STATUS.COMPLETED, 100, 'Player data is up to date')
        return
      }

      // For now, we'll sync player data on-demand when specific players are requested
      // This is more efficient than trying to sync all players at once
      this.updateProgress(dataType, SYNC_STATUS.COMPLETED, 100, 'Player data sync ready (on-demand)')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.updateProgress(dataType, SYNC_STATUS.FAILED, 0, 'Failed to sync player data', errorMessage)
      throw error
    }
  }

  /**
   * Sync upcoming opposition data for tactics analysis (dedicated sync item)
   * REMOVED: This sync has been removed to make sync faster
   */
  private async syncUpcomingOppositionData(walletAddress: string, options: SyncOptions = {}) {
    // Method disabled - upcoming opposition sync removed
    console.log('⚠️ syncUpcomingOppositionData called but is disabled - sync removed to improve performance')
    return
    /* DISABLED CODE - Removed to make sync faster
    const dataType = 'upcoming_opposition'

    try {
      console.log('🔄 Starting upcoming opposition sync for wallet:', walletAddress)
      this.updateProgress(dataType, SYNC_STATUS.IN_PROGRESS, 0, 'Loading upcoming opposition data...')

      // Check if we need to sync
      console.log('🔍 Checking upcoming opposition sync status...')
      const { data: existingData, error: checkError } = await selectMaybeOne(TABLES.SYNC_STATUS, {
        columns: ['last_synced'],
        where: { data_type: dataType }
      })

      // If there's an error and it's not "no rows found", log it but continue
      if (checkError && checkError.code !== 'PGRST116') {
        console.warn('Warning: Could not check upcoming opposition sync status:', checkError.message)
        console.warn('Check error details:', checkError)
      } else {
        console.log('✅ Upcoming opposition sync status check successful')
      }

      if (!this.needsSync(dataType, existingData?.last_synced, options.forceRefresh)) {
        console.log('✅ Upcoming opposition data is up to date, skipping sync')
        this.updateProgress(dataType, SYNC_STATUS.COMPLETED, 100, 'Upcoming opposition data is up to date')
        return
      }

      // Get user's clubs first
      const clubs = await clubsService.fetchClubsForWallet(walletAddress)
      console.log('📊 Found clubs:', clubs?.length || 0)
      if (!clubs || clubs.length === 0) {
        console.log('⚠️ No clubs found for user, skipping upcoming opposition sync')
        this.updateProgress(dataType, SYNC_STATUS.COMPLETED, 100, 'No clubs found for user')
        return
      }

      this.updateProgress(dataType, SYNC_STATUS.IN_PROGRESS, 20, `Processing ${clubs.length} clubs for upcoming opposition data...`)

      const allOpponentData: any[] = []
      let processedClubs = 0

      // First pass: count total opponents across all clubs (limited to 7 per club, next 24 hours only)
      let totalOpponents = 0
      const clubOpponentCounts: number[] = []
      for (const clubData of clubs) {
        const clubId = clubData.club.id.toString()
        const upcomingMatches = await matchesService.fetchUpcomingMatches(clubId)

        if (!upcomingMatches || upcomingMatches.length === 0) {
          console.log(`⚠️ No upcoming matches found for ${clubData.club.name}`)
          clubOpponentCounts.push(0)
          continue
        }

        // Filter to matches in next 24 hours only
        const now = new Date()
        const twentyFourHoursFromNow = new Date(now.getTime() + (24 * 60 * 60 * 1000))

        const matchesInNext24Hours = upcomingMatches.filter(match => {
          if (!match.startDate) return false
          const matchDate = new Date(match.startDate)
          return matchDate >= now && matchDate <= twentyFourHoursFromNow
        })

        const uniqueOpponents = new Set<number>()
        matchesInNext24Hours.forEach(match => {
          const opponentSquadId = match.homeTeamName === clubData.club.name ? match.awaySquad.id : match.homeSquad.id
          uniqueOpponents.add(opponentSquadId)
        })

        // Limit to 7 opponents per club
        const limitedOpponents = Math.min(uniqueOpponents.size, 7)
        clubOpponentCounts.push(limitedOpponents)
        totalOpponents += limitedOpponents
      }

      console.log(`📊 Total upcoming opponents across all clubs (max 7 per club): ${totalOpponents}`)

      // If no opponents to process, skip upcoming opposition sync
      if (totalOpponents === 0) {
        console.log(`⚠️ No upcoming opponents with matches in next 24 hours, skipping upcoming opposition sync`)
        this.updateProgress(dataType, SYNC_STATUS.COMPLETED, 100, 'No upcoming opponents with matches in next 24 hours')
        return
      }

      let totalProcessedOpponents = 0

      for (const clubData of clubs) {
        const clubId = clubData.club.id.toString()
        const upcomingMatches = await matchesService.fetchUpcomingMatches(clubId)

        if (!upcomingMatches || upcomingMatches.length === 0) {
          console.log(`⚠️ No upcoming matches found for ${clubData.club.name}`)
          processedClubs++
          continue
        }

        // Filter to matches in next 24 hours only
        const now = new Date()
        const twentyFourHoursFromNow = new Date(now.getTime() + (24 * 60 * 60 * 1000))

        const matchesInNext24Hours = upcomingMatches.filter(match => {
          if (!match.startDate) return false
          const matchDate = new Date(match.startDate)
          return matchDate >= now && matchDate <= twentyFourHoursFromNow
        })

        console.log(`📅 Found ${matchesInNext24Hours.length} matches in next 24 hours for ${clubData.club.name} (out of ${upcomingMatches.length} total upcoming matches)`)

        // Get unique opponents from matches in next 24 hours only
        const uniqueOpponents = new Set<number>()
        matchesInNext24Hours.forEach(match => {
          const opponentSquadId = match.homeTeamName === clubData.club.name ? match.awaySquad.id : match.homeSquad.id
          uniqueOpponents.add(opponentSquadId)
        })

        // Limit to 7 opponents per club
        const limitedOpponents = Array.from(uniqueOpponents).slice(0, 7)
        console.log(`🏟️ Processing ${limitedOpponents.length} upcoming opponents for ${clubData.club.name} (limited from ${uniqueOpponents.size})`)

        // Fetch opponent data for each unique opponent
        let processedOpponents = 0

        for (const opponentSquadId of limitedOpponents) {
          try {
            console.log(`🔍 Processing upcoming opponent ${totalProcessedOpponents + 1}/${totalOpponents}: squad ${opponentSquadId}`)

            // Update progress for each opponent using total count
            this.updateProgress(dataType, SYNC_STATUS.IN_PROGRESS, Math.round(20 + ((totalProcessedOpponents / totalOpponents) * 60)), `Loading opponent ${totalProcessedOpponents + 1}/${totalOpponents} (next 24h matches) for ${clubData.club.name}...`)

            // Check database first, then cache, then API
            const { opponentMatchesService } = await import('./opponentMatchesService')
            let opponentMatches: any[] = []
            let formations: string[] = []

            // 1. Check if data exists in database and is recent (within 12 hours)
            const dbOpponentData = await opponentMatchesService.getOpponentMatchesData(opponentSquadId, 7)
            if (dbOpponentData) {
              const lastSynced = new Date(dbOpponentData.last_synced)
              const now = new Date()
              const twelveHoursAgo = new Date(now.getTime() - (12 * 60 * 60 * 1000))

              if (lastSynced > twelveHoursAgo) {
                console.log(`🎯 Using database upcoming opponent data for squad ${opponentSquadId} (${dbOpponentData.matches_data?.length || 0} matches)`)
                opponentMatches = dbOpponentData.matches_data || []
                formations = dbOpponentData.formations_data || []
              } else {
                console.log(`⚠️ Database data for upcoming opponent squad ${opponentSquadId} is stale, will fetch fresh data`)
              }
            }

            // 2. If no recent database data, check cache
            if (opponentMatches.length === 0) {
              const cachedOpponentData = matchesService.getCachedOpponentData(opponentSquadId, 7)
              if (cachedOpponentData) {
                console.log(`🎯 Using cached upcoming opponent data for squad ${opponentSquadId}`)
                opponentMatches = cachedOpponentData
              }
            }

            // 3. If no cache data, fetch from API
            if (opponentMatches.length === 0) {
              console.log(`🚀 Fetching fresh upcoming opponent data for squad ${opponentSquadId}`)
              try {
                opponentMatches = await Promise.race([
                  matchesService.fetchOpponentPastMatches(opponentSquadId, 7),
                  new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Timeout after 10 seconds')), 10000)
                  )
                ]) as any[]
              } catch (timeoutError) {
                console.warn(`⏰ Timeout fetching upcoming opponent data for squad ${opponentSquadId}, using empty array`)
                opponentMatches = []
              }
            }

            console.log(`📊 Found ${opponentMatches.length} matches for upcoming opponent ${opponentSquadId}`)

            // Only fetch formations if we don't already have them from database
            if (formations.length === 0 && opponentMatches.length > 0) {
              console.log(`🔍 Fetching formations for ${opponentMatches.length} upcoming opponent matches...`)
              for (const match of opponentMatches) {
                try {
                  // Check if formation is already cached
                  const cachedFormation = matchesService.getCachedFormationData(match.id.toString())
                  if (cachedFormation) {
                    formations.push(cachedFormation)
                  } else {
                    const formation = await matchesService.fetchMatchFormation(match.id.toString())
                    if (formation) {
                      formations.push(formation)
                    }
                  }
                } catch (error) {
                  console.warn(`Failed to fetch formation for match ${match.id}:`, error)
                }
              }
            }

            console.log(`✅ Processed upcoming opponent ${opponentSquadId}: ${opponentMatches.length} matches, ${formations.length} formations`)

            // Only store opponent data if we fetched fresh data (not from database)
            if (opponentMatches.length > 0) {
              allOpponentData.push({
                opponent_squad_id: opponentSquadId,
                match_limit: 7, // Use 7 to match what we're fetching
                matches_data: opponentMatches,
                formations_data: formations,
                last_synced: new Date().toISOString()
              })
            }

            processedOpponents++
            totalProcessedOpponents++

            // Update progress after processing this opponent
            this.updateProgress(dataType, SYNC_STATUS.IN_PROGRESS, Math.round(20 + ((totalProcessedOpponents / totalOpponents) * 60)), `Completed upcoming opponent ${totalProcessedOpponents}/${totalOpponents} (next 24h matches) for ${clubData.club.name}...`)

            // Add a small delay to prevent rate limiting
            await new Promise(resolve => setTimeout(resolve, 500))
          } catch (error) {
            console.warn(`❌ Failed to fetch data for upcoming opponent squad ${opponentSquadId}:`, error)
            processedOpponents++
            totalProcessedOpponents++

            // Update progress even on error
            this.updateProgress(dataType, SYNC_STATUS.IN_PROGRESS, Math.round(20 + ((totalProcessedOpponents / totalOpponents) * 60)), `Failed upcoming opponent ${totalProcessedOpponents}/${totalOpponents} (next 24h matches) for ${clubData.club.name}...`)

            // Add delay even on error to prevent rapid retries
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        }

        processedClubs++
        const progress = 20 + (processedClubs / clubs.length) * 60
        this.updateProgress(dataType, SYNC_STATUS.IN_PROGRESS, progress, `Processed ${processedClubs}/${clubs.length} clubs for upcoming opposition...`)
      }

      this.updateProgress(dataType, SYNC_STATUS.IN_PROGRESS, 80, `Saving ${allOpponentData.length} upcoming opponent records to database...`)

      // Batch upsert opponent matches data
      if (allOpponentData.length > 0) {
        const { error } = await upsertMany(TABLES.OPPONENT_MATCHES, allOpponentData, 'opponent_squad_id,match_limit')

        if (error) {
          console.error('❌ Error saving upcoming opponent data:', error)
          throw error
        }
      }

      this.updateProgress(dataType, SYNC_STATUS.COMPLETED, 100, `Upcoming opposition data synced successfully (${allOpponentData.length} opponents)`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('❌ Error in syncUpcomingOppositionData:', error)
      console.error('Error details:', {
        message: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        error: error,
        errorType: typeof error,
        errorJSON: JSON.stringify(error, null, 2)
      })
      this.updateProgress(dataType, SYNC_STATUS.FAILED, 0, 'Failed to sync upcoming opposition data', errorMessage)
      throw error
    }
    */
  }

  /**
   * Sync opponent matches data for tactics analysis
   */
  private async syncOpponentMatchesData(walletAddress: string, options: SyncOptions = {}) {
    const dataType = 'opponent_matches'

    try {
      console.log('🔄 Starting opponent matches sync for wallet:', walletAddress)
      this.updateProgress(dataType, SYNC_STATUS.IN_PROGRESS, 0, 'Fetching opponent matches data...')

      // Check if we need to sync
      console.log('🔍 Checking opponent matches sync status...')
      const { data: existingData, error: checkError } = await selectMaybeOne(TABLES.OPPONENT_MATCHES, {
        columns: ['last_synced'],
        orderBy: { column: 'last_synced', ascending: false },
        limit: 1
      })

      // If there's an error and it's not "no rows found", log it but continue
      if (checkError && checkError.code !== 'PGRST116') {
        console.warn('Warning: Could not check opponent matches sync status:', checkError.message)
        console.warn('Check error details:', checkError)
      } else {
        console.log('✅ Opponent matches sync status check successful')
      }

      if (!this.needsSync(dataType, existingData?.last_synced, options.forceRefresh)) {
        console.log('✅ Opponent matches data is up to date, skipping sync')
        this.updateProgress(dataType, SYNC_STATUS.COMPLETED, 100, 'Opponent matches data is up to date')
        return
      }

      // Get user's clubs first
      console.log('🔍 Fetching clubs for wallet:', walletAddress)
      const clubs = await clubsService.fetchClubsForWallet(walletAddress)
      console.log('📊 Found clubs:', clubs?.length || 0)
      if (!clubs || clubs.length === 0) {
        console.log('⚠️ No clubs found for user, skipping opponent sync')
        this.updateProgress(dataType, SYNC_STATUS.COMPLETED, 100, 'No clubs found for user')
        return
      }

      this.updateProgress(dataType, SYNC_STATUS.IN_PROGRESS, 20, `Processing ${clubs.length} clubs for opponent data...`)

      const allOpponentData: any[] = []
      let processedClubs = 0

      // First pass: count total opponents across all clubs (limited to 7 per club, next 24 hours only)
      let totalOpponents = 0
      const clubOpponentCounts: number[] = []
      for (const clubData of clubs) {
        const clubId = clubData.club.id.toString()
        const upcomingMatches = await matchesService.fetchUpcomingMatches(clubId)

        // Filter to only matches in the next 24 hours
        const now = new Date()
        const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000)

        const matchesInNext24Hours = upcomingMatches.filter(match => {
          if (!match.matchDate) return false
          const matchDate = new Date(match.matchDate)
          return !isNaN(matchDate.getTime()) && matchDate >= now && matchDate <= next24Hours
        })

        // Debug: Show some match dates to understand the timing
        if (upcomingMatches.length > 0) {
          const firstMatch = upcomingMatches[0]
          if (firstMatch.matchDate) {
            const firstMatchDate = new Date(firstMatch.matchDate)
            if (!isNaN(firstMatchDate.getTime())) {
              console.log(`📅 First pass - Match date debug for ${clubData.club.name}:`, {
                now: now.toISOString(),
                next24Hours: next24Hours.toISOString(),
                firstMatchDate: firstMatchDate.toISOString(),
                timeDiff: firstMatchDate.getTime() - now.getTime(),
                hoursFromNow: (firstMatchDate.getTime() - now.getTime()) / (1000 * 60 * 60)
              })
            } else {
              console.log(`⚠️ Invalid match date for ${clubData.club.name}:`, firstMatch.matchDate)
            }
          } else {
            console.log(`⚠️ No match date found for ${clubData.club.name}`)
          }
        }

        const uniqueOpponents = new Set<number>()
        matchesInNext24Hours.forEach(match => {
          const opponentSquadId = match.homeTeamName === clubData.club.name ? match.awaySquad.id : match.homeSquad.id
          uniqueOpponents.add(opponentSquadId)
        })

        // Limit to 7 opponents per club
        const limitedOpponents = Math.min(uniqueOpponents.size, 7)
        clubOpponentCounts.push(limitedOpponents)
        totalOpponents += limitedOpponents
      }

      console.log(`📊 Total opponents across all clubs (max 7 per club): ${totalOpponents}`)

      // If no opponents to process, skip opponent sync
      if (totalOpponents === 0) {
        console.log(`⚠️ No opponents with matches in next 24 hours, skipping opponent sync`)
        this.updateProgress(dataType, SYNC_STATUS.COMPLETED, 100, 'No opponents with matches in next 24 hours')
        return
      }

      let totalProcessedOpponents = 0

      for (const clubData of clubs) {
        const clubId = clubData.club.id.toString()

        // Fetch upcoming matches for this club
        const upcomingMatches = await matchesService.fetchUpcomingMatches(clubId)

        // Filter to only matches in the next 24 hours
        const now = new Date()
        const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000)

        const matchesInNext24Hours = upcomingMatches.filter(match => {
          if (!match.matchDate) return false
          const matchDate = new Date(match.matchDate)
          return !isNaN(matchDate.getTime()) && matchDate >= now && matchDate <= next24Hours
        })

        // Debug: Show some match dates to understand the timing
        if (upcomingMatches.length > 0) {
          const firstMatch = upcomingMatches[0]
          if (firstMatch.matchDate) {
            const firstMatchDate = new Date(firstMatch.matchDate)
            if (!isNaN(firstMatchDate.getTime())) {
              console.log(`📅 Match date debug for ${clubData.club.name}:`, {
                now: now.toISOString(),
                next24Hours: next24Hours.toISOString(),
                firstMatchDate: firstMatchDate.toISOString(),
                timeDiff: firstMatchDate.getTime() - now.getTime(),
                hoursFromNow: (firstMatchDate.getTime() - now.getTime()) / (1000 * 60 * 60)
              })
            } else {
              console.log(`⚠️ Invalid match date for ${clubData.club.name}:`, firstMatch.matchDate)
            }
          } else {
            console.log(`⚠️ No match date found for ${clubData.club.name}`)
          }
        }

        console.log(`📅 Found ${matchesInNext24Hours.length} matches in next 24 hours for ${clubData.club.name} (out of ${upcomingMatches.length} total upcoming matches)`)

        // Get unique opponents from matches in next 24 hours only
        const uniqueOpponents = new Set<number>()
        matchesInNext24Hours.forEach(match => {
          const opponentSquadId = match.homeTeamName === clubData.club.name ? match.awaySquad.id : match.homeSquad.id
          uniqueOpponents.add(opponentSquadId)
        })

        // Limit to 7 opponents per club
        const limitedOpponents = Array.from(uniqueOpponents).slice(0, 7)
        console.log(`🏟️ Processing ${limitedOpponents.length} opponents for ${clubData.club.name} (limited from ${uniqueOpponents.size})`)

        // Fetch opponent data for each unique opponent
        let processedOpponents = 0

        for (const opponentSquadId of limitedOpponents) {
          try {
            console.log(`🔍 Processing opponent ${totalProcessedOpponents + 1}/${totalOpponents}: squad ${opponentSquadId}`)

            // Update progress for each opponent using total count
            this.updateProgress(dataType, SYNC_STATUS.IN_PROGRESS, Math.round(20 + ((totalProcessedOpponents / totalOpponents) * 60)), `Processing opponent ${totalProcessedOpponents + 1}/${totalOpponents} (next 24h matches) for ${clubData.club.name}...`)

            // Check database first, then cache, then API
            const { opponentMatchesService } = await import('./opponentMatchesService')
            let opponentMatches: any[] = []
            let formations: string[] = []

            // 1. Check if data exists in database and is recent (within 12 hours)
            const dbOpponentData = await opponentMatchesService.getOpponentMatchesData(opponentSquadId, 7)
            if (dbOpponentData) {
              const lastSynced = new Date(dbOpponentData.last_synced)
              const now = new Date()
              const twelveHoursAgo = new Date(now.getTime() - (12 * 60 * 60 * 1000))

              if (lastSynced > twelveHoursAgo) {
                console.log(`🎯 Using database opponent data for squad ${opponentSquadId} (${dbOpponentData.matches_data?.length || 0} matches)`)
                opponentMatches = dbOpponentData.matches_data || []
                formations = dbOpponentData.formations_data || []
              } else {
                console.log(`⚠️ Database data for squad ${opponentSquadId} is stale, will fetch fresh data`)
              }
            }

            // 2. If no recent database data, check cache
            if (opponentMatches.length === 0) {
              const cachedOpponentData = matchesService.getCachedOpponentData(opponentSquadId, 7)
              if (cachedOpponentData) {
                console.log(`🎯 Using cached opponent data for squad ${opponentSquadId}`)
                opponentMatches = cachedOpponentData
              }
            }

            // 3. If no cache data, fetch from API
            if (opponentMatches.length === 0) {
              console.log(`🚀 Fetching fresh opponent data for squad ${opponentSquadId}`)
              try {
                opponentMatches = await Promise.race([
                  matchesService.fetchOpponentPastMatches(opponentSquadId, 7),
                  new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Timeout after 10 seconds')), 10000)
                  )
                ]) as any[]
              } catch (timeoutError) {
                console.warn(`⏰ Timeout fetching opponent data for squad ${opponentSquadId}, using empty array`)
                opponentMatches = []
              }
            }

            console.log(`📊 Found ${opponentMatches.length} matches for opponent ${opponentSquadId}`)

            // Only fetch formations if we don't already have them from database
            if (formations.length === 0 && opponentMatches.length > 0) {
              console.log(`🔍 Fetching formations for ${opponentMatches.length} matches...`)
              for (const match of opponentMatches) {
                try {
                  // Check if formation is already cached
                  const cachedFormation = matchesService.getCachedFormationData(match.id.toString())
                  if (cachedFormation) {
                    console.log(`🎯 Using cached formation for match ${match.id}`)
                    formations.push(cachedFormation)
                  } else {
                    // Fetch formation with shorter timeout
                    const formation = await Promise.race([
                      matchesService.fetchMatchFormation(match.id.toString()),
                      new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Formation timeout after 5 seconds')), 5000)
                      )
                    ]) as string
                    if (formation) {
                      formations.push(formation)
                    }
                  }
                } catch (formationError) {
                  console.warn(`Failed to fetch formation for match ${match.id}:`, formationError)
                }
              }
            }

            console.log(`✅ Processed opponent ${opponentSquadId}: ${opponentMatches.length} matches, ${formations.length} formations`)

            // Only store opponent data if we fetched fresh data (not from database)
            if (opponentMatches.length > 0) {
              allOpponentData.push({
                opponent_squad_id: opponentSquadId,
                match_limit: 7, // Use 7 to match what we're fetching
                matches_data: opponentMatches,
                formations_data: formations,
                last_synced: new Date().toISOString()
              })
            }

            processedOpponents++
            totalProcessedOpponents++

            // Update progress after processing this opponent
            this.updateProgress(dataType, SYNC_STATUS.IN_PROGRESS, Math.round(20 + ((totalProcessedOpponents / totalOpponents) * 60)), `Completed opponent ${totalProcessedOpponents}/${totalOpponents} (next 24h matches) for ${clubData.club.name}...`)

            // Add a small delay to prevent rate limiting
            await new Promise(resolve => setTimeout(resolve, 500))
          } catch (error) {
            console.warn(`❌ Failed to fetch data for opponent squad ${opponentSquadId}:`, error)
            processedOpponents++
            totalProcessedOpponents++

            // Update progress even on error
            this.updateProgress(dataType, SYNC_STATUS.IN_PROGRESS, Math.round(20 + ((totalProcessedOpponents / totalOpponents) * 60)), `Failed opponent ${totalProcessedOpponents}/${totalOpponents} (next 24h matches) for ${clubData.club.name}...`)

            // Add delay even on error to prevent rapid retries
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        }

        processedClubs++
      }

      this.updateProgress(dataType, SYNC_STATUS.IN_PROGRESS, 80, `Saving ${allOpponentData.length} opponent records to database...`)

      // Batch upsert opponent matches data
      if (allOpponentData.length > 0) {
        console.log('💾 Saving opponent data to database:', allOpponentData.length, 'records')
        try {
          const { error } = await upsertMany(TABLES.OPPONENT_MATCHES, allOpponentData, 'opponent_squad_id,match_limit')

          if (error) {
            console.error('❌ Failed to save opponent data:', error)
            console.error('Error details:', {
              message: error.message,
            })
            throw error
          }
          console.log('✅ Successfully saved opponent data to database')
        } catch (dbError) {
          console.error('❌ Database error during opponent data save:', dbError)
          throw dbError
        }
      } else {
        console.log('⚠️ No opponent data to save')
      }

      this.updateProgress(dataType, SYNC_STATUS.COMPLETED, 100, `Opponent matches data synced successfully (${allOpponentData.length} opponents)`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('❌ Opponent matches sync failed:', error)
      console.error('Error details:', {
        message: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        error: error,
        errorType: typeof error,
        errorString: String(error),
        errorJSON: JSON.stringify(error, null, 2)
      })
      this.updateProgress(dataType, SYNC_STATUS.FAILED, 0, 'Failed to sync opponent matches data', errorMessage)
      throw error
    }
  }

  /**
   * Sync matches data
   * REMOVED: This sync has been removed to make sync faster
   */
  private async syncMatchesData(walletAddress: string, options: SyncOptions = {}) {
    // Method disabled - matches data sync removed
    console.log('⚠️ syncMatchesData called but is disabled - sync removed to improve performance')
    return
    /* DISABLED CODE - Removed to make sync faster
    const dataType = 'matches_data'

    try {
      this.updateProgress(dataType, SYNC_STATUS.IN_PROGRESS, 0, 'Fetching matches data...')

      // Check if we need to sync
      console.log(`🔍 Checking sync status for dataType: ${dataType}`)
      const { data: existingData, error: checkError } = await selectMaybeOne(TABLES.SYNC_STATUS, {
        columns: ['*'],
        where: { data_type: dataType }
      })

      console.log('Sync status query result:', { existingData, checkError })

      if (checkError) {
        console.error('❌ Error checking matches data sync status:', checkError)
        console.error('Error details:', {
          message: checkError?.message || 'No message',
          code: checkError?.code || 'No code',
        })
        // Don't throw error, just log and continue with sync
        console.log('⚠️ Continuing with sync despite status check error')
      } else {
        console.log('✅ Matches data sync status check successful')
      }

      if (!this.needsSync(dataType, existingData?.last_synced, options.forceRefresh)) {
        console.log('✅ Matches data is up to date, skipping sync')
        this.updateProgress(dataType, SYNC_STATUS.COMPLETED, 100, 'Matches data is up to date')
        return
      }

      // Get user's clubs first
      const clubs = await clubsService.fetchClubsForWallet(walletAddress)
      if (!clubs || clubs.length === 0) {
        this.updateProgress(dataType, SYNC_STATUS.COMPLETED, 100, 'No clubs found for user')
        return
      }

      this.updateProgress(dataType, SYNC_STATUS.IN_PROGRESS, 20, `Processing ${clubs.length} clubs...`)

      const allMatches: any[] = []
      let processedClubs = 0

      for (const clubData of clubs) {
        const clubId = clubData.club.id.toString()

        // Fetch upcoming matches
        const upcomingMatches = await matchesService.fetchUpcomingMatches(clubId)
        upcomingMatches.forEach(match => {
          allMatches.push({
            mfl_match_id: match.id,
            match_type: 'upcoming',
            wallet_address: walletAddress,
            club_id: clubId,
            data: match,
            last_synced: new Date().toISOString()
          })
        })

        // Fetch past matches
        const pastMatches = await matchesService.fetchPastMatches(clubId)
        pastMatches.forEach(match => {
          allMatches.push({
            mfl_match_id: match.id,
            match_type: 'previous',
            wallet_address: walletAddress,
            club_id: clubId,
            data: match,
            last_synced: new Date().toISOString()
          })
        })

        processedClubs++
        const progress = 20 + (processedClubs / clubs.length) * 60
        this.updateProgress(dataType, SYNC_STATUS.IN_PROGRESS, progress, `Processed ${processedClubs}/${clubs.length} clubs...`)
      }

      this.updateProgress(dataType, SYNC_STATUS.IN_PROGRESS, 80, `Saving ${allMatches.length} matches to database...`)

      // Batch upsert matches
      if (allMatches.length > 0) {
        const { error } = await upsertMany(TABLES.MATCHES, allMatches, 'mfl_match_id')

        if (error) throw error
      }

      this.updateProgress(dataType, SYNC_STATUS.COMPLETED, 100, 'Matches data synced successfully')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.updateProgress(dataType, SYNC_STATUS.FAILED, 0, 'Failed to sync matches data', errorMessage)
      throw error
    }
    */
  }

  /**
   * Sync agency player market values
   */
  private async syncAgencyPlayerMarketValues(walletAddress: string, options: SyncOptions = {}, limit?: number) {
    const dataType = 'agency_player_market_values'
    // Use a wallet-scoped key so 7‑day freshness is per user
    const dataTypeKey = `${dataType}:${walletAddress}`
    const updateMV = (status: SyncStatus, progress: number, message: string, error?: string) =>
      this.updateProgress(dataTypeKey, status, progress, message, error)

    // NEW BACKEND SYNC IMPLEMENTATION
    try {
      // Respect 7-day cache before starting/resuming any backend job
      // Check central sync status timestamp (acts as a coarse-grained gate)
      try {
        const { data: existingStatus } = await selectMaybeOne(TABLES.SYNC_STATUS, {
          columns: ['last_synced'],
          where: { data_type: dataTypeKey }
        })

        if (!this.needsSync(dataType, existingStatus?.last_synced ?? null, options.forceRefresh)) {
          updateMV(SYNC_STATUS.COMPLETED, 100, 'Agency player market values are up to date (≤ 7 days)')
          return
        }
      } catch (gateError) {
        // Non-fatal; continue if status table is unavailable
        console.warn('Warning: Could not check market values sync gate:', gateError)
      }

      console.log('🔄 Starting agency player market values sync for wallet:', walletAddress)
      updateMV(SYNC_STATUS.IN_PROGRESS, 0, 'Loading agency players...')

      // Step 1: Get all agency players
      console.log('🔍 Fetching agency players for market value calculation...')
      const { data: agencyPlayers, error: agencyError } = await selectWithJoin({
        from: TABLES.AGENCY_PLAYERS,
        join: { table: 'players', as: 'player', on: 'mfl_player_id' },
        where: { wallet_address: walletAddress }
      })

      if (agencyError) {
        console.error('❌ Error fetching agency players:', agencyError)
        throw agencyError
      }

      if (!agencyPlayers || agencyPlayers.length === 0) {
        console.log('ℹ️ No agency players found for market value calculation')
        this.updateProgress(dataType, SYNC_STATUS.COMPLETED, 100, 'No agency players found')
        return
      }

      console.log(`📊 Found ${agencyPlayers.length} agency players for market value calculation`)
      updateMV(SYNC_STATUS.IN_PROGRESS, 20, `Found ${agencyPlayers.length} agency players`)

      // Step 2: Check for existing sync jobs first
      updateMV(SYNC_STATUS.IN_PROGRESS, 30, 'Checking for existing sync jobs...')

      const playerIds = agencyPlayers.map(p => p.mfl_player_id.toString())
      const syncLimit = limit // No default limit for production

      // Check if there's already a sync in progress for this wallet
      const existingJobsResponse = await fetch(`/api/sync/player-market-values?walletAddress=${walletAddress}`)
      const existingJobsData = await existingJobsResponse.json()

      let jobId: string
      let isResumed = false

      if (existingJobsData.success && existingJobsData.activeJobs.length > 0) {
        // Resume existing job
        const existingJob = existingJobsData.activeJobs[0]
        jobId = existingJob.jobId
        isResumed = true
        console.log(`🔄 Resuming existing sync job ${jobId} for wallet ${walletAddress}`)
        updateMV(SYNC_STATUS.IN_PROGRESS, 40, `Resuming existing sync (${existingJob.progress}/${existingJob.total})...`)
      } else {
        // Start new sync job
        updateMV(SYNC_STATUS.IN_PROGRESS, 40, 'Starting backend market value sync...')
        console.log(`🚀 Starting new backend sync for ${playerIds.length} players${syncLimit ? ` (limited to ${syncLimit})` : ' (no limit)'}`)

        const response = await fetch('/api/sync/player-market-values', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            walletAddress,
            playerIds,
            forceRecalculate: false, // Respect 7-day cache by default
            limit: syncLimit
          })
        })

        if (!response.ok) {
          throw new Error(`Backend sync failed: ${response.statusText}`)
        }

        const responseData = await response.json()
        jobId = responseData.jobId
        console.log(`✅ Backend sync job started: ${jobId}`)
      }

      updateMV(SYNC_STATUS.IN_PROGRESS, 60, `Backend sync ${isResumed ? 'resumed' : 'started'} for ${playerIds.length} players`)

      // Step 3: Poll for completion
      let completed = false
      let attempts = 0
      const maxAttempts = 600 // 5 minutes max (500ms intervals)

      while (!completed && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 500)) // Wait 500ms for faster updates
        attempts++

        try {
          const statusResponse = await fetch(`/api/sync/player-market-values?jobId=${jobId}`)
          if (statusResponse.ok) {
            const status = await statusResponse.json()

            const progress = 60 + (status.percentage * 0.4) // 60-100% range
            updateMV(SYNC_STATUS.IN_PROGRESS, Math.round(progress), status.currentPlayer || `Processing ${status.progress}/${status.total} players`)

            if (status.status === 'completed') {
              console.log('✅ Backend market value sync completed:', status.results)
              updateMV(SYNC_STATUS.COMPLETED, 100, `Market value sync completed for ${status.results.filter((r: any) => r.success).length} players`)
              completed = true
            } else if (status.status === 'failed') {
              throw new Error(`Backend sync failed: ${status.error}`)
            }
          }
        } catch (error) {
          console.warn('⚠️ Error polling sync status:', error)
        }
      }

      if (!completed) {
        throw new Error('Backend sync timed out')
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('❌ Error in syncAgencyPlayerMarketValues:', error)
      updateMV(SYNC_STATUS.FAILED, 0, 'Failed to sync agency player market values', errorMessage)
      throw error
    }

    // OLD FRONTEND SYNC IMPLEMENTATION - COMMENTED OUT
    /*

    try {
      console.log('🔄 Starting agency player market values sync for wallet:', walletAddress)
      this.updateProgress(dataType, SYNC_STATUS.IN_PROGRESS, 0, 'Loading agency players...')

      // Step 1: Get all agency players and ensure they're in the players table
      console.log('🔍 Fetching agency players for market value calculation...')
      const { data: agencyPlayers, error: agencyError } = await selectWithJoin({
        from: TABLES.AGENCY_PLAYERS,
        join: { table: 'players', as: 'player', on: 'mfl_player_id' },
        where: { wallet_address: walletAddress }
      })

      if (agencyError) {
        console.error('❌ Error fetching agency players:', agencyError)
        throw agencyError
      }

      if (!agencyPlayers || agencyPlayers.length === 0) {
        console.log('ℹ️ No agency players found for market value calculation')
        this.updateProgress(dataType, SYNC_STATUS.COMPLETED, 100, 'No agency players found')
        return
      }

      console.log(`📊 Found ${agencyPlayers.length} agency players for market value calculation`)
      this.updateProgress(dataType, SYNC_STATUS.IN_PROGRESS, 10, `Found ${agencyPlayers.length} agency players`)

      // Sort players by overall rating (highest first) for better market value calculation
      const sortedAgencyPlayers = agencyPlayers.sort((a, b) => {
        const aOverall = a.player?.data?.metadata?.overall || 0;
        const bOverall = b.player?.data?.metadata?.overall || 0;
        return bOverall - aOverall; // Descending order (highest first)
      });

      // Apply limit if specified (to protect API from being overwhelmed)
      const playersToProcess = limit ? sortedAgencyPlayers.slice(0, limit) : sortedAgencyPlayers;

      console.log(`📊 Sorted ${sortedAgencyPlayers.length} players by overall rating (highest first)`)
      if (limit) {
        console.log(`🔒 LIMITED TO ${limit} players to protect API (from ${sortedAgencyPlayers.length} total)`)
      }
      const topPlayers = playersToProcess.slice(0, 5).map(p =>
        `${p.player?.data?.metadata?.firstName} ${p.player?.data?.metadata?.lastName} (${p.player?.data?.metadata?.overall})`
      );
      console.log(`🏆 Top 5 players by rating: ${topPlayers.join(', ')}`);

      // Note: Agency players should already be in the players table from the agency players sync
      // We just need to verify they exist and have data
      console.log(`✅ Using existing players from agency players sync (${playersToProcess.length} players)`)

      // Step 2: Calculate position ratings for all players
      this.updateProgress(dataType, SYNC_STATUS.IN_PROGRESS, 20, 'Calculating player position ratings...')
      const positionRatingsMap = new Map<number, any>()

      for (let i = 0; i < playersToProcess.length; i++) {
        const player = playersToProcess[i]
        const progress = 20 + (i / playersToProcess.length) * 30
        // Check if player data exists and has metadata
        if (!player.player || !player.player.data) {
          console.warn(`⚠️ Skipping player ${player.mfl_player_id} - no player data found`)
          continue
        }

        const playerData = player.player.data
        const playerMetadata = playerData.metadata
        this.updateProgress(dataType, SYNC_STATUS.IN_PROGRESS, Math.round(progress), `Calculating position ratings for ${playerMetadata.firstName} ${playerMetadata.lastName}...`)

        try {
          console.log(`📊 Calculating position ratings for ${playerMetadata.firstName} ${playerMetadata.lastName}...`)

          const playerForOVR = {
            id: player.mfl_player_id,
            name: `${playerMetadata.firstName} ${playerMetadata.lastName}`,
            overall: playerMetadata.overall,
            positions: playerMetadata.positions,
            attributes: {
              PAC: playerMetadata.pace,
              SHO: playerMetadata.shooting,
              PAS: playerMetadata.passing,
              DRI: playerMetadata.dribbling,
              DEF: playerMetadata.defense,
              PHY: playerMetadata.physical,
              GK: playerMetadata.goalkeeping
            }
          }

          const positionRatingsResult = calculateAllPositionOVRs(playerForOVR)

          if (positionRatingsResult.success) {
            positionRatingsMap.set(player.mfl_player_id, positionRatingsResult.results)
            console.log(`✅ Position ratings calculated for ${playerMetadata.firstName} ${playerMetadata.lastName}`)
          } else {
            console.warn(`⚠️ Failed to calculate position ratings for ${playerMetadata.firstName} ${playerMetadata.lastName}:`, positionRatingsResult.error)
            positionRatingsMap.set(player.mfl_player_id, null)
          }
        } catch (error) {
          console.error(`❌ Error calculating position ratings for player ${player.mfl_player_id}:`, error)
          positionRatingsMap.set(player.mfl_player_id, null)
        }
      }

      console.log(`✅ Position ratings calculated for ${playersToProcess.length} players`)

      // Step 3: Calculate and store market values one by one (highest rated players first)
      this.updateProgress(dataType, SYNC_STATUS.IN_PROGRESS, 50, 'Calculating market values...')

      let processedPlayers = 0
      console.log(`🔍 Starting market value calculation loop for ${playersToProcess.length} players (highest rated first)`)

      // Check for existing market values to determine starting point
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Get all existing market values for this wallet to see which players are already processed
      const { data: existingMarketValues, error: existingError } = await selectAll(TABLES.MARKET_VALUES, {
        columns: ['mfl_player_id', 'created_at'],
        where: { created_at: { gte: sevenDaysAgo.toISOString() } }
      })

      const existingPlayerIds = new Set<number>();
      if (existingMarketValues && !existingError) {
        existingMarketValues.forEach(mv => {
          existingPlayerIds.add(mv.mfl_player_id);
        });
        console.log(`📊 Found ${existingPlayerIds.size} players with recent market values, will skip them`);
      }

      // Find the starting index (first player without a recent market value)
      let startIndex = 0;
      for (let i = 0; i < playersToProcess.length; i++) {
        if (!existingPlayerIds.has(playersToProcess[i].mfl_player_id)) {
          startIndex = i;
          break;
        }
      }

      if (startIndex > 0) {
        console.log(`🔄 Resuming market value calculation from player ${startIndex + 1}/${playersToProcess.length} (${existingPlayerIds.size} already processed)`);
        this.updateProgress(dataType, SYNC_STATUS.IN_PROGRESS, 50 + (startIndex / playersToProcess.length) * 45, `Resuming from player ${startIndex + 1}/${playersToProcess.length}...`);
      }

      for (let i = startIndex; i < playersToProcess.length; i++) {
        const player = playersToProcess[i]
        const progress = 50 + (i / playersToProcess.length) * 45

        console.log(`🔍 Processing player ${i + 1}/${playersToProcess.length}: ${player.mfl_player_id}`)

        // Check if player data exists and has metadata
        if (!player.player || !player.player.data) {
          console.warn(`⚠️ Skipping market value calculation for player ${player.mfl_player_id} - no player data found`)
          console.log(`🔍 Player structure: hasPlayer=${!!player.player}, hasData=${!!(player.player?.data)}`)
          continue
        }

        const playerData = player.player.data
        const playerMetadata = playerData.metadata
        this.updateProgress(dataType, SYNC_STATUS.IN_PROGRESS, Math.round(progress), `Calculating market value for ${playerMetadata.firstName} ${playerMetadata.lastName} (${i + 1}/${playersToProcess.length})...`)

        try {
          console.log(`💰 Calculating market value for ${playerMetadata.firstName} ${playerMetadata.lastName} (${i + 1}/${playersToProcess.length})`)
          const positionRatings = positionRatingsMap.get(player.mfl_player_id)

          // Check cache as fallback
          let marketValue = marketValueCache.get(player.mfl_player_id)

          if (marketValue === null) {
            console.log(`🔍 Market value not in cache for ${playerMetadata.firstName} ${playerMetadata.lastName}, calculating...`)

            // Fetch market data for comparison (same parameters as player page)
            const searchParams = {
              positions: playerMetadata.positions,
              ageMin: Math.max(1, playerMetadata.age - 1),
              ageMax: Math.min(50, playerMetadata.age + 1),
              overallMin: Math.max(1, playerMetadata.overall - 1),
              overallMax: Math.min(99, playerMetadata.overall + 1),
              limit: 50
            }

            let marketData;
            if (marketDataApiFailures < maxMarketDataFailures) {
              marketData = await fetchMarketData(searchParams)

              if (!marketData.success) {
                marketDataApiFailures++;
                console.warn(`⚠️ Market data fetch failed for ${playerMetadata.firstName} ${playerMetadata.lastName} (${marketDataApiFailures}/${maxMarketDataFailures}): ${marketData.error}`);

                if (marketDataApiFailures >= maxMarketDataFailures) {
                  console.warn(`⚠️ Market data API has failed ${maxMarketDataFailures} times, skipping market data for remaining players`);
                }
              }
            } else {
              // Skip market data fetch after too many failures
              marketData = { success: false, data: [], error: 'Market data API unavailable' };
            }

            if (marketData.success && marketData.data.length > 0) {
              // Use the comprehensive market value calculator

              // Fetch additional data for accurate calculation (same as player page)
              const [historyResponse, progressionResponse, matchesResponse] = await Promise.all([
                fetchPlayerSaleHistory(player.mfl_player_id.toString()),
                fetchPlayerExperienceHistory(player.mfl_player_id.toString()),
                fetchPlayerMatches(player.mfl_player_id.toString())
              ]);

              // Convert position ratings to the format expected by the calculator
              const positionRatingsForMarketValue = positionRatings
                ? Object.entries(positionRatings).reduce((acc, [position, result]) => {
                    if (result && result.success) {
                      acc[position] = result.ovr
                    }
                    return acc;
                  }, {} as { [position: string]: number })
                : {};

              const marketValueEstimate = calculateMarketValue(
                playerMetadata,
                marketData.data,
                historyResponse.success ? historyResponse.data : [],
                progressionResponse.success ? processProgressionData(progressionResponse.data) : [],
                positionRatingsForMarketValue,
                playerMetadata.retirementYears,
                matchesResponse.success ? matchesResponse.data.length : undefined,
                player.mfl_player_id
              )

              marketValue = Math.round(marketValueEstimate.estimatedValue)
              marketValueCache.set(player.mfl_player_id, marketValue)
              console.log(`💰 Market value calculated for ${playerMetadata.firstName} ${playerMetadata.lastName}: $${marketValue.toLocaleString()}`)
            } else {
              if (marketData.error) {
                console.warn(`⚠️ Market data fetch failed for ${playerMetadata.firstName} ${playerMetadata.lastName}: ${marketData.error}`)
              } else {
                console.warn(`⚠️ No market data found for ${playerMetadata.firstName} ${playerMetadata.lastName}, using fallback calculation`)
              }
              // Enhanced fallback calculation based on multiple factors
              // More sophisticated than simple overall * 5
              let baseValue = 0;

              // Base value by overall rating tiers (more realistic curve)
              if (playerMetadata.overall >= 90) {
                baseValue = 800 + (playerMetadata.overall - 90) * 100; // $800-$1300 for 90+
              } else if (playerMetadata.overall >= 85) {
                baseValue = 400 + (playerMetadata.overall - 85) * 80; // $400-$800 for 85-89
              } else if (playerMetadata.overall >= 80) {
                baseValue = 200 + (playerMetadata.overall - 80) * 40; // $200-$400 for 80-84
              } else if (playerMetadata.overall >= 75) {
                baseValue = 100 + (playerMetadata.overall - 75) * 20; // $100-$200 for 75-79
              } else if (playerMetadata.overall >= 70) {
                baseValue = 50 + (playerMetadata.overall - 70) * 10; // $50-$100 for 70-74
              } else {
                baseValue = Math.max(25, playerMetadata.overall * 3); // $25-$210 for <70
              }

              // Age adjustment (younger players more valuable)
              const ageAdjustment = playerMetadata.age <= 25 ? baseValue * 0.2 :
                                   playerMetadata.age <= 30 ? 0 :
                                   playerMetadata.age <= 35 ? baseValue * -0.1 : baseValue * -0.3;

              // Position premium (attacking positions more valuable)
              const positionPremium = playerMetadata.positions.some(pos => ['ST', 'CF', 'CAM', 'LW', 'RW'].includes(pos)) ?
                                     baseValue * 0.15 : 0;

              // Multiple positions bonus
              const multiPositionBonus = playerMetadata.positions.length > 1 ? baseValue * 0.1 : 0;

              // Market volatility (random variation)
              const volatility = baseValue * (Math.random() * 0.2 - 0.1); // ±10% variation

              marketValue = Math.round(baseValue + ageAdjustment + positionPremium + multiPositionBonus + volatility)
              marketValueCache.set(player.mfl_player_id, marketValue)
            }
          } else {
            console.log(`✅ Using cached market value for ${playerMetadata.firstName} ${playerMetadata.lastName}: $${marketValue.toLocaleString()}`)
          }

          // Prepare market value data for database (using correct table structure)
          const marketValueData = {
            mfl_player_id: player.mfl_player_id,
            data: {
              estimatedValue: marketValue,
              overall_rating: playerMetadata.overall,
              positions: playerMetadata.positions,
              last_calculated: new Date().toISOString(),
              wallet_address: walletAddress
            },
            last_synced: new Date().toISOString()
          }

          // Include position ratings if they were calculated successfully
          console.log(`🔍 Position ratings for ${playerMetadata.firstName} ${playerMetadata.lastName}:`, positionRatings)
          if (positionRatings) {
            const processedRatings = Object.entries(positionRatings).reduce((acc, [position, result]) => {
              if (result && result.success) {
                acc[position] = {
                  rating: result.ovr,
                  familiarity: result.familiarity,
                  penalty: result.penalty,
                  difference: result.difference
                }
              }
              return acc;
            }, {} as any)
            marketValueData.data.position_ratings = processedRatings
            console.log(`🔍 Processed position ratings for ${playerMetadata.firstName} ${playerMetadata.lastName}:`, processedRatings)
          } else {
            console.log(`⚠️ No position ratings found for ${playerMetadata.firstName} ${playerMetadata.lastName}`)
          }

          // Store immediately in database
          console.log(`💾 Storing market value for ${playerMetadata.firstName} ${playerMetadata.lastName} in database...`)
          const { error: upsertError } = await upsertOne(TABLES.MARKET_VALUES, marketValueData, 'mfl_player_id')

          if (upsertError) {
            console.error(`❌ Error storing market value for player ${player.mfl_player_id}:`, upsertError)
          } else {
            console.log(`✅ Market value stored for ${playerMetadata.firstName} ${playerMetadata.lastName}: $${marketValue.toLocaleString()}`)
            processedPlayers++
          }

        } catch (error) {
          console.error(`❌ Error calculating market value for player ${player.mfl_player_id}:`, error)
          // Continue with next player
        }
      }

      this.updateProgress(dataType, SYNC_STATUS.COMPLETED, 100, `Market values calculated and stored for ${processedPlayers} players`)
      console.log(`✅ Agency player market values sync completed: ${processedPlayers} players processed`)

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('❌ Error in syncAgencyPlayerMarketValues:', error)
      this.updateProgress(dataType, SYNC_STATUS.FAILED, 0, 'Failed to sync agency player market values', errorMessage)
      throw error
    }
    */
  }

  /**
   * Sync agency players (players owned by the user)
   */
  private async syncAgencyPlayers(walletAddress: string, options: SyncOptions = {}) {
    const dataType = 'agency_players'

    try {
      this.updateProgress(dataType, SYNC_STATUS.IN_PROGRESS, 0, 'Fetching agency players...')
      // If forceRefresh is requested, clear existing agency players for this wallet
      if (options.forceRefresh) {
        console.log('🧹 Force refresh enabled: clearing existing agency players for wallet', walletAddress)

        // First, check how many players exist before deletion
        const { count: countBefore } = await countWhere(TABLES.AGENCY_PLAYERS, { wallet_address: walletAddress })

        console.log(`📊 Found ${countBefore || 0} existing agency players before deletion`)

        const { error: clearError } = await deleteWhere(TABLES.AGENCY_PLAYERS, { wallet_address: walletAddress })

        if (clearError) {
          console.warn('⚠️ Failed to clear existing agency players before sync:', clearError)
        } else {
          console.log(`✅ Deleted all existing agency players for wallet (${countBefore || 0} players)`)
        }

        // Verify deletion worked
        const { count: countAfter } = await countWhere(TABLES.AGENCY_PLAYERS, { wallet_address: walletAddress })

        if (countAfter && countAfter > 0) {
          console.warn(`⚠️ WARNING: ${countAfter} agency players still exist after deletion - deletion may have failed`)
        } else {
          console.log(`✅ Verification: All agency players deleted successfully (0 remaining)`)
        }
      }

      // If forceRefresh is true, skip cache check and always sync
      // This ensures we get the latest players including new signings
      if (!options.forceRefresh) {
        // Check if we need to sync (only when not forcing refresh)
        const { data: existingData, error: checkError } = await selectMaybeOne(TABLES.AGENCY_PLAYERS, {
          columns: ['last_synced'],
          where: { wallet_address: walletAddress },
          orderBy: { column: 'last_synced', ascending: false },
          limit: 1
        })

        // If there's an error and it's not "no rows found", log it but continue
        if (checkError && checkError.code !== 'PGRST116') {
          console.warn('Warning: Could not check agency players sync status:', checkError.message)
        }

        if (!this.needsSync(dataType, existingData?.last_synced, false)) {
          console.log('✅ Agency players are up to date, skipping sync')
          this.updateProgress(dataType, SYNC_STATUS.COMPLETED, 100, 'Agency players are up to date')
          return
        }

        console.log('🔄 Agency players need sync, last synced:', existingData?.last_synced)
      } else {
        console.log('🔄 Force refresh: syncing agency players regardless of cache status')
      }

      // Fetch agency players from MFL API
      this.updateProgress(dataType, SYNC_STATUS.IN_PROGRESS, 10, 'Preparing to fetch players from MFL API...')
      console.log(`🔄 Fetching agency players for wallet: ${walletAddress}`)

      // Always clear MFL API cache to ensure fresh data (especially important for new signings)
      this.updateProgress(dataType, SYNC_STATUS.IN_PROGRESS, 15, 'Clearing MFL API cache...')
      console.log('🧹 Clearing MFL API cache to ensure fresh player data...')
      try {
        mflApi.clearCache()
        console.log('✅ MFL API cache cleared')
      } catch (error) {
        console.warn('⚠️ Failed to clear MFL API cache:', error)
      }

      // Fetch fresh data from MFL API (cache already cleared above)
      this.updateProgress(dataType, SYNC_STATUS.IN_PROGRESS, 20, 'Requesting player list from MFL API...')
      console.log(`📡 Starting MFL API request for wallet: ${walletAddress}`)
      console.log(`📡 API endpoint: /players?ownerWalletAddress=${walletAddress}&limit=1200`)
      const startTime = Date.now()

      // Set up a progress update interval to show the request is still in progress
      // Show different messages to indicate we're waiting for the API response
      let progressMessageIndex = 0
      const progressMessages = [
        'Waiting for MFL API response...',
        'MFL API is processing your request...',
        'Still waiting for player data from MFL API...',
        'MFL API may be slow, please wait...'
      ]

      const progressInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000)
        const message = progressMessages[progressMessageIndex % progressMessages.length]
        this.updateProgress(dataType, SYNC_STATUS.IN_PROGRESS, 20, `${message} (${elapsed}s)`)
        progressMessageIndex++
      }, 3000) // Update every 3 seconds and rotate messages

      let ownerPlayersResponse
      try {
        ownerPlayersResponse = await mflApi.getOwnerPlayers(walletAddress, 1200)
        clearInterval(progressInterval)
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
        console.log(`✅ MFL API request completed in ${elapsed}s`)

        // Show player count and sample names immediately
        const playerCount = ownerPlayersResponse?.length || 0
        if (playerCount > 0) {
          const samplePlayers = ownerPlayersResponse.slice(0, 3).map(p =>
            `${p.metadata.firstName} ${p.metadata.lastName}`
          ).join(', ')
          const moreText = playerCount > 3 ? ` and ${playerCount - 3} more` : ''
          this.updateProgress(
            dataType,
            SYNC_STATUS.IN_PROGRESS,
            25,
            `Received ${playerCount} players: ${samplePlayers}${moreText}`
          )
        } else {
          this.updateProgress(dataType, SYNC_STATUS.IN_PROGRESS, 25, `Received response from MFL API (${elapsed}s) - No players found`)
        }
      } catch (error) {
        clearInterval(progressInterval)
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
        console.error(`❌ MFL API request failed after ${elapsed}s:`, error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        this.updateProgress(dataType, SYNC_STATUS.FAILED, 20, `Failed to fetch players: ${errorMessage}`, errorMessage)
        throw error
      }

      console.log(`📊 MFL API response:`, {
        hasPlayers: !!ownerPlayersResponse,
        playerCount: ownerPlayersResponse?.length || 0,
        firstPlayer: ownerPlayersResponse?.[0] ? {
          id: ownerPlayersResponse[0].id,
          name: ownerPlayersResponse[0].metadata.firstName + ' ' + ownerPlayersResponse[0].metadata.lastName
        } : null,
        playerIds: ownerPlayersResponse?.slice(0, 10).map(p => p.id) || []
      })
      console.log(`📋 Full player list from MFL API (${ownerPlayersResponse?.length || 0} players):`,
        ownerPlayersResponse?.map(p => `${p.id}: ${p.metadata.firstName} ${p.metadata.lastName}`).join(', ') || 'none'
      )

      if (!ownerPlayersResponse || ownerPlayersResponse.length === 0) {
        console.log('⚠️ No agency players found in MFL API response')
        this.updateProgress(dataType, SYNC_STATUS.COMPLETED, 100, 'No agency players found')
        return
      }

      this.updateProgress(dataType, SYNC_STATUS.IN_PROGRESS, 40, `Received ${ownerPlayersResponse.length} players from MFL API`)

      // FIRST: Populate the PLAYERS table with agency player data (required for foreign key)
      this.updateProgress(dataType, SYNC_STATUS.IN_PROGRESS, 50, `Updating players table with ${ownerPlayersResponse.length} players...`)

      const playerData = ownerPlayersResponse.map(player => ({
        mfl_player_id: player.id,
        data: player,
        last_synced: new Date().toISOString()
      }))

      console.log(`🔄 Upserting ${playerData.length} players to players table...`)
      const { error: playerError } = await upsertMany(TABLES.PLAYERS, playerData, 'mfl_player_id')

      if (playerError) {
        console.error('❌ ERROR: Could not update players table:', playerError.message)
        console.error('❌ Players table upsert failed:', playerError)
        throw playerError // This is critical - we need players table populated first
      } else {
        console.log(`✅ Successfully updated players table with ${playerData.length} players`)
      }

      // SECOND: Prepare agency player relationship data for database (no duplicate data storage)
      this.updateProgress(dataType, SYNC_STATUS.IN_PROGRESS, 70, `Creating ${ownerPlayersResponse.length} agency player relationships...`)

      const agencyPlayerData = ownerPlayersResponse.map(player => ({
        wallet_address: walletAddress,
        mfl_player_id: player.id,
        last_synced: new Date().toISOString()
      }))

      // Batch upsert agency player data
      console.log(`🔄 Upserting ${agencyPlayerData.length} agency players to database...`)
      console.log('Sample agency player data:', JSON.stringify(agencyPlayerData[0], null, 2))

      const { error } = await upsertMany(TABLES.AGENCY_PLAYERS, agencyPlayerData, 'wallet_address,mfl_player_id')

      if (error) {
        console.error('❌ ERROR: Failed to upsert agency players:', error)
        throw error
      } else {
        console.log(`✅ Successfully upserted ${agencyPlayerData.length} agency players`)
      }

      // Final cleanup: Remove any orphaned players that aren't in the API response
      // This ensures a complete refresh even if the initial delete didn't work perfectly
      this.updateProgress(dataType, SYNC_STATUS.IN_PROGRESS, 85, 'Verifying player list and removing orphaned players...')
      const apiPlayerIds = new Set(ownerPlayersResponse.map(p => p.id))
      console.log(`🧹 Performing final cleanup: removing players not in API response...`)

      const { data: allAgencyPlayers, error: fetchError } = await selectAll(TABLES.AGENCY_PLAYERS, {
        columns: ['mfl_player_id'],
        where: { wallet_address: walletAddress }
      })

      if (!fetchError && allAgencyPlayers) {
        const orphanedPlayers = allAgencyPlayers
          .filter(ap => !apiPlayerIds.has(ap.mfl_player_id))
          .map(ap => ap.mfl_player_id)

        if (orphanedPlayers.length > 0) {
          this.updateProgress(dataType, SYNC_STATUS.IN_PROGRESS, 90, `Removing ${orphanedPlayers.length} orphaned players...`)
          console.log(`🗑️ Removing ${orphanedPlayers.length} orphaned players not in API response...`)
          const { error: deleteError } = await deleteWhere(TABLES.AGENCY_PLAYERS, {
            wallet_address: walletAddress,
            mfl_player_id: { in: orphanedPlayers }
          })

          if (deleteError) {
            console.warn('⚠️ Failed to remove orphaned players:', deleteError)
          } else {
            console.log(`✅ Removed ${orphanedPlayers.length} orphaned players`)
          }
        } else {
          this.updateProgress(dataType, SYNC_STATUS.IN_PROGRESS, 90, 'All players verified - no orphaned players found')
          console.log('✅ No orphaned players found - all players match API response')
        }
      }

      // Clear data service cache to ensure fresh data is shown immediately
      console.log('🧹 Clearing data service cache for agency players...')
      try {
        dataService.clearCache(`agency_players_${walletAddress}`)
        console.log('✅ Data service cache cleared for agency players')
      } catch (cacheError) {
        console.warn('⚠️ Failed to clear data service cache:', cacheError)
      }

      this.updateProgress(dataType, SYNC_STATUS.COMPLETED, 100, `Agency players synced successfully (${ownerPlayersResponse.length} players)`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.updateProgress(dataType, SYNC_STATUS.FAILED, 0, 'Failed to sync agency players', errorMessage)
      throw error
    }
  }

  /**
   * Sync club data
   */
  private async syncClubData(walletAddress: string, options: SyncOptions = {}) {
    const dataType = 'club_data'

    try {
      this.updateProgress(dataType, SYNC_STATUS.IN_PROGRESS, 0, 'Fetching club data...')

      // Check if we need to sync
      console.log(`🔍 Checking sync status for dataType: ${dataType}`)
      const { data: existingData, error: checkError } = await selectMaybeOne(TABLES.SYNC_STATUS, {
        columns: ['*'],
        where: { data_type: dataType }
      })

      console.log('Sync status query result:', { existingData, checkError })

      if (checkError) {
        console.error('❌ Error checking clubs data sync status:', checkError)
        console.error('Error details:', {
          message: checkError?.message || 'No message',
          code: checkError?.code || 'No code',
        })
        // Don't throw error, just log and continue with sync
        console.log('⚠️ Continuing with sync despite status check error')
      } else {
        console.log('✅ Clubs data sync status check successful')
      }

      if (!this.needsSync(dataType, existingData?.last_synced, options.forceRefresh)) {
        console.log('✅ Club data is up to date, skipping sync')
        this.updateProgress(dataType, SYNC_STATUS.COMPLETED, 100, 'Club data is up to date')
        return
      }

      console.log('🔄 Club data needs sync, proceeding with sync...')

      // Fetch clubs for wallet
      this.updateProgress(dataType, SYNC_STATUS.IN_PROGRESS, 30, 'Fetching clubs from MFL API...')
      let clubs: any[]
      try {
        clubs = await clubsService.fetchClubsForWallet(walletAddress)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error('❌ Failed to fetch clubs from MFL API:', errorMessage)
        // Update progress to failed with clear error message
        this.updateProgress(dataType, SYNC_STATUS.FAILED, 30, `Failed to fetch clubs: ${errorMessage}`, errorMessage)
        // Don't throw - allow sync to continue with other data types
        // Return empty array so we can continue
        console.warn('⚠️ Continuing sync without club data due to fetch failure')
        return
      }

      if (!clubs || clubs.length === 0) {
        this.updateProgress(dataType, SYNC_STATUS.COMPLETED, 100, 'No clubs found for user')
        return
      }

      this.updateProgress(dataType, SYNC_STATUS.IN_PROGRESS, 60, `Processing ${clubs.length} clubs...`)

      // Prepare club data for database
      const clubData = clubs.map(club => ({
        mfl_club_id: club.club.id,
        wallet_address: walletAddress,
        data: club,
        last_synced: new Date().toISOString()
      }))

      // Batch upsert club data
      const { error } = await upsertMany(TABLES.CLUBS, clubData, 'mfl_club_id,wallet_address')

      if (error) throw error

      console.log('✅ Club data sync completed successfully, updating progress...')
      this.updateProgress(dataType, SYNC_STATUS.COMPLETED, 100, `Club data synced successfully (${clubs.length} clubs)`)
      console.log('✅ Club data sync progress updated to completed')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.updateProgress(dataType, SYNC_STATUS.FAILED, 0, 'Failed to sync club data', errorMessage)
      throw error
    }
  }

  /**
   * Test database connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const { error } = await executeRaw('SELECT 1')

      if (error) {
        console.error('Database connection test failed:', error.message || 'Unknown error')
        this.connectionAvailable = false
        return false
      }

      console.log('✅ Database connection test successful')
      this.connectionAvailable = true
      return true
    } catch (error) {
      console.error('Database connection test failed:', error instanceof Error ? error.message : 'Unknown error')
      this.connectionAvailable = false
      return false
    }
  }

  /**
   * Cancel ongoing sync
   */
  cancelSync() {
    console.log('Cancelling sync...')
    this.stopSync() // Use stopSync to properly abort HTTP requests
  }

  /**
   * Main sync function - syncs all data types
   */
  async syncAllData(walletAddress: string, options: SyncOptions = {}) {
    if (this.isSyncing) {
      console.log('Sync already in progress, skipping...')
      return
    }

    this.isSyncing = true
    this.syncCancelled = false
    this.currentProgress = []
    this.onProgressCallback = options.onProgress

    // Create AbortController for this sync session
    this.abortController = new AbortController()

    // Set abort signal on mflApi for all HTTP requests
    mflApi.setAbortSignal(this.abortController.signal)

    try {
      // Test connection first
      const isConnected = await this.testConnection()
      if (!isConnected) {
        throw new Error('Cannot connect to data service. Please check your connection and try again.')
      }
      // Sync data types in order with retry logic
      if (!this.syncCancelled && !this.abortController?.signal.aborted) {
        console.log('🔄 Starting user info sync')
        await this.withRetry(
          () => this.syncUserInfo(walletAddress, options),
          'User info sync',
          options.maxRetries,
          options.retryDelay
        )
        console.log('✅ User info sync completed')
      }

      if (!this.syncCancelled && !this.abortController?.signal.aborted) {
        console.log('🔄 Starting club data sync')
        await this.withRetry(
          () => this.syncClubData(walletAddress, options),
          'Club data sync',
          options.maxRetries,
          options.retryDelay
        )
        console.log('✅ Club data sync completed')
      }

      if (!this.syncCancelled && !this.abortController?.signal.aborted) {
        console.log('🔄 Starting agency players sync')
        await this.withRetry(
          () => this.syncAgencyPlayers(walletAddress, options),
          'Agency players sync',
          options.maxRetries,
          options.retryDelay
        )
        console.log('✅ Agency players sync completed')
      }

      // Removed: agency player market values background sync

      // Player data sync is handled on-demand when specific players are requested
      // This is more efficient than syncing all players at once
      console.log('ℹ️ Player data sync is handled on-demand, skipping in main sync sequence')

      // Removed: matches data sync (removed to make sync faster)
      // Removed: upcoming opposition sync (removed to make sync faster)
      // Removed: opponent matches sync from main sequence (handled on tactics page only)

      // Call completion callback only if not cancelled
      if (!this.syncCancelled && !this.abortController?.signal.aborted && options.onComplete) {
        options.onComplete()
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown sync error'
      console.error('Sync failed:', error)
      console.error('Error details:', {
        message: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        error: error,
        errorType: typeof error,
        errorString: String(error),
        errorJSON: JSON.stringify(error, null, 2)
      })

      // Update progress with error
      this.updateProgress('sync_error', SYNC_STATUS.FAILED, 0, `Sync failed: ${errorMessage}`)

      if (options.onError) {
        options.onError(error instanceof Error ? error : new Error(errorMessage))
      }
    } finally {
      this.isSyncing = false
      this.onProgressCallback = undefined

      // Clean up abort controller
      if (this.abortController) {
        this.abortController = undefined
      }

      // Clear abort signal from mflApi
      mflApi.setAbortSignal(undefined)
    }
  }

  /**
   * Get current sync progress
   */
  getCurrentProgress(): SyncProgress[] {
    // Filter out removed sync types
    return this.currentProgress.filter(p =>
      p.dataType !== 'upcoming_opposition' &&
      p.dataType !== 'matches_data'
    )
  }

  /**
   * Get abort signal for HTTP requests
   */
  getAbortSignal(): AbortSignal | undefined {
    return this.abortController?.signal
  }

  /**
   * Check if database connection is available
   */
  isConnectionAvailable(): boolean {
    return this.connectionAvailable
  }

  /**
   * Check if sync is in progress
   */
  isSyncInProgress(): boolean {
    return this.isSyncing
  }

  /**
   * Stop the current sync operation
   */
  stopSync(): void {
    console.log('🛑 Stopping sync and aborting all requests...')
    this.syncCancelled = true
    this.isSyncing = false
    this.currentProgress = []

    // Abort all ongoing HTTP requests
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = undefined
    }

    console.log('🛑 Sync stopped by user')

    // Notify any progress callbacks that sync was cancelled
    if (this.onProgressCallback) {
      this.onProgressCallback({
        dataType: 'sync_cancelled',
        status: 'cancelled',
        progress: 0,
        message: 'Sync cancelled by user'
      })
    }
  }

  /**
   * Get sync status from database
   */
  async getSyncStatus(): Promise<SyncProgress[]> {
    try {
      const { data, error } = await selectAll(TABLES.SYNC_STATUS, {
        orderBy: { column: 'updated_at', ascending: false }
      })

      if (error) throw error

      // Filter out removed sync types
      return (data || [])
        .filter(row => row.data_type !== 'upcoming_opposition' && row.data_type !== 'matches_data')
        .map(row => ({
          dataType: row.data_type,
          status: row.status as SyncStatus,
          progress: row.progress_percentage,
          message: row.status === SYNC_STATUS.COMPLETED ? 'Completed' :
                  row.status === SYNC_STATUS.FAILED ? `Failed: ${row.error_message}` :
                  row.status === SYNC_STATUS.IN_PROGRESS ? 'In progress...' : 'Pending',
          error: row.error_message
        }))
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.warn('Warning: Could not fetch sync status:', errorMessage)
      return []
    }
  }
}

const syncServiceInstance = new SyncService()
export const syncService = syncServiceInstance
export const supabaseSyncService = syncServiceInstance
