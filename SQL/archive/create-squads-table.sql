-- Create squads table for storing user-created squads
CREATE TABLE IF NOT EXISTS squads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    squad_name TEXT NOT NULL,
    formation_id TEXT NOT NULL,
    players JSONB NOT NULL, -- Store player positions and IDs as JSON
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique squad names per wallet
    UNIQUE(wallet_address, squad_name)
);

-- Create index for faster lookups by wallet address
CREATE INDEX IF NOT EXISTS idx_squads_wallet_address ON squads(wallet_address);

-- Create index for faster lookups by formation
CREATE INDEX IF NOT EXISTS idx_squads_formation ON squads(formation_id);

-- Add RLS (Row Level Security) policies
ALTER TABLE squads ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own squads
CREATE POLICY "Users can view their own squads" ON squads
    FOR SELECT USING (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');

CREATE POLICY "Users can insert their own squads" ON squads
    FOR INSERT WITH CHECK (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');

CREATE POLICY "Users can update their own squads" ON squads
    FOR UPDATE USING (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');

CREATE POLICY "Users can delete their own squads" ON squads
    FOR DELETE USING (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_squads_updated_at 
    BEFORE UPDATE ON squads 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
