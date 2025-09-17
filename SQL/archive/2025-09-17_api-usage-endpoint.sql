-- Add endpoint breakdown to API usage tracking

-- 1) Add endpoint column and adjust primary key
ALTER TABLE IF EXISTS public.api_usage_daily
  ADD COLUMN IF NOT EXISTS endpoint TEXT NOT NULL DEFAULT 'unknown';

-- Drop existing PK and create composite PK (date, source, endpoint)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.api_usage_daily'::regclass
      AND contype = 'p'
  ) THEN
    EXECUTE 'ALTER TABLE public.api_usage_daily DROP CONSTRAINT ' || (
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'public.api_usage_daily'::regclass AND contype = 'p'
      LIMIT 1
    );
  END IF;
END$$;

ALTER TABLE public.api_usage_daily
  ADD CONSTRAINT api_usage_daily_pkey PRIMARY KEY (date, source, endpoint);

-- 2) Replace increment function to accept endpoint
CREATE OR REPLACE FUNCTION public.increment_api_usage(src text, endpoint text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  ep TEXT := COALESCE(endpoint, 'unknown');
BEGIN
  INSERT INTO public.api_usage_daily (date, source, endpoint, count)
  VALUES (CURRENT_DATE, src, ep, 1)
  ON CONFLICT (date, source, endpoint)
  DO UPDATE SET count = public.api_usage_daily.count + 1,
                updated_at = NOW();
END;
$$;

-- 3) Replace read function to include endpoint
-- Rename parameter to avoid conflict with returned column name
CREATE OR REPLACE FUNCTION public.get_api_usage(from_date date, src text DEFAULT NULL, p_endpoint text DEFAULT NULL)
RETURNS TABLE(date date, source text, endpoint text, count integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT d.date, d.source, d.endpoint, d.count
  FROM public.api_usage_daily d
  WHERE d.date >= from_date
    AND (src IS NULL OR d.source = src)
    AND (p_endpoint IS NULL OR d.endpoint = p_endpoint)
  ORDER BY d.date ASC, d.source ASC, d.endpoint ASC;
END;
$$;

-- 4) Permissions
GRANT EXECUTE ON FUNCTION public.increment_api_usage(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_api_usage(date, text, text) TO anon;


