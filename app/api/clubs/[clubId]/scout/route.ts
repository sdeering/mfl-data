import { NextRequest, NextResponse } from 'next/server';
import { MAX_SCOUT_MATCHES, type ScoutMatch, type ScoutReport } from '@/src/services/scoutService';
import {
  MflHttpError,
  fetchMflCached,
  keptFormationResults,
  mflBlockedFor,
  recordFormationResults,
  toFormationResult,
  type FormationResult,
  type ListedMatch,
  type MatchDetails,
} from '@/src/services/formationResults';
import { MflRateLimitError } from '@/src/services/playerProgressionCache';
import { describeWait, takeRateLimits, visitorKey, type RateLimit } from '@/src/lib/rateLimit';
import type { MFLPlayer } from '@/src/types/mflApi';

/** Match details asked for at once */
const CONCURRENCY = 3;
const HOUR = 3600;

// A report can take ~20 MFL requests when none are cached, and MFL blocks the token after ~65 in 10 seconds,
// so the site scouts at most 3 clubs every 10 seconds, and one visitor 30 every 10 minutes.
const SCOUT_LIMITS: RateLimit[] = [
  { key: 'mfl-scout:10s', limit: 3, windowMs: 10 * 1000 },
  { key: 'mfl-scout:1m', limit: 12, windowMs: 60 * 1000 },
];
const visitorScoutLimit = (visitor: string): RateLimit => ({ key: `mfl-scout:${visitor}`, limit: 30, windowMs: 10 * 60 * 1000 });

interface ClubCompetition {
  type: string;
  status: string;
  season?: { name?: string };
}

/** Runs `task` over every item, a few at a time. */
async function mapLimited<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

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

    const [club, players, competitions] = await Promise.all([
      fetchMflCached<any>(`/clubs/${clubId}`, 24 * HOUR),
      fetchMflCached<MFLPlayer[]>(`/clubs/${clubId}/players`, HOUR),
      fetchMflCached<ClubCompetition[]>(`/clubs/${clubId}/competitions`, HOUR).catch(() => []),
    ]);
    const league = Array.isArray(competitions)
      ? competitions.find(competition => competition.type === 'LEAGUE' && competition.status !== 'ENDED')
      : undefined;
    const squadId: number | undefined = club.squads?.[0]?.id;
    const listed = squadId
      ? await fetchMflCached<ListedMatch[]>(`/matches?squadId=${squadId}&past=true&onlyCompetitions=true&limit=${limit}`, HOUR)
      : [];

    const kept = await keptFormationResults(listed.map(match => match.id));
    const fresh: FormationResult[] = [];
    const matches = await mapLimited(listed, CONCURRENCY, async (match): Promise<ScoutMatch> => {
      let result = kept.get(match.id) ?? null;
      if (!result) {
        const details = await fetchMflCached<MatchDetails>(`/matches/${match.id}?withFormations=true`, 168 * HOUR).catch(error => {
          if (error instanceof MflRateLimitError) throw error;
          return null;
        });
        result = details && toFormationResult(match.id, { ...details, startDate: details.startDate ?? match.startDate });
        if (result) fresh.push(result);
      }
      const home = match.homeSquad.id === squadId;
      const opponent = home ? match.awaySquad.club : match.homeSquad.club;
      return {
        id: match.id,
        startDate: match.startDate,
        competition: match.competition?.name ?? '',
        opponent: { clubId: opponent.id, name: home ? match.awayTeamName : match.homeTeamName, logoVersion: opponent.logoVersion },
        goalsFor: (home ? match.homeScore : match.awayScore) ?? 0,
        goalsAgainst: (home ? match.awayScore : match.homeScore) ?? 0,
        formation: (home ? result?.homeFormation : result?.awayFormation) ?? null,
        opponentFormation: (home ? result?.awayFormation : result?.homeFormation) ?? null,
      };
    });
    await recordFormationResults(fresh);

    const report: ScoutReport = {
      club: {
        id: club.id,
        name: club.name,
        division: club.division ?? null,
        logoVersion: club.logoVersion,
        city: club.city,
        country: club.country,
      },
      season: league?.season?.name ?? null,
      players: Array.isArray(players) ? players : [],
      matches,
    };
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
