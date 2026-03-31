import { getDb } from './database'

const SCHEMA_VERSION = 1

const CREATE_TABLES = `
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  wallet_address TEXT UNIQUE NOT NULL,
  data TEXT,
  last_synced TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Players table
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  mfl_player_id INTEGER UNIQUE NOT NULL,
  data TEXT,
  last_synced TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Agency players table
CREATE TABLE IF NOT EXISTS agency_players (
  id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  mfl_player_id INTEGER NOT NULL,
  data TEXT,
  last_synced TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(wallet_address, mfl_player_id)
);

-- Clubs table
CREATE TABLE IF NOT EXISTS clubs (
  id TEXT PRIMARY KEY,
  mfl_club_id INTEGER UNIQUE NOT NULL,
  data TEXT,
  last_synced TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Matches table
CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  mfl_match_id INTEGER UNIQUE NOT NULL,
  match_type TEXT CHECK (match_type IN ('previous', 'upcoming')) NOT NULL,
  wallet_address TEXT NOT NULL,
  club_id TEXT NOT NULL,
  data TEXT,
  last_synced TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Opponent matches table
CREATE TABLE IF NOT EXISTS opponent_matches (
  id TEXT PRIMARY KEY,
  opponent_squad_id INTEGER NOT NULL,
  match_limit INTEGER NOT NULL DEFAULT 5,
  matches_data TEXT,
  formations_data TEXT,
  last_synced TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(opponent_squad_id, match_limit)
);

-- Player sale history table
CREATE TABLE IF NOT EXISTS player_sale_history (
  id TEXT PRIMARY KEY,
  mfl_player_id INTEGER NOT NULL,
  data TEXT,
  last_synced TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Player progression table
CREATE TABLE IF NOT EXISTS player_progression (
  id TEXT PRIMARY KEY,
  mfl_player_id INTEGER NOT NULL,
  data TEXT,
  last_synced TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Squad IDs table
CREATE TABLE IF NOT EXISTS squad_ids (
  id TEXT PRIMARY KEY,
  mfl_club_id INTEGER NOT NULL,
  mfl_squad_id INTEGER NOT NULL,
  data TEXT,
  last_synced TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(mfl_club_id, mfl_squad_id)
);

-- Match formations table
CREATE TABLE IF NOT EXISTS match_formations (
  id TEXT PRIMARY KEY,
  mfl_match_id INTEGER UNIQUE NOT NULL,
  data TEXT,
  last_synced TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Competitions table
CREATE TABLE IF NOT EXISTS competitions (
  id TEXT PRIMARY KEY,
  mfl_competition_id INTEGER UNIQUE NOT NULL,
  data TEXT,
  last_synced TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Team statistics table
CREATE TABLE IF NOT EXISTS team_statistics (
  id TEXT PRIMARY KEY,
  mfl_team_id INTEGER NOT NULL,
  data TEXT,
  last_synced TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Player ratings table
CREATE TABLE IF NOT EXISTS player_ratings (
  id TEXT PRIMARY KEY,
  mfl_player_id INTEGER UNIQUE NOT NULL,
  data TEXT,
  last_synced TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Market values table
CREATE TABLE IF NOT EXISTS market_values (
  id TEXT PRIMARY KEY,
  mfl_player_id INTEGER UNIQUE NOT NULL,
  data TEXT,
  last_synced TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Transfer history table
CREATE TABLE IF NOT EXISTS transfer_history (
  id TEXT PRIMARY KEY,
  mfl_transfer_id INTEGER UNIQUE NOT NULL,
  data TEXT,
  last_synced TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Seasons table
CREATE TABLE IF NOT EXISTS seasons (
  id TEXT PRIMARY KEY,
  mfl_season_id INTEGER UNIQUE NOT NULL,
  data TEXT,
  last_synced TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- League standings table
CREATE TABLE IF NOT EXISTS league_standings (
  id TEXT PRIMARY KEY,
  mfl_league_id INTEGER NOT NULL,
  data TEXT,
  last_synced TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Sync status table
CREATE TABLE IF NOT EXISTS sync_status (
  id TEXT PRIMARY KEY,
  data_type TEXT NOT NULL,
  status TEXT CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')) NOT NULL,
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  last_synced TEXT,
  error_message TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(data_type)
);

-- Squads table
CREATE TABLE IF NOT EXISTS squads (
  id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  squad_name TEXT NOT NULL,
  formation_id TEXT NOT NULL,
  players TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(wallet_address, squad_name)
);

-- API usage daily table
CREATE TABLE IF NOT EXISTS api_usage_daily (
  date TEXT NOT NULL,
  source TEXT NOT NULL,
  endpoint TEXT NOT NULL DEFAULT 'unknown',
  count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (date, source, endpoint)
);

-- Schema version tracking
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TEXT DEFAULT (datetime('now'))
);
`

const CREATE_INDEXES = `
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_players_mfl_player_id ON players(mfl_player_id);
CREATE INDEX IF NOT EXISTS idx_agency_players_wallet_address ON agency_players(wallet_address);
CREATE INDEX IF NOT EXISTS idx_agency_players_mfl_player_id ON agency_players(mfl_player_id);
CREATE INDEX IF NOT EXISTS idx_clubs_mfl_club_id ON clubs(mfl_club_id);
CREATE INDEX IF NOT EXISTS idx_matches_mfl_match_id ON matches(mfl_match_id);
CREATE INDEX IF NOT EXISTS idx_matches_match_type ON matches(match_type);
CREATE INDEX IF NOT EXISTS idx_matches_last_synced ON matches(last_synced);
CREATE INDEX IF NOT EXISTS idx_player_sale_history_mfl_player_id ON player_sale_history(mfl_player_id);
CREATE INDEX IF NOT EXISTS idx_player_progression_mfl_player_id ON player_progression(mfl_player_id);
CREATE INDEX IF NOT EXISTS idx_squad_ids_mfl_club_id ON squad_ids(mfl_club_id);
CREATE INDEX IF NOT EXISTS idx_squad_ids_mfl_squad_id ON squad_ids(mfl_squad_id);
CREATE INDEX IF NOT EXISTS idx_match_formations_mfl_match_id ON match_formations(mfl_match_id);
CREATE INDEX IF NOT EXISTS idx_competitions_mfl_competition_id ON competitions(mfl_competition_id);
CREATE INDEX IF NOT EXISTS idx_team_statistics_mfl_team_id ON team_statistics(mfl_team_id);
CREATE INDEX IF NOT EXISTS idx_player_ratings_mfl_player_id ON player_ratings(mfl_player_id);
CREATE INDEX IF NOT EXISTS idx_market_values_mfl_player_id ON market_values(mfl_player_id);
CREATE INDEX IF NOT EXISTS idx_transfer_history_mfl_transfer_id ON transfer_history(mfl_transfer_id);
CREATE INDEX IF NOT EXISTS idx_seasons_mfl_season_id ON seasons(mfl_season_id);
CREATE INDEX IF NOT EXISTS idx_league_standings_mfl_league_id ON league_standings(mfl_league_id);
CREATE INDEX IF NOT EXISTS idx_sync_status_data_type ON sync_status(data_type);
CREATE INDEX IF NOT EXISTS idx_sync_status_status ON sync_status(status);
CREATE INDEX IF NOT EXISTS idx_squads_wallet_address ON squads(wallet_address);
CREATE INDEX IF NOT EXISTS idx_squads_formation ON squads(formation_id);
`

let _initialized = false

export async function initializeSchema(): Promise<void> {
  if (_initialized) return
  const db = getDb()

  // Execute each CREATE TABLE statement individually (libSQL doesn't support multi-statement in one call)
  const statements = CREATE_TABLES
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))

  for (const stmt of statements) {
    await db.execute(stmt)
  }

  // Execute indexes
  const indexes = CREATE_INDEXES
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))

  for (const idx of indexes) {
    await db.execute(idx)
  }

  // Record schema version
  await db.execute({
    sql: 'INSERT OR IGNORE INTO schema_version (version) VALUES (?)',
    args: [SCHEMA_VERSION]
  })

  _initialized = true
}
