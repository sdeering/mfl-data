-- Track external API usage per day (counts real outbound requests; exclude cache hits)
CREATE TABLE IF NOT EXISTS api_usage_daily (
  date DATE NOT NULL,
  source TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (date, source)
);

-- Optional RLS depending on your setup. Typically allow server role only.
ALTER TABLE api_usage_daily ENABLE ROW LEVEL SECURITY;

-- You may add policies to restrict access as needed. Example (server-only):
-- CREATE POLICY "server can read/write" ON api_usage_daily FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Atomic increment function
CREATE OR REPLACE FUNCTION increment_api_usage(src text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO api_usage_daily (date, source, count)
  VALUES (CURRENT_DATE, src, 1)
  ON CONFLICT (date, source)
  DO UPDATE SET count = api_usage_daily.count + 1,
                updated_at = NOW();
END;
$$;

-- Read function (bypasses RLS with SECURITY DEFINER) to fetch last N days
CREATE OR REPLACE FUNCTION get_api_usage(from_date date, src text DEFAULT NULL)
RETURNS TABLE(date date, source text, count integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT d.date, d.source, d.count
  FROM api_usage_daily d
  WHERE d.date >= from_date
    AND (src IS NULL OR d.source = src)
  ORDER BY d.date ASC;
END;
$$;


