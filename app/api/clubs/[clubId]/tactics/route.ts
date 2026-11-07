import { NextRequest, NextResponse } from 'next/server';
import { MflHttpError, mflBlockedFor } from '@/src/services/formationResults';
import { MflRateLimitError } from '@/src/services/playerProgressionCache';
import { buildTacticsHistory, clubOwnership, clubPlaysIn, saveTacticsEntry } from '@/src/services/tacticsLog';
import { describeWait, takeRateLimits, visitorKey } from '@/src/lib/rateLimit';
import { validPlayerSettings, validSettings } from '@/src/utils/tacticsHistory';

export const maxDuration = 60;

const busy = (seconds: number) =>
  NextResponse.json(
    { success: false, error: `MFL is busy right now. Try again in ${describeWait(seconds)}.` },
    { status: 429, headers: { 'Retry-After': String(seconds) } },
  );

const clubIdOf = async (params: Promise<{ clubId: string }>) => {
  const { clubId } = await params;
  return /^\d+$/.test(clubId) ? Number(clubId) : null;
};

/**
 * GET /api/clubs/[clubId]/tactics
 * The club's tactics log: its latest played matches with the playing style settings logged for each, their
 * formations and xG, and settings logged ahead of matches not played yet.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ clubId: string }> }) {
  const clubId = await clubIdOf(params);
  if (!clubId) return NextResponse.json({ success: false, error: 'Club ID must be a number' }, { status: 400 });
  if (!process.env.TURSO_DATABASE_URL) return NextResponse.json({ success: false, error: 'The tactics log needs the database' }, { status: 503 });
  try {
    const blocked = await mflBlockedFor();
    if (blocked) return busy(blocked);
    return NextResponse.json({ success: true, data: await buildTacticsHistory(clubId) });
  } catch (error) {
    if (error instanceof MflRateLimitError) return busy(error.retryAfterSeconds);
    console.error(`[API] GET /api/clubs/${clubId}/tactics failed:`, error);
    const status = error instanceof MflHttpError && error.status === 404 ? 404 : 502;
    return NextResponse.json({ success: false, error: status === 404 ? `No MFL club with ID ${clubId}` : 'Could not load the tactics log' }, { status });
  }
}

/**
 * PUT /api/clubs/[clubId]/tactics { walletAddress, matchId, settings, players? }
 * Keeps the settings and individual instructions (by player ID) used, or to be used, in one of the club's
 * matches; settings null forgets them. Only the wallet that owns the club on MFL can.
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ clubId: string }> }) {
  const clubId = await clubIdOf(params);
  if (!clubId) return NextResponse.json({ success: false, error: 'Club ID must be a number' }, { status: 400 });
  if (!process.env.TURSO_DATABASE_URL) return NextResponse.json({ success: false, error: 'The tactics log needs the database' }, { status: 503 });

  const body = await request.json().catch(() => null);
  const walletAddress = typeof body?.walletAddress === 'string' ? body.walletAddress.trim().toLowerCase() : '';
  const matchId = Number(body?.matchId);
  const settings = body?.settings === null ? null : validSettings(body?.settings);
  const players = validPlayerSettings(body?.players);
  if (!walletAddress || !Number.isInteger(matchId) || matchId <= 0 || (body?.settings !== null && !settings)) {
    return NextResponse.json({ success: false, error: 'Give your wallet, the match and every setting as a step from 1 to 5' }, { status: 400 });
  }
  if (!players) {
    return NextResponse.json({ success: false, error: 'Give each player’s instructions as steps from 1 to 5, for 11 players at most' }, { status: 400 });
  }

  try {
    const wait = (await mflBlockedFor()) || (await takeRateLimits([{ key: `tactics-log:${visitorKey(request)}`, limit: 60, windowMs: 10 * 60 * 1000 }]));
    if (wait) return busy(wait);
    const { squadId, owner } = await clubOwnership(clubId);
    if (!owner || owner.toLowerCase() !== walletAddress) {
      return NextResponse.json({ success: false, error: 'Only the club owner can log its tactics' }, { status: 403 });
    }
    if (!squadId || !(await clubPlaysIn(squadId, matchId))) {
      return NextResponse.json({ success: false, error: "That match isn't one of this club's" }, { status: 400 });
    }
    await saveTacticsEntry(clubId, matchId, settings, players, walletAddress);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof MflRateLimitError) return busy(error.retryAfterSeconds);
    console.error(`[API] PUT /api/clubs/${clubId}/tactics failed:`, error);
    return NextResponse.json({ success: false, error: 'Could not save the tactics' }, { status: 502 });
  }
}
