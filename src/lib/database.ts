import { createClient, type Client } from '@libsql/client'

// Turso/libSQL client singleton
let _db: Client | undefined

export function getDb(): Client {
  if (!_db) {
    const url = process.env.TURSO_DATABASE_URL
    const authToken = process.env.TURSO_AUTH_TOKEN
    if (!url) throw new Error('TURSO_DATABASE_URL environment variable is required')
    _db = createClient({ url, authToken: authToken || undefined })
  }
  return _db
}

// Re-export the singleton for convenience
export { type Client } from '@libsql/client'

// Database table names
export const TABLES = {
  USERS: 'users',
  PLAYERS: 'players',
  AGENCY_PLAYERS: 'agency_players',
  CLUBS: 'clubs',
  MATCHES: 'matches',
  OPPONENT_MATCHES: 'opponent_matches',
  PLAYER_SALE_HISTORY: 'player_sale_history',
  PLAYER_PROGRESSION: 'player_progression',
  SQUAD_IDS: 'squad_ids',
  SYNC_STATUS: 'sync_status',
  MATCH_FORMATIONS: 'match_formations',
  COMPETITIONS: 'competitions',
  TEAM_STATISTICS: 'team_statistics',
  PLAYER_RATINGS: 'player_ratings',
  MARKET_VALUES: 'market_values',
  TRANSFER_HISTORY: 'transfer_history',
  SEASONS: 'seasons',
  LEAGUE_STANDINGS: 'league_standings'
} as const

// Cache duration constants (in milliseconds) - Based on MFL update schedule
export const CACHE_DURATIONS = {
  USER_INFO: 7 * 24 * 60 * 60 * 1000, // 7 days
  user_info: 7 * 24 * 60 * 60 * 1000, // 7 days (lowercase for sync service)
  PLAYER_INFO: 3 * 7 * 24 * 60 * 60 * 1000, // 3 weeks (players change every 3 weeks)
  player_data: 3 * 7 * 24 * 60 * 60 * 1000, // 3 weeks (for sync service)
  AGENCY_PLAYERS: 3 * 7 * 24 * 60 * 60 * 1000, // 3 weeks (players change every 3 weeks)
  agency_players: 3 * 7 * 24 * 60 * 60 * 1000, // 3 weeks (lowercase for sync service)
  CLUBS: 6 * 7 * 24 * 60 * 60 * 1000, // 6 weeks (clubs change every 6 weeks)
  club_data: 6 * 7 * 24 * 60 * 60 * 1000, // 6 weeks (lowercase for sync service)
  PREVIOUS_MATCHES: 0, // Never expires - historical data
  matches_data: 12 * 60 * 60 * 1000, // 12 hours (for sync service)
  UPCOMING_MATCHES: 12 * 60 * 60 * 1000, // 12 hours
  OPPONENT_MATCHES: 12 * 60 * 60 * 1000, // 12 hours
  opponent_matches: 12 * 60 * 60 * 1000, // 12 hours (lowercase for sync service)
  PLAYER_SALE_HISTORY: 7 * 24 * 60 * 60 * 1000, // 7 days
  PLAYER_PROGRESSION: 4 * 60 * 60 * 1000, // 4 hours
  SQUAD_IDS: 6 * 7 * 24 * 60 * 60 * 1000, // 6 weeks (squad IDs change with clubs)
  MATCH_FORMATIONS: 30 * 24 * 60 * 60 * 1000, // 30 days
  COMPETITIONS: 6 * 7 * 24 * 60 * 60 * 1000, // 6 weeks (competitions change with clubs)
  TEAM_STATISTICS: 4 * 60 * 60 * 1000, // 4 hours
  PLAYER_RATINGS: 4 * 60 * 60 * 1000, // 4 hours
  MARKET_VALUES: 7 * 24 * 60 * 60 * 1000, // 7 days (agency player market values)
  agency_player_market_values: 7 * 24 * 60 * 60 * 1000, // 7 days (lowercase key used by gate)
  TRANSFER_HISTORY: 7 * 24 * 60 * 60 * 1000, // 7 days
  SEASONS: 7 * 24 * 60 * 60 * 1000, // 7 days
  LEAGUE_STANDINGS: 4 * 60 * 60 * 1000 // 4 hours
} as const

// Sync status types
export const SYNC_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed'
} as const

export type SyncStatus = typeof SYNC_STATUS[keyof typeof SYNC_STATUS]

// Database types
export interface DatabaseUser {
  id: string
  wallet_address: string
  data: any
  last_synced: string
  created_at: string
  updated_at: string
}

export interface DatabasePlayer {
  id: string
  mfl_player_id: number
  data: any
  last_synced: string
  created_at: string
  updated_at: string
}

export interface DatabaseMatch {
  id: string
  mfl_match_id: number
  match_type: 'previous' | 'upcoming'
  data: any
  last_synced: string
  created_at: string
  updated_at: string
}

export interface DatabaseSyncStatus {
  id: string
  data_type: string
  status: SyncStatus
  progress_percentage: number
  last_synced: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}
