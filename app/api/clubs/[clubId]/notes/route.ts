import { NextRequest, NextResponse } from 'next/server';
import { MflHttpError, mflBlockedFor } from '@/src/services/formationResults';
import { MflRateLimitError } from '@/src/services/playerProgressionCache';
import { clubOwnership } from '@/src/services/tacticsLog';
import { MAX_NOTES, loadClubNotes, saveClubNotes } from '@/src/services/clubNotes';
import { describeWait, takeRateLimits, visitorKey } from '@/src/lib/rateLimit';
import { sessionWallet } from '@/src/lib/session';

const busy = (seconds: number) =>
  NextResponse.json(
    { success: false, error: `MFL is busy right now. Try again in ${describeWait(seconds)}.` },
    { status: 429, headers: { 'Retry-After': String(seconds) } },
  );

const clubIdOf = async (params: Promise<{ clubId: string }>) => {
  const { clubId } = await params;
  return /^\d+$/.test(clubId) ? Number(clubId) : null;
};

/** Null when the session's wallet owns the club, otherwise the response to send */
async function ownerCheck(request: NextRequest, clubId: number): Promise<NextResponse | null> {
  const wallet = sessionWallet(request);
  if (!wallet) return NextResponse.json({ success: false, error: 'Verify your wallet to use club notes' }, { status: 401 });
  const blocked = await mflBlockedFor();
  if (blocked) return busy(blocked);
  const { owner } = await clubOwnership(clubId);
  if (!owner || owner.toLowerCase() !== wallet) {
    return NextResponse.json({ success: false, error: 'Only the club owner can see or change its notes' }, { status: 403 });
  }
  return null;
}

const failed = (error: unknown, clubId: number, what: string) => {
  if (error instanceof MflRateLimitError) return busy(error.retryAfterSeconds);
  console.error(`[API] ${what} /api/clubs/${clubId}/notes failed:`, error);
  const status = error instanceof MflHttpError && error.status === 404 ? 404 : 502;
  return NextResponse.json({ success: false, error: status === 404 ? `No MFL club with ID ${clubId}` : 'Could not reach the club notes' }, { status });
};

/**
 * GET /api/clubs/[clubId]/notes
 * The owner's notes on the club, which the AI match analysis reads. Private to the owner.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ clubId: string }> }) {
  const clubId = await clubIdOf(params);
  if (!clubId) return NextResponse.json({ success: false, error: 'Club ID must be a number' }, { status: 400 });
  if (!process.env.TURSO_DATABASE_URL) return NextResponse.json({ success: false, error: 'Club notes need the database' }, { status: 503 });
  try {
    const denied = await ownerCheck(request, clubId);
    if (denied) return denied;
    return NextResponse.json({ success: true, data: await loadClubNotes(clubId) });
  } catch (error) {
    return failed(error, clubId, 'GET');
  }
}

/**
 * PUT /api/clubs/[clubId]/notes { notes }
 * Keeps the owner's notes on the club, up to MAX_NOTES characters; blank forgets them.
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ clubId: string }> }) {
  const clubId = await clubIdOf(params);
  if (!clubId) return NextResponse.json({ success: false, error: 'Club ID must be a number' }, { status: 400 });
  if (!process.env.TURSO_DATABASE_URL) return NextResponse.json({ success: false, error: 'Club notes need the database' }, { status: 503 });
  const body = await request.json().catch(() => null);
  if (typeof body?.notes !== 'string' || body.notes.length > MAX_NOTES) {
    return NextResponse.json({ success: false, error: `Notes must be text of at most ${MAX_NOTES} characters` }, { status: 400 });
  }
  try {
    const wait = await takeRateLimits([{ key: `club-notes:${visitorKey(request)}`, limit: 60, windowMs: 10 * 60 * 1000 }]);
    if (wait) return busy(wait);
    const denied = await ownerCheck(request, clubId);
    if (denied) return denied;
    await saveClubNotes(clubId, body.notes, sessionWallet(request)!);
    return NextResponse.json({ success: true, data: await loadClubNotes(clubId) });
  } catch (error) {
    return failed(error, clubId, 'PUT');
  }
}
