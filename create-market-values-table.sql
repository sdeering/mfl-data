-- Create market_values table if it doesn't exist
-- This ensures the table has the correct structure for storing market value data

CREATE TABLE IF NOT EXISTS market_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mfl_player_id INTEGER UNIQUE NOT NULL,
  data JSONB,
  last_synced TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_market_values_mfl_player_id ON market_values(mfl_player_id);

-- Enable Row Level Security
ALTER TABLE market_values ENABLE ROW LEVEL SECURITY;

-- Create RLS policy (allow all operations for now)
DROP POLICY IF EXISTS "Allow all operations on market_values" ON market_values;
CREATE POLICY "Allow all operations on market_values" ON market_values FOR ALL USING (true);

-- Create updated_at trigger
CREATE TRIGGER update_market_values_updated_at 
  BEFORE UPDATE ON market_values 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();
