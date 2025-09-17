jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: any, init?: any) => ({
      status: init?.status ?? 200,
      json: async () => data,
    }),
  },
}));

import { GET, POST } from '../../app/api/usage/route'

describe('API Usage Integration (Supabase)', () => {
  const hasEnv = !!(
    (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL) &&
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)
  )

  const today = new Date().toISOString().slice(0, 10)

  it('increments and reads daily usage (skips if env missing)', async () => {
    if (!hasEnv) {
      // Skip gracefully when env not configured
      expect(true).toBe(true)
      return
    }

    // Baseline
    const getReq1: any = { url: 'http://localhost/api/usage?source=mfl' }
    const res1: any = await GET(getReq1)
    const payload1 = await res1.json()
    const baseline = (payload1.data || []).find((r: any) => r.date === today)?.count || 0

    // Increment twice
    const postReq: any = { json: async () => ({ source: 'mfl' }) }
    await POST(postReq)
    await POST(postReq)

    // Read again
    const getReq2: any = { url: 'http://localhost/api/usage?source=mfl' }
    const res2: any = await GET(getReq2)
    const payload2 = await res2.json()
    const after = (payload2.data || []).find((r: any) => r.date === today)?.count || 0

    expect(after).toBeGreaterThanOrEqual(baseline + 2)
  })
})



