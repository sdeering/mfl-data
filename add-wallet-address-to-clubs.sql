-- Add wallet_address column to clubs table to fix data isolation issue
-- This ensures each user only sees their own clubs

-- Add wallet_address column to clubs table
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS wallet_address TEXT;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_clubs_wallet_address ON clubs(wallet_address);

-- Update the unique constraint to include wallet_address
-- First, drop the existing unique constraint on mfl_club_id
ALTER TABLE clubs DROP CONSTRAINT IF EXISTS clubs_mfl_club_id_key;

-- Add new unique constraint that includes wallet_address
-- This allows the same club to be associated with multiple wallets
ALTER TABLE clubs ADD CONSTRAINT clubs_mfl_club_id_wallet_unique UNIQUE(mfl_club_id, wallet_address);

-- Add RLS policy to ensure users can only see their own clubs
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;

-- Create policy for clubs table
DROP POLICY IF EXISTS "Users can only see their own clubs" ON clubs;
CREATE POLICY "Users can only see their own clubs" ON clubs
  FOR ALL USING (wallet_address = current_setting('app.current_wallet_address', true));

-- Note: This migration will need to be run manually in Supabase
-- The existing data will need to be cleaned up or migrated
