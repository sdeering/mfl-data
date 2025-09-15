import { supabase, TABLES, CACHE_DURATIONS, SYNC_STATUS, type SyncStatus } from '../lib/supabase'
import { matchesService } from './matchesService'
import { clubsService } from './clubsService'
import { mflApi } from './mflApi'
import { supabaseDataService } from './supabaseDataService'
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

class SupabaseSyncService {
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
      const { error } = await supabase
        .from(TABLES.SYNC_STATUS)
        .upsert({
          data_type: dataType,
          status,
          progress_percentage: progress,
          last_synced: status === SYNC_STATUS.COMPLETED ? new Date().toISOString() : null,
          error_message: errorMessage || null,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'data_type'
        })

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
      const { data: existingUser, error: checkError } = await supabase
        .from(TABLES.USERS)
        .select('last_synced')
        .eq('wallet_address', walletAddress)
        .maybeSingle()

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
      const { error } = await supabase
        .from(TABLES.USERS)
        .upsert(userData, {
          onConflict: 'wallet_address'
        })

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
      const { data: existingData, error: checkError } = await supabase
        .from(TABLES.PLAYERS)
        .select('last_synced')
        .order('last_synced', { ascending: false })
        .limit(1)
        .maybeSingle()

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
   */
  private async syncUpcomingOppositionData(walletAddress: string, options: SyncOptions = {}) {
    const dataType = 'upcoming_opposition'
    
    try {
      console.log('🔄 Starting upcoming opposition sync for wallet:', walletAddress)
      this.updateProgress(dataType, SYNC_STATUS.IN_PROGRESS, 0, 'Loading upcoming opposition data...')
      
      // Check if we need to sync
      console.log('🔍 Checking upcoming opposition sync status...')
      const { data: existingData, error: checkError } = await supabase
        .from(TABLES.SYNC_STATUS)
        .select('last_synced')
        .eq('data_type', dataType)
        .maybeSingle()

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
        const { error } = await supabase
          .from(TABLES.OPPONENT_MATCHES)
          .upsert(allOpponentData, {
            onConflict: 'opponent_squad_id,match_limit'
          })

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
      const { data: existingData, error: checkError } = await supabase
        .from(TABLES.OPPONENT_MATCHES)
        .select('last_synced')
        .order('last_synced', { ascending: false })
        .limit(1)
        .maybeSingle()

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
          const { error } = await supabase
            .from(TABLES.OPPONENT_MATCHES)
            .upsert(allOpponentData, {
              onConflict: 'opponent_squad_id,match_limit'
            })

          if (error) {
            console.error('❌ Failed to save opponent data:', error)
            console.error('Error details:', {
              message: error.message,
              details: error.details,
              hint: error.hint,
              code: error.code
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
   */
  private async syncMatchesData(walletAddress: string, options: SyncOptions = {}) {
    const dataType = 'matches_data'
    
    try {
      this.updateProgress(dataType, SYNC_STATUS.IN_PROGRESS, 0, 'Fetching matches data...')
      
      // Check if we need to sync
      console.log(`🔍 Checking sync status for dataType: ${dataType}`)
      const { data: existingData, error: checkError } = await supabase
        .from(TABLES.SYNC_STATUS)
        .select('*')
        .eq('data_type', dataType)
        .maybeSingle()
      
      console.log('Sync status query result:', { existingData, checkError })

      if (checkError) {
        console.error('❌ Error checking matches data sync status:', checkError)
        console.error('Error details:', {
          message: checkError?.message || 'No message',
          code: checkError?.code || 'No code',
          details: checkError?.details || 'No details',
          hint: checkError?.hint || 'No hint',
          fullError: JSON.stringify(checkError)
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
        const { error } = await supabase
          .from(TABLES.MATCHES)
          .upsert(allMatches, {
            onConflict: 'mfl_match_id'
          })

        if (error) throw error
      }

      this.updateProgress(dataType, SYNC_STATUS.COMPLETED, 100, 'Matches data synced successfully')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.updateProgress(dataType, SYNC_STATUS.FAILED, 0, 'Failed to sync matches data', errorMessage)
      throw error
    }
  }

  /**
   * Sync agency player market values
   */
  private async syncAgencyPlayerMarketValues(walletAddress: string, options: SyncOptions = {}, limit?: number) {
    const dataType = 'agency_player_market_values'
    
    // Track market data API failures
    let marketDataApiFailures = 0;
    const maxMarketDataFailures = 3; // Skip market data after 3 failures
    
    try {
      console.log('🔄 Starting agency player market values sync for wallet:', walletAddress)
      this.updateProgress(dataType, SYNC_STATUS.IN_PROGRESS, 0, 'Loading agency players...')
      
      // Step 1: Get all agency players and ensure they're in the players table
      console.log('🔍 Fetching agency players for market value calculation...')
      const { data: agencyPlayers, error: agencyError } = await supabase
        .from(TABLES.AGENCY_PLAYERS)
        .select(`
          *,
          player:players(*)
        `)
        .eq('wallet_address', walletAddress)

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

      for (let i = 0; i < playersToProcess.length; i++) {
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
          console.log(`💰 Checking market value for ${playerMetadata.firstName} ${playerMetadata.lastName} (${i + 1}/${playersToProcess.length})`)
          const positionRatings = positionRatingsMap.get(player.mfl_player_id)

          // Check database for existing market value first (7-day expiration)
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          
          const { data: existingMarketValue, error: marketValueError } = await supabase
            .from(TABLES.MARKET_VALUES)
            .select('*')
            .eq('player_id', player.mfl_player_id)
            .eq('wallet_address', walletAddress)
            .gte('created_at', sevenDaysAgo.toISOString())
            .single();

          if (existingMarketValue && !marketValueError) {
            console.log(`✅ Using existing market value for ${playerMetadata.firstName} ${playerMetadata.lastName}: $${existingMarketValue.market_value.toLocaleString()} (created: ${existingMarketValue.created_at})`)
            processedPlayers++
            continue;
          }

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

          // Prepare market value data for database
          const marketValueData = {
            player_id: player.mfl_player_id,
            wallet_address: walletAddress,
            market_value: marketValue,
            overall_rating: playerMetadata.overall,
            positions: playerMetadata.positions,
            last_calculated: new Date().toISOString()
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
            marketValueData.position_ratings = processedRatings
            console.log(`🔍 Processed position ratings for ${playerMetadata.firstName} ${playerMetadata.lastName}:`, processedRatings)
          } else {
            console.log(`⚠️ No position ratings found for ${playerMetadata.firstName} ${playerMetadata.lastName}`)
          }

          // Store immediately in database
          console.log(`💾 Storing market value for ${playerMetadata.firstName} ${playerMetadata.lastName} in database...`)
          const { error: upsertError } = await supabase
            .from(TABLES.MARKET_VALUES)
            .upsert(marketValueData, {
              onConflict: 'player_id'
            })

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
  }

  /**
   * Sync agency players (players owned by the user)
   */
  private async syncAgencyPlayers(walletAddress: string, options: SyncOptions = {}) {
    const dataType = 'agency_players'
    
    try {
      this.updateProgress(dataType, SYNC_STATUS.IN_PROGRESS, 0, 'Fetching agency players...')
      
      // Check if we need to sync
      const { data: existingData, error: checkError } = await supabase
        .from(TABLES.AGENCY_PLAYERS)
        .select('last_synced')
        .eq('wallet_address', walletAddress)
        .order('last_synced', { ascending: false })
        .limit(1)
        .maybeSingle()

      // If there's an error and it's not "no rows found", log it but continue
      if (checkError && checkError.code !== 'PGRST116') {
        console.warn('Warning: Could not check agency players sync status:', checkError.message)
      }

      if (!this.needsSync(dataType, existingData?.last_synced, options.forceRefresh)) {
        console.log('✅ Agency players are up to date, skipping sync')
        this.updateProgress(dataType, SYNC_STATUS.COMPLETED, 100, 'Agency players are up to date')
        return
      }
      
      console.log('🔄 Agency players need sync, last synced:', existingData?.last_synced)

      // Fetch agency players from MFL API
      this.updateProgress(dataType, SYNC_STATUS.IN_PROGRESS, 30, 'Fetching players from MFL API...')
      console.log(`🔄 Fetching agency players for wallet: ${walletAddress}`)
      const ownerPlayersResponse = await mflApi.getOwnerPlayers(walletAddress, 1200)
      
      console.log(`📊 MFL API response:`, {
        hasPlayers: !!ownerPlayersResponse,
        playerCount: ownerPlayersResponse?.length || 0,
        firstPlayer: ownerPlayersResponse?.[0] ? {
          id: ownerPlayersResponse[0].id,
          name: ownerPlayersResponse[0].metadata.firstName + ' ' + ownerPlayersResponse[0].metadata.lastName
        } : null
      })
      
      if (!ownerPlayersResponse || ownerPlayersResponse.length === 0) {
        console.log('⚠️ No agency players found in MFL API response')
        this.updateProgress(dataType, SYNC_STATUS.COMPLETED, 100, 'No agency players found')
        return
      }

      this.updateProgress(dataType, SYNC_STATUS.IN_PROGRESS, 60, `Processing ${ownerPlayersResponse.length} agency players...`)

      // FIRST: Populate the PLAYERS table with agency player data (required for foreign key)
      this.updateProgress(dataType, SYNC_STATUS.IN_PROGRESS, 60, `Adding ${ownerPlayersResponse.length} players to players table...`)

      const playerData = ownerPlayersResponse.map(player => ({
        mfl_player_id: player.id,
        data: player,
        last_synced: new Date().toISOString()
      }))

      console.log(`🔄 Upserting ${playerData.length} players to players table...`)
      const { error: playerError } = await supabase
        .from(TABLES.PLAYERS)
        .upsert(playerData, {
          onConflict: 'mfl_player_id'
        })

      if (playerError) {
        console.error('❌ ERROR: Could not update players table:', playerError.message)
        console.error('❌ Players table upsert failed:', playerError)
        throw playerError // This is critical - we need players table populated first
      } else {
        console.log(`✅ Successfully updated players table with ${playerData.length} players`)
      }

      // SECOND: Prepare agency player relationship data for database (no duplicate data storage)
      this.updateProgress(dataType, SYNC_STATUS.IN_PROGRESS, 80, `Adding ${ownerPlayersResponse.length} agency player relationships...`)
      
      const agencyPlayerData = ownerPlayersResponse.map(player => ({
        wallet_address: walletAddress,
        mfl_player_id: player.id,
        last_synced: new Date().toISOString()
      }))

      // Batch upsert agency player data
      console.log(`🔄 Upserting ${agencyPlayerData.length} agency players to database...`)
      console.log('Sample agency player data:', JSON.stringify(agencyPlayerData[0], null, 2))
      
      const { error } = await supabase
        .from(TABLES.AGENCY_PLAYERS)
        .upsert(agencyPlayerData, {
          onConflict: 'wallet_address,mfl_player_id'
        })

      if (error) {
        console.error('❌ ERROR: Failed to upsert agency players:', error)
        throw error
      } else {
        console.log(`✅ Successfully upserted ${agencyPlayerData.length} agency players`)
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
      const { data: existingData, error: checkError } = await supabase
        .from(TABLES.SYNC_STATUS)
        .select('*')
        .eq('data_type', dataType)
        .maybeSingle()

      console.log('Sync status query result:', { existingData, checkError })

      if (checkError) {
        console.error('❌ Error checking clubs data sync status:', checkError)
        console.error('Error details:', {
          message: checkError?.message || 'No message',
          code: checkError?.code || 'No code',
          details: checkError?.details || 'No details',
          hint: checkError?.hint || 'No hint',
          fullError: JSON.stringify(checkError)
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
      const clubs = await clubsService.fetchClubsForWallet(walletAddress)
      if (!clubs || clubs.length === 0) {
        this.updateProgress(dataType, SYNC_STATUS.COMPLETED, 100, 'No clubs found for user')
        return
      }

      this.updateProgress(dataType, SYNC_STATUS.IN_PROGRESS, 60, `Processing ${clubs.length} clubs...`)

      // Prepare club data for database
      const clubData = clubs.map(club => ({
        mfl_club_id: club.club.id,
        data: club,
        last_synced: new Date().toISOString()
      }))

      // Batch upsert club data
      const { error } = await supabase
        .from(TABLES.CLUBS)
        .upsert(clubData, {
          onConflict: 'mfl_club_id'
        })

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
   * Test Supabase connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const { error } = await supabase
        .from(TABLES.USERS)
        .select('count')
        .limit(1)

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
      
      if (!this.syncCancelled && !this.abortController?.signal.aborted) {
        console.log('🔄 Starting agency player market values sync')
        await this.withRetry(
          () => this.syncAgencyPlayerMarketValues(walletAddress, options),
          'Agency player market values sync',
          options.maxRetries,
          options.retryDelay
        )
        console.log('✅ Agency player market values sync completed')
      }
      
      // Player data sync is handled on-demand when specific players are requested
      // This is more efficient than syncing all players at once
      console.log('ℹ️ Player data sync is handled on-demand, skipping in main sync sequence')
      
      if (!this.syncCancelled && !this.abortController?.signal.aborted) {
        console.log('🔄 Starting matches data sync')
        await this.withRetry(
          () => this.syncMatchesData(walletAddress, options),
          'Matches data sync',
          options.maxRetries,
          options.retryDelay
        )
        console.log('✅ Matches data sync completed')
      }
      
      if (!this.syncCancelled && !this.abortController?.signal.aborted) {
        console.log('🔄 Starting upcoming opposition sync')
        await this.withRetry(
          () => this.syncUpcomingOppositionData(walletAddress, options),
          'Upcoming opposition data sync',
          options.maxRetries,
          options.retryDelay
        )
        console.log('✅ Upcoming opposition sync completed')
      }
      
      if (!this.syncCancelled && !this.abortController?.signal.aborted) {
        console.log('🔄 Starting opponent matches sync in main sync sequence')
        await this.withRetry(
          () => this.syncOpponentMatchesData(walletAddress, options),
          'Opponent matches data sync',
          options.maxRetries,
          options.retryDelay
        )
        console.log('✅ Opponent matches sync completed in main sync sequence')
      }

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
    return [...this.currentProgress]
  }

  /**
   * Get abort signal for HTTP requests
   */
  getAbortSignal(): AbortSignal | undefined {
    return this.abortController?.signal
  }

  /**
   * Check if Supabase connection is available
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
      const { data, error } = await supabase
        .from(TABLES.SYNC_STATUS)
        .select('*')
        .order('updated_at', { ascending: false })

      if (error) throw error

      return data.map(row => ({
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

export const supabaseSyncService = new SupabaseSyncService()
