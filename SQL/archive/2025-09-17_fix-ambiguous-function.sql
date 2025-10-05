-- Fix ambiguous function issue by dropping all versions and recreating with correct parameter names

-- Drop all existing versions of the function
DROP FUNCTION IF EXISTS public.get_api_usage(date, text);
DROP FUNCTION IF EXISTS public.get_api_usage(date, text, text);

-- Recreate the function with the correct parameter names to avoid ambiguity
CREATE OR REPLACE FUNCTION public.get_api_usage(from_date date, p_src text DEFAULT NULL, p_endpoint text DEFAULT NULL)
RETURNS TABLE(date date, source text, endpoint text, count integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT d.date, d.source, d.endpoint, d.count
  FROM public.api_usage_daily d
  WHERE d.date >= from_date
    AND (p_src IS NULL OR d.source = p_src)
    AND (p_endpoint IS NULL OR d.endpoint = p_endpoint)
  ORDER BY d.date ASC, d.source ASC, d.endpoint ASC;
END;
$$;

-- Update permissions
GRANT EXECUTE ON FUNCTION public.get_api_usage(date, text, text) TO anon;
