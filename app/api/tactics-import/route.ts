import { NextRequest, NextResponse } from 'next/server';
import { mflBlockedFor } from '@/src/services/formationResults';
import { MflRateLimitError } from '@/src/services/playerProgressionCache';
import { clubOwnership, importReportTactics, importedMatchIds } from '@/src/services/tacticsLog';
import { describeWait, takeRateLimits, visitorKey } from '@/src/lib/rateLimit';
import type { ReportFormation } from '@/src/utils/mflTactics';

/*
 * The MFL import (public/mfl-import.js) runs on app.playmfl.com, where the club owner is logged in and MFL's match
 * reports show their tactics, and sends each match's here to log. Only that site may call it from a browser.
 */

export const maxDuration = 30;

const CORS = {
  'Access-Control-Allow-Origin': 'https://app.playmfl.com',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
  Vary: 'Origin',
};

const reply = (body: object, status = 200, headers: Record<string, string> = {}) => NextResponse.json(body, { status, headers: { ...CORS, ...headers } });

const busy = (seconds: number) =>
  reply({ success: false, error: `MFL Data is busy with MFL right now. Try again in ${describeWait(seconds)}.` }, 429, { 'Retry-After': String(seconds) });

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/**
 * GET /api/tactics-import?clubId=
 * The club's matches already imported from MFL, which the import skips: MFL's report of a played match doesn't change.
 */
export async function GET(request: NextRequest) {
  const clubId = Number(request.nextUrl.searchParams.get('clubId'));
  if (!Number.isInteger(clubId) || clubId <= 0) return reply({ success: false, error: 'Club ID must be a number' }, 400);
  if (!process.env.TURSO_DATABASE_URL) return reply({ success: false, error: 'The tactics log needs the database' }, 503);
  try {
    return reply({ success: true, imported: await importedMatchIds(clubId) });
  } catch (error) {
    console.error(`[API] GET /api/tactics-import for club ${clubId} failed:`, error);
    return reply({ success: false, error: 'Could not read the tactics log' }, 502);
  }
}

/** MFL's team settings and individual instructions, all the import needs from a report's formation */
const FORMATION_KEYS = [
  'type',
  'playersInstructions',
  'width',
  'directness',
  'sideAttackLeft',
  'farShot',
  'crosses',
  'dribble',
  'offensiveEngagement',
  'depth',
  'compactness',
  'pressing',
  'aggressivity',
  'clearance',
];

/**
 * POST /api/tactics-import { walletAddress, clubId, matchId, formation, report: { ours, theirs } }
 * Logs the tactics from MFL's report of one of the club's played matches, with the match's facts: both sides'
 * playersStats from the report give our players' lines and the xG. Answers with the outcome: saved, updated,
 * unchanged (already logged the same) or skipped with the reason.
 */
export async function POST(request: NextRequest) {
  if (!process.env.TURSO_DATABASE_URL) return reply({ success: false, error: 'The tactics log needs the database' }, 503);
  const body = await request.json().catch(() => null);
  const walletAddress = typeof body?.walletAddress === 'string' ? body.walletAddress.trim().toLowerCase() : '';
  const clubId = Number(body?.clubId);
  const matchId = Number(body?.matchId);
  const raw = body?.formation;
  if (!walletAddress || !Number.isInteger(clubId) || clubId <= 0 || !Number.isInteger(matchId) || matchId <= 0 || !raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return reply({ success: false, error: 'Give the wallet, the club, the match and its formation from the report' }, 400);
  }
  const formation = Object.fromEntries(FORMATION_KEYS.filter(key => key in raw).map(key => [key, raw[key]])) as ReportFormation;
  const instructions = formation.playersInstructions;
  if (instructions !== undefined && instructions !== null && (typeof instructions !== 'object' || Array.isArray(instructions) || Object.keys(instructions).length > 30)) {
    return reply({ success: false, error: 'Player instructions should be by position' }, 400);
  }

  try {
    const wait = (await mflBlockedFor()) || (await takeRateLimits([{ key: `tactics-import:${visitorKey(request)}`, limit: 200, windowMs: 10 * 60 * 1000 }]));
    if (wait) return busy(wait);
    const { squadId, owner } = await clubOwnership(clubId);
    if (!owner || owner.toLowerCase() !== walletAddress) return reply({ success: false, error: 'Only the club owner can log its tactics' }, 403);
    if (!squadId) return reply({ success: false, error: 'MFL has no squad for this club' }, 404);
    const report = body?.report && typeof body.report === 'object' ? { ours: body.report.ours, theirs: body.report.theirs } : {};
    const outcome = await importReportTactics(clubId, squadId, matchId, formation, walletAddress, report);
    return reply({ success: true, ...outcome });
  } catch (error) {
    if (error instanceof MflRateLimitError) return busy(error.retryAfterSeconds);
    console.error(`[API] POST /api/tactics-import for club ${clubId}, match ${matchId} failed:`, error);
    return reply({ success: false, error: 'Could not log the tactics' }, 502);
  }
}
