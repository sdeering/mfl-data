import { NextRequest, NextResponse } from 'next/server';
import { crawlFormationResults, mflBlockedFor } from '@/src/services/formationResults';

export const maxDuration = 60;

/** Matches read per run: with a pause between requests this fits well inside the function's minute */
const MAX_MATCHES = 120;
const RUN_MS = 50 * 1000;

/**
 * GET /api/cron/formation-meta
 * Run daily by Vercel Cron (see vercel.json): reads more competitive matches from MFL into formation_results,
 * so our own formation meta grows and stays on the current match engine. Vercel sends CRON_SECRET as a bearer
 * token; without it set, the route refuses to run.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  if (!process.env.TURSO_DATABASE_URL) {
    return NextResponse.json({ success: false, error: 'No database' }, { status: 503 });
  }

  const blocked = await mflBlockedFor();
  if (blocked > 0) {
    return NextResponse.json({ success: true, data: { skipped: `MFL blocked for ${blocked}s` } });
  }
  try {
    const report = await crawlFormationResults({ maxMatches: MAX_MATCHES, deadline: Date.now() + RUN_MS });
    console.log('[cron] formation-meta crawl:', report);
    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    console.error('[cron] formation-meta crawl failed:', error);
    return NextResponse.json({ success: false, error: 'Crawl failed' }, { status: 500 });
  }
}
