-- MFL Player Search Database Schema
-- This file contains all the table definitions for the Supabase database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table - stores user information with 7-day cache
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT UNIQUE NOT NULL,
  data JSONB,
  last_synced TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Players table - stores player data with 7-day cache
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mfl_player_id INTEGER UNIQUE NOT NULL,
  data JSONB,
  last_synced TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agency players table - stores players in manager's agency with 7-day cache
CREATE TABLE IF NOT EXISTS agency_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  mfl_player_id INTEGER NOT NULL,
  data JSONB,
  last_synced TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(wallet_address, mfl_player_id)
);

-- Clubs table - stores club information with 7-day cache
CREATE TABLE IF NOT EXISTS clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mfl_club_id INTEGER UNIQUE NOT NULL,
  data JSONB,
  last_synced TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Matches table - stores match data with different cache durations
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mfl_match_id INTEGER UNIQUE NOT NULL,
  match_type TEXT CHECK (match_type IN ('previous', 'upcoming')) NOT NULL,
  wallet_address TEXT NOT NULL,
  club_id TEXT NOT NULL,
  data JSONB,
  last_synced TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Opponent matches table - stores opponent match data for tactics analysis
CREATE TABLE IF NOT EXISTS opponent_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opponent_squad_id INTEGER NOT NULL,
  match_limit INTEGER NOT NULL DEFAULT 5,
  matches_data JSONB,
  formations_data JSONB,
  last_synced TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(opponent_squad_id, match_limit)
);

-- Player sale history table - stores transaction history with 7-day cache
CREATE TABLE IF NOT EXISTS player_sale_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mfl_player_id INTEGER NOT NULL,
  data JSONB,
  last_synced TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Player progression table - stores player stats progression with 4-hour cache
CREATE TABLE IF NOT EXISTS player_progression (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mfl_player_id INTEGER NOT NULL,
  data JSONB,
  last_synced TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Squad IDs table - stores club squad mappings with 7-day cache
CREATE TABLE IF NOT EXISTS squad_ids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mfl_club_id INTEGER NOT NULL,
  mfl_squad_id INTEGER NOT NULL,
  data JSONB,
  last_synced TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(mfl_club_id, mfl_squad_id)
);

-- Match formations table - stores tactical formations with 30-day cache
CREATE TABLE IF NOT EXISTS match_formations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mfl_match_id INTEGER UNIQUE NOT NULL,
  data JSONB,
  last_synced TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Competitions table - stores competition details with 7-day cache
CREATE TABLE IF NOT EXISTS competitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mfl_competition_id INTEGER UNIQUE NOT NULL,
  data JSONB,
  last_synced TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Team statistics table - stores team performance metrics with 4-hour cache
CREATE TABLE IF NOT EXISTS team_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mfl_team_id INTEGER NOT NULL,
  data JSONB,
  last_synced TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Player ratings table - stores ML-generated player ratings with 4-hour cache
CREATE TABLE IF NOT EXISTS player_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mfl_player_id INTEGER UNIQUE NOT NULL,
  data JSONB,
  last_synced TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Market values table - stores calculated market values with 4-hour cache
CREATE TABLE IF NOT EXISTS market_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mfl_player_id INTEGER UNIQUE NOT NULL,
  data JSONB,
  last_synced TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transfer history table - stores all transfer transactions with 7-day cache
CREATE TABLE IF NOT EXISTS transfer_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mfl_transfer_id INTEGER UNIQUE NOT NULL,
  data JSONB,
  last_synced TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seasons table - stores season-specific information with 7-day cache
CREATE TABLE IF NOT EXISTS seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mfl_season_id INTEGER UNIQUE NOT NULL,
  data JSONB,
  last_synced TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- League standings table - stores current league positions with 4-hour cache
CREATE TABLE IF NOT EXISTS league_standings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mfl_league_id INTEGER NOT NULL,
  data JSONB,
  last_synced TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sync status table - tracks data sync status and timestamps
CREATE TABLE IF NOT EXISTS sync_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_type TEXT NOT NULL,
  status TEXT CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')) NOT NULL,
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  last_synced TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(data_type)
);

-- Create indexes for better performance
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

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON players FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_agency_players_updated_at BEFORE UPDATE ON agency_players FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_clubs_updated_at BEFORE UPDATE ON clubs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_matches_updated_at BEFORE UPDATE ON matches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_player_sale_history_updated_at BEFORE UPDATE ON player_sale_history FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_player_progression_updated_at BEFORE UPDATE ON player_progression FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_squad_ids_updated_at BEFORE UPDATE ON squad_ids FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_match_formations_updated_at BEFORE UPDATE ON match_formations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_competitions_updated_at BEFORE UPDATE ON competitions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_team_statistics_updated_at BEFORE UPDATE ON team_statistics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_player_ratings_updated_at BEFORE UPDATE ON player_ratings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_market_values_updated_at BEFORE UPDATE ON market_values FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_transfer_history_updated_at BEFORE UPDATE ON transfer_history FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_seasons_updated_at BEFORE UPDATE ON seasons FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_league_standings_updated_at BEFORE UPDATE ON league_standings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sync_status_updated_at BEFORE UPDATE ON sync_status FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS) for all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_sale_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_progression ENABLE ROW LEVEL SECURITY;
ALTER TABLE squad_ids ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_formations ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfer_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_standings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_status ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (allow all operations for now - can be restricted later)
CREATE POLICY "Allow all operations on users" ON users FOR ALL USING (true);
CREATE POLICY "Allow all operations on players" ON players FOR ALL USING (true);
CREATE POLICY "Allow all operations on agency_players" ON agency_players FOR ALL USING (true);
CREATE POLICY "Allow all operations on clubs" ON clubs FOR ALL USING (true);
CREATE POLICY "Allow all operations on matches" ON matches FOR ALL USING (true);
CREATE POLICY "Allow all operations on player_sale_history" ON player_sale_history FOR ALL USING (true);
CREATE POLICY "Allow all operations on player_progression" ON player_progression FOR ALL USING (true);
CREATE POLICY "Allow all operations on squad_ids" ON squad_ids FOR ALL USING (true);
CREATE POLICY "Allow all operations on match_formations" ON match_formations FOR ALL USING (true);
CREATE POLICY "Allow all operations on competitions" ON competitions FOR ALL USING (true);
CREATE POLICY "Allow all operations on team_statistics" ON team_statistics FOR ALL USING (true);
CREATE POLICY "Allow all operations on player_ratings" ON player_ratings FOR ALL USING (true);
CREATE POLICY "Allow all operations on market_values" ON market_values FOR ALL USING (true);
CREATE POLICY "Allow all operations on transfer_history" ON transfer_history FOR ALL USING (true);
CREATE POLICY "Allow all operations on seasons" ON seasons FOR ALL USING (true);
CREATE POLICY "Allow all operations on league_standings" ON league_standings FOR ALL USING (true);
CREATE POLICY "Allow all operations on sync_status" ON sync_status FOR ALL USING (true);
