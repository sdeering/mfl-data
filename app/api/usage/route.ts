import { NextRequest, NextResponse } from 'next/server'
import { incrementApiUsage, getApiUsage } from '../../../src/lib/db-helpers'

// POST: increment usage for a source (e.g., 'mfl') for today
export async function POST(req: NextRequest) {
  try {
    // Short-circuit in tests/CI to avoid DB writes and noise
    if (
      process.env.NEXT_PUBLIC_DISABLE_API_USAGE === '1' ||
      process.env.DISABLE_API_USAGE === '1' ||
      process.env.NODE_ENV === 'test'
    ) {
      return NextResponse.json({ success: true, disabled: true })
    }

    const { source, endpoint } = await req.json()
    if (!source) return NextResponse.json({ error: 'source required' }, { status: 400 })

    const { error } = await incrementApiUsage(source, endpoint)
    if (error) {
      console.warn('POST /api/usage incrementApiUsage error:', error)
      return NextResponse.json({ success: false, error: error.message })
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
    const fromDate = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    const { data, error } = await getApiUsage(fromDate, source, null)
    if (error) {
      return NextResponse.json({ data: [] })
    }

    return NextResponse.json({ data: data || [] })
  } catch (e: any) {
    return NextResponse.json({ data: [] })
  }
}
