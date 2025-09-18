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
    const body = JSON.stringify({ source, endpoint: endpoint ?? 'misc' })
    const base = process.env.NEXT_PUBLIC_SITE_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
    // Always use our own API route (server logs to Supabase). Avoid direct RPC to prevent 404s on prod.
    await fetch(`${base}/api/usage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
  } catch {
    // Silent best-effort logging; do not throw
  }
}


