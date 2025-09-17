// Lightweight client to record external API usage counts (best-effort)
// Records only on actual outbound requests (call sites must invoke on cache miss / real network success)

export async function incrementUsage(source: string, endpoint?: string): Promise<void> {
  try {
    // Skip logging in tests/CI or when explicitly disabled
    if (
      process.env.NEXT_PUBLIC_DISABLE_API_USAGE === '1' ||
      process.env.DISABLE_API_USAGE === '1' ||
      process.env.NODE_ENV === 'test'
    ) {
      return
    }

    const isBrowser = typeof window !== 'undefined'
    if (isBrowser && (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
      // Prefer client-side Supabase RPC (SECURITY DEFINER) so logging works even if server lacks env
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL as string,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
        { auth: { persistSession: false } }
      )
      await supabase.rpc('increment_api_usage', { src: source, p_endpoint: endpoint ?? 'misc' })
      return
    }

    // If in browser without public Supabase creds, skip to avoid ad-blocked network errors
    if (isBrowser) {
      return
    }

    // Server-side fallback to API route
    const body = JSON.stringify({ source, endpoint: endpoint ?? 'misc' })
    const base = process.env.NEXT_PUBLIC_SITE_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
    await fetch(`${base}/api/usage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
  } catch {
    // Silent best-effort logging; do not throw
  }
}


