-- Fix ambiguous parameter names in RPCs by using prefixed args

-- increment_api_usage: ensure parameters are p_source and p_endpoint
CREATE OR REPLACE FUNCTION public.increment_api_usage(p_source TEXT, p_endpoint TEXT DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.api_usage_daily (date, source, endpoint, count)
  VALUES (CURRENT_DATE, p_source, COALESCE(p_endpoint, 'unknown'), 1)
  ON CONFLICT (date, source, endpoint) DO UPDATE
  SET count = api_usage_daily.count + 1, updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- get_api_usage: ensure parameters are from_date, p_source, p_endpoint
CREATE OR REPLACE FUNCTION public.get_api_usage(from_date DATE, p_source TEXT DEFAULT NULL, p_endpoint TEXT DEFAULT NULL)
RETURNS TABLE(date DATE, source TEXT, endpoint TEXT, count INT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    uad.date,
    uad.source,
    uad.endpoint,
    uad.count
  FROM
    public.api_usage_daily uad
  WHERE
    uad.date >= from_date
    AND (p_source IS NULL OR uad.source = p_source)
    AND (p_endpoint IS NULL OR uad.endpoint = p_endpoint)
  ORDER BY
    uad.date ASC, uad.source ASC, uad.endpoint ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.increment_api_usage(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_api_usage(date, text, text) TO anon;


