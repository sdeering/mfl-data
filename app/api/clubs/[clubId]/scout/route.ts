import { NextRequest, NextResponse } from 'next/server';
import { MAX_SCOUT_MATCHES } from '@/src/services/scoutService';
import { MflHttpError, mflBlockedFor } from '@/src/services/formationResults';
import { MflRateLimitError } from '@/src/services/playerProgressionCache';
import { SCOUT_LIMITS, buildScoutReport } from '@/src/services/scoutReportBuilder';
import { describeWait, takeRateLimits, visitorKey, type RateLimit } from '@/src/lib/rateLimit';

const visitorScoutLimit = (visitor: string): RateLimit => ({ key: `mfl-scout:${visitor}`, limit: 30, windowMs: 10 * 60 * 1000 });

/** Seconds to wait before scouting again, 0 when it can go ahead. Without a database there are no limits. */
async function scoutWait(request: NextRequest): Promise<number> {
  if (!process.env.TURSO_DATABASE_URL) return 0;
  return (await mflBlockedFor()) || (await takeRateLimits([visitorScoutLimit(visitorKey(request)), ...SCOUT_LIMITS]));
}

/**
 * GET /api/clubs/[clubId]/scout?limit=10
 * A club's squad and its latest competitive matches with the formation each side played, for the formation
 * planner on the Matches page. Formations come from our own formation results when kept already, otherwise from
 * MFL, and each new one is kept, adding to our formation meta.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ clubId: string }> }) {
  const { clubId } = await params;
  if (!/^\d+$/.test(clubId)) {
    return NextResponse.json({ success: false, error: 'Club ID must be a number' }, { status: 400 });
  }
  const requested = Number(new URL(request.url).searchParams.get('limit')) || 10;
  const limit = Math.min(Math.max(1, requested), MAX_SCOUT_MATCHES);

  const busy = (seconds: number) =>
    NextResponse.json(
      { success: false, error: `MFL is busy right now. Try again in ${describeWait(seconds)}.` },
      { status: 429, headers: { 'Retry-After': String(seconds) } },
    );

  try {
    const wait = await scoutWait(request);
    if (wait > 0) return busy(wait);

    const report = await buildScoutReport(clubId, limit);
    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    if (error instanceof MflRateLimitError) return busy(error.retryAfterSeconds);
    const status = error instanceof MflHttpError ? error.status : 500;
    console.error(`[API] /api/clubs/${clubId}/scout failed:`, error);
    return NextResponse.json(
      { success: false, error: status === 404 ? `No MFL club with ID ${clubId}` : 'Could not load this club from MFL' },
      { status: status === 404 ? 404 : 502 },
    );
  }
}
