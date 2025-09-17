import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  if (!url || !key) {
    // Return null to allow graceful fallback
    return null as any
  }
  return createClient(url, key, { auth: { persistSession: false } })
}

// POST: increment usage for a source (e.g., 'mfl') for today
export async function POST(req: NextRequest) {
  try {
    const { source, endpoint } = await req.json()
    if (!source) return NextResponse.json({ error: 'source required' }, { status: 400 })

    const supabase = getSupabase()
    if (!supabase) {
      // Best-effort: if no env, succeed without recording
      return NextResponse.json({ success: true, note: 'env not configured' })
    }
    const today = new Date().toISOString().slice(0, 10)

    // Use RPC for atomic increment (created in SQL): increment_api_usage(source)
    const { error } = await supabase.rpc('increment_api_usage', { p_source: source, p_endpoint: endpoint ?? null })
    if (error) {
      console.warn('POST /api/usage increment_api_usage error, falling back:', error)
      // Fallback (non-atomic): ensure row exists, then bump count
      const today = new Date().toISOString().slice(0, 10)

      // Ensure row exists
      await supabase
        .from('api_usage_daily')
        .upsert({ date: today, source, endpoint: endpoint ?? 'unknown', count: 0 }, { onConflict: 'date,source,endpoint' })

      // Read current
      const { data: existing, error: selErr } = await supabase
        .from('api_usage_daily')
        .select('count')
        .eq('date', today)
        .eq('source', source)
        .eq('endpoint', endpoint ?? 'unknown')
        .maybeSingle()
      if (selErr) {
        return NextResponse.json({ success: false, error: selErr.message })
      }
      const next = (existing?.count ?? 0) + 1
      const { error: updErr } = await supabase
        .from('api_usage_daily')
        .update({ count: next, updated_at: new Date().toISOString() })
        .eq('date', today)
        .eq('source', source)
        .eq('endpoint', endpoint ?? 'unknown')
      if (updErr) {
        return NextResponse.json({ success: false, error: updErr.message })
      }

      return NextResponse.json({ success: true, fallback: true })
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    // Do not surface internal errors to UI; keep page functional
    return NextResponse.json({ success: true, note: 'error suppressed' })
  }
}

// GET: last 30 days usage per day for a source (or all combined if none)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const source = searchParams.get('source') || undefined

    const supabase = getSupabase()
    if (!supabase) {
      return NextResponse.json({ data: [] })
    }
    const fromDate = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    // Use RPC that runs as SECURITY DEFINER to bypass RLS for safe reads
    const { data, error } = await supabase
      .rpc('get_api_usage', { from_date: fromDate, p_source: source ?? null, p_endpoint: null })
    if (!error && Array.isArray(data)) {
      return NextResponse.json({ data })
    }

    // Fallback: direct select from table
    let sel = supabase
      .from('api_usage_daily')
      .select('date, source, endpoint, count')
      .gte('date', fromDate)
      .order('date', { ascending: true })
    if (source) sel = sel.eq('source', source)
    const { data: direct, error: dirErr } = await sel
    if (dirErr) {
      return NextResponse.json({ data: [] })
    }
    return NextResponse.json({ data: direct })
  } catch (e: any) {
    return NextResponse.json({ data: [] })
  }
}


