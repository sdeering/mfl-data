-- Add missing columns to matches table
-- This migration adds wallet_address and club_id columns to the existing matches table

-- Add wallet_address column
ALTER TABLE matches ADD COLUMN IF NOT EXISTS wallet_address TEXT;

-- Add club_id column  
ALTER TABLE matches ADD COLUMN IF NOT EXISTS club_id TEXT;

-- Update existing records to have default values (optional - you may want to handle this differently)
-- UPDATE matches SET wallet_address = 'unknown' WHERE wallet_address IS NULL;
-- UPDATE matches SET club_id = 'unknown' WHERE club_id IS NULL;

-- Make the columns NOT NULL after updating existing data (uncomment when ready)
-- ALTER TABLE matches ALTER COLUMN wallet_address SET NOT NULL;
-- ALTER TABLE matches ALTER COLUMN club_id SET NOT NULL;

