import { NextRequest, NextResponse } from 'next/server';
import { MflHttpError, fetchMflCached, mflBlockedFor } from '@/src/services/formationResults';
import type { ScoutMatch } from '@/src/services/scoutService';
import { MflRateLimitError } from '@/src/services/playerProgressionCache';
import { SCOUT_LIMITS, buildScoutReport, scoutDataVersion } from '@/src/services/scoutReportBuilder';
import { buildTacticsHistory, clubPlaysIn, tacticsAccess, loadTacticsEntries, saveAdvice } from '@/src/services/tacticsLog';
import { adviceFrom } from '@/src/utils/tacticsHistory';
import type { Outcome } from '@/src/utils/formationPlanner';
import {
  ANALYSIS_SCHEMA,
  buildAnalysisPrompt,
  cleanPlayerInstructions,
  cleanTactics,
  cleanTeam,
  type MatchAnalysis,
  type MatchAnalysisRequest,
  type MatchReport,
  type RankedCounter,
  type SideReport,
  type UpcomingFixture,
} from '@/src/services/matchAnalysis';
import { describeWait, takeRateLimits, visitorKey } from '@/src/lib/rateLimit';
import { analysisAllowance, analysisLimits } from '@/src/lib/aiAccess';
import { sessionWallet } from '@/src/lib/session';
import { FORMATIONS } from '@/src/utils/squadLineups';
import { isOutcome } from '@/src/utils/formationPlanner';
import { loadClubNotes, notesKey, type NotesScope } from '@/src/services/clubNotes';
import { findSavedAnalysis, fingerprintOf, latestSavedAnalysis, saveAnalysis } from '@/src/services/savedAnalyses';

// Gemini's own time, plus reading both squads and their reports from MFL first
export const maxDuration = 300;

const GEMINI_PROXY_URL = process.env.GEMINI_PROXY_URL || 'https://gcloud-proxy-179582583097.us-central1.run.app';
const MODEL = 'gemini-3.8-flash';
/** A long prompt with a full answer schema can keep Gemini thinking well past a minute */
const TIMEOUT_MS = 240 * 1000;
/** Must match what the Matches page scouts, so the reports come from the same cache */
const OUR_MATCHES = 15;
const THEIR_MATCHES = 10;
/** Their latest matches whose per-player stats it reads */
const REPORTED_MATCHES = 5;
/** Changes when the prompt or the answer does, so older analyses aren't served again */
const PROMPT_VERSION = 'v13';
/** How long an analysis is kept in memory, where there's no database to keep it in */
const CACHE_MS = 6 * 3600 * 1000;


/** A wait as hours once it's over an hour and a half, e.g. "8 hours" */
const inHours = (seconds: number) => (seconds > 5400 ? `${Math.round(seconds / 3600)} hours` : describeWait(seconds));

const cache = new Map<string, { analysis: MatchAnalysis; at: number }>();

/** For a club the wallet neither owns nor manages for its owner (tacticsAccess) */
const NOT_YOURS = 'AI analysis is for clubs you own, or manage on MFL with the tactics permission';

const isId = (value: unknown): value is number => Number.isInteger(value) && (value as number) > 0;
const isFormation = (value: unknown): value is string => typeof value === 'string' && value in FORMATIONS;
const share = (value: unknown) => Math.min(1, Math.max(0, Number(value) || 0));

/** The request's counters, cut to what the prompt needs */
function readCounters(value: unknown): RankedCounter[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(counter => counter && isFormation(counter.formation))
    .slice(0, 5)
    .map(counter => ({
      formation: counter.formation,
      win: share(counter.win),
      draw: share(counter.draw),
      loss: share(counter.loss),
      points: Math.min(3, Math.max(0, Number(counter.points) || 0)),
      ...(Number.isFinite(Number(counter.goalsFor)) && counter.goalsFor !== undefined
        ? { goalsFor: Math.min(10, Math.max(0, Number(counter.goalsFor))), goalsAgainst: Math.min(10, Math.max(0, Number(counter.goalsAgainst) || 0)) }
        : {}),
    }));
}

/** Their side of each of their latest match reports. A report MFL can't give is left out. */
async function theirReports(matches: ScoutMatch[]): Promise<SideReport[]> {
  const reports: SideReport[] = [];
  for (const match of matches.slice(0, REPORTED_MATCHES)) {
    if (match.home === undefined) continue;
    const report = await fetchMflCached<MatchReport>(`/matches/${match.id}/report`, 168 * 3600).catch(error => {
      if (error instanceof MflRateLimitError) throw error;
      return null;
    });
    if (!report?.home?.playersStats || !report.away?.playersStats) continue;
    const [ours, opponents] = match.home ? [report.home, report.away] : [report.away, report.home];
    reports.push({ matchId: match.id, ours: ours.playersStats, opponents: opponents.playersStats });
  }
  return reports;
}

/** Our next matches, for resting players before a cup match; none when MFL can't say */
async function upcomingFixtures(squadId: number | undefined): Promise<UpcomingFixture[]> {
  if (!squadId) return [];
  const listed = await fetchMflCached<any[]>(`/matches?squadId=${squadId}&upcoming=true&limit=8`, 300).catch(error => {
    if (error instanceof MflRateLimitError) throw error;
    return [];
  });
  return (Array.isArray(listed) ? listed : []).flatMap(match => {
    if (!isId(match?.id) || !Number.isFinite(match?.startDate)) return [];
    const home = match.homeSquad?.id === squadId;
    return [
      {
        matchId: match.id,
        startDate: match.startDate,
        competition: String(match.competition?.name ?? ''),
        type: String(match.competition?.type ?? match.type ?? ''),
        opponent: String((home ? match.awayTeamName : match.homeTeamName) ?? ''),
        home,
        ...(match.competition?.noFatigue ? { noFatigue: true } : {}),
      },
    ];
  });
}

interface AnalysisKey {
  ourClubId: number;
  theirClubId: number;
  ourFormation: string;
  theirFormation: string;
  aim: Outcome;
  matchId: number | null;
}

/**
 * What an analysis reads besides the squads (our tactics log, the notes for the match) and the fingerprint of all
 * of it, both squads and their latest matches included: an analysis with the same fingerprint would read the same.
 * Throws MflRateLimitError and MflHttpError.
 */
async function analysisInputs({ ourClubId, theirClubId, ourFormation, theirFormation, aim, matchId }: AnalysisKey) {
  const notesScope: NotesScope = { matchId, opponentId: theirClubId };
  const [entries, { notes }, ourData, theirData] = await Promise.all([
    loadTacticsEntries(ourClubId),
    loadClubNotes(ourClubId, notesScope),
    scoutDataVersion(ourClubId, OUR_MATCHES),
    scoutDataVersion(theirClubId, THEIR_MATCHES),
  ]);
  const logVersion = entries.length ? `${entries.length}-${entries.map(entry => entry.updatedAt).sort().at(-1)}` : '0';
  /** The fingerprint with our formation as given */
  const fingerprintFor = (formation: string) =>
    fingerprintOf([PROMPT_VERSION, ourClubId, theirClubId, formation, theirFormation, aim, matchId, logVersion, notesKey(notes), ourData, theirData]);
  return { notesScope, entries, notes, fingerprint: fingerprintFor(ourFormation), fingerprintFor };
}

async function askGemini(prompt: string): Promise<MatchAnalysis> {
  const key = process.env.GEMINI_PROXY_API_KEY;
  if (!key) throw new Error('GEMINI_PROXY_API_KEY is not set');
  const startedAt = Date.now();
  console.log(`[API] match-analysis: asking Gemini, prompt ${prompt.length} characters`);
  const response = await fetch(`${GEMINI_PROXY_URL}/v1/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: ANALYSIS_SCHEMA, temperature: 0.4 },
    }),
  });
  if (!response.ok) throw new Error(`Gemini proxy ${response.status}: ${(await response.text().catch(() => '')).slice(0, 300)}`);
  const result = await response.json();
  console.log(`[API] match-analysis: Gemini answered in ${Math.round((Date.now() - startedAt) / 1000)}s`);
  const text: string | undefined = result?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? '').join('');
  if (!text) throw new Error('Gemini gave no analysis');
  const analysis = JSON.parse(text) as MatchAnalysis;
  if (!analysis.summary || !Array.isArray(analysis.attack)) throw new Error('Gemini gave an analysis in the wrong shape');
  return {
    summary: analysis.summary,
    formation: isFormation(analysis.formation?.pick) ? analysis.formation : { pick: '', reason: analysis.formation?.reason ?? '' },
    captain: analysis.captain?.player
      ? {
          player: String(analysis.captain.player),
          reason: String(analysis.captain.reason ?? ''),
          ...(Number.isInteger(analysis.captain.playerId) ? { playerId: analysis.captain.playerId } : {}),
        }
      : undefined,
    attack: analysis.attack ?? [],
    defend: analysis.defend ?? [],
    matchups: analysis.matchups ?? [],
    lineup: analysis.lineup ?? [],
    styleSummary: typeof analysis.styleSummary === 'string' ? analysis.styleSummary : '',
    tactics: cleanTactics(analysis.tactics),
    historyNotes: Array.isArray(analysis.historyNotes) ? analysis.historyNotes.filter(note => note?.title && note?.detail) : [],
    rotation: Array.isArray(analysis.rotation) ? analysis.rotation.filter(note => note?.title && note?.detail) : [],
    // Checked against our squad once it's known
    players: Array.isArray(analysis.players) ? analysis.players : [],
    xi: Array.isArray(analysis.xi) ? analysis.xi : [],
  };
}

/**
 * Keeps the analysis as the advice for our club's fixture when the wallet asking owns the club and the club plays
 * in the match, so the tactics log can set what we used against what was advised. Whether it was kept.
 */
async function rememberAdvice(clubId: number, squadId: number | undefined, matchId: unknown, wallet: string, analysis: MatchAnalysis, aim: Outcome): Promise<boolean> {
  if (!process.env.TURSO_DATABASE_URL || !isId(matchId) || !squadId) return false;
  try {
    if (!(await clubPlaysIn(squadId, matchId))) return false;
    await saveAdvice(clubId, matchId, adviceFrom(analysis, aim), wallet);
    return true;
  } catch (error) {
    console.error(`[API] Could not keep the advice for club ${clubId}, match ${matchId}:`, error);
    return false;
  }
}

/**
 * GET /api/match-analysis
 * How many fresh analyses the signed-in wallet has left today (src/lib/aiAccess.ts): whitelisted wallets have no
 * daily cap. Null when not signed in.
 */
export async function GET(request: NextRequest) {
  const wallet = sessionWallet(request);
  if (!process.env.TURSO_DATABASE_URL || !wallet) return NextResponse.json({ success: true, data: null });
  if (request.nextUrl.searchParams.has('theirClubId')) return savedFor(request, wallet);
  try {
    return NextResponse.json({ success: true, data: await analysisAllowance(wallet, visitorKey(request)) });
  } catch (error) {
    console.error('[API] GET /api/match-analysis failed:', error);
    return NextResponse.json({ success: false, error: 'Could not read your analyses left' }, { status: 502 });
  }
}

/**
 * GET /api/match-analysis?ourClubId=&theirClubId=&matchId=
 * The latest analysis kept for the match, for our club's owner, and whether it's current: whether asking again with
 * its formations and aim would read the same (null when MFL couldn't say). Null when there is none.
 */
async function savedFor(request: NextRequest, wallet: string) {
  const params = request.nextUrl.searchParams;
  const ourClubId = Number(params.get('ourClubId'));
  const theirClubId = Number(params.get('theirClubId'));
  const matchId = Number(params.get('matchId'));
  if (!isId(ourClubId) || !isId(theirClubId)) return NextResponse.json({ success: false, error: 'Give both club IDs' }, { status: 400 });
  try {
    const { allowed } = await tacticsAccess(ourClubId, wallet);
    if (!allowed) return NextResponse.json({ success: false, error: NOT_YOURS }, { status: 403 });
    const saved = await latestSavedAnalysis(ourClubId, { matchId: isId(matchId) ? matchId : null, opponentId: theirClubId });
    if (!saved) return NextResponse.json({ success: true, data: null });
    const { request: asked } = saved;
    const current = await analysisInputs({
      ourClubId,
      theirClubId,
      ourFormation: asked.ourFormation,
      theirFormation: asked.theirFormation,
      aim: asked.aim ?? 'win',
      matchId: isId(matchId) ? matchId : null,
    })
      .then(inputs => inputs.fingerprint === saved.fingerprint)
      .catch(() => null);
    return NextResponse.json({ success: true, data: { request: asked, analysis: saved.analysis, savedAt: saved.savedAt, current } });
  } catch (error) {
    if (error instanceof MflRateLimitError) {
      return NextResponse.json({ success: false, error: `MFL is busy right now. Try again in ${describeWait(error.retryAfterSeconds)}.` }, { status: 429 });
    }
    console.error('[API] GET /api/match-analysis saved analysis failed:', error);
    return NextResponse.json({ success: false, error: 'Could not read the saved analysis' }, { status: 502 });
  }
}

/**
 * POST /api/match-analysis { ourClubId, theirClubId, ourFormation, theirFormation, counters?, aim?, matchId?, walletAddress? }
 * An AI scouting report on the opponent for the Match Prep Tool: both squads, their form and their latest match
 * stats go to Gemini, which finds edges to play on. Kept per match: asking again when nothing it reads has changed
 * (formations, aim, notes, tactics log, both squads and their latest matches) gives the kept one back for free; a
 * fresh one counts against the visitor's daily analyses unless their wallet is whitelisted.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Partial<MatchAnalysisRequest> | null;
  if (!body || !isId(body.ourClubId) || !isId(body.theirClubId) || !isFormation(body.ourFormation) || !isFormation(body.theirFormation)) {
    return NextResponse.json({ success: false, error: 'Give both club IDs and both formations' }, { status: 400 });
  }
  if (!process.env.GEMINI_PROXY_API_KEY) {
    return NextResponse.json({ success: false, error: "AI analysis isn't set up on this site yet" }, { status: 503 });
  }
  const { ourClubId, theirClubId, ourFormation, theirFormation } = body;
  const aim = isOutcome(body.aim) ? body.aim : 'win';
  // The analysis reads our tactics log, which is private, and costs credits: only for a verified wallet's own club
  const wallet = sessionWallet(request);
  if (!wallet) return NextResponse.json({ success: false, error: 'Verify your wallet to use AI analysis' }, { status: 401 });
  let ourSquadId: number | undefined;
  try {
    const { squadId, allowed } = await tacticsAccess(ourClubId, wallet);
    if (!allowed) {
      return NextResponse.json({ success: false, error: NOT_YOURS }, { status: 403 });
    }
    ourSquadId = squadId;
  } catch (error) {
    if (error instanceof MflRateLimitError) {
      return NextResponse.json({ success: false, error: `MFL is busy right now. Try again in ${describeWait(error.retryAfterSeconds)}.` }, { status: 429 });
    }
    return NextResponse.json({ success: false, error: 'No such MFL club' }, { status: 404 });
  }
  const matchId = isId(body.matchId) ? body.matchId : null;
  const busy = (seconds: number, what = 'MFL is busy right now') =>
    NextResponse.json({ success: false, error: `${what}. Try again in ${describeWait(seconds)}.` }, { status: 429, headers: { 'Retry-After': String(seconds) } });

  const visitor = visitorKey(request);
  try {
    if (process.env.TURSO_DATABASE_URL) {
      const blocked = await mflBlockedFor();
      if (blocked) return busy(blocked);
    }
    // A new match played, a logged match or new notes make a new analysis; otherwise the kept one comes back,
    // including the match's latest when we now play the formation it picked, as the page shows it as current then
    const pickedAnalysis = async () => {
      const latest = await latestSavedAnalysis(ourClubId, notesScope).catch(() => null);
      if (!latest || latest.analysis.formation?.pick !== ourFormation || latest.request.ourFormation === ourFormation) return null;
      return latest.fingerprint === fingerprintFor(latest.request.ourFormation) ? latest : null;
    };
    const { notesScope, entries, notes, fingerprint, fingerprintFor } = await analysisInputs({ ourClubId, theirClubId, ourFormation, theirFormation, aim, matchId });
    const cacheKey = `${ourClubId}:${fingerprint}`;
    const cached = cache.get(cacheKey);
    const kept =
      cached && Date.now() - cached.at < CACHE_MS
        ? { analysis: cached.analysis, savedAt: new Date(cached.at).toISOString() }
        : ((await findSavedAnalysis(ourClubId, notesScope, fingerprint).catch(() => null)) ?? (await pickedAnalysis()));
    if (kept) {
      const adviceSaved = await rememberAdvice(ourClubId, ourSquadId, body.matchId, wallet, kept.analysis, aim);
      return NextResponse.json({ success: true, data: kept.analysis, cached: true, savedAt: kept.savedAt, adviceSaved });
    }

    if (process.env.TURSO_DATABASE_URL) {
      const allowance = await analysisAllowance(wallet, visitor);
      if (allowance.remaining === 0) {
        return NextResponse.json(
          {
            success: false,
            error: `You've used today's ${allowance.limit} AI analyses. More in ${inHours(allowance.resetsIn)}. Asking again when nothing has changed is free. For more, ask @DogeSports69 on X for access.`,
            allowance,
          },
          { status: 429, headers: { 'Retry-After': String(allowance.resetsIn) } },
        );
      }
      const wait = await takeRateLimits([...analysisLimits(wallet, visitor), ...SCOUT_LIMITS]);
      if (wait) return busy(wait, 'That is a lot of analyses');
    }

    const [ours, theirs, fixtures] = await Promise.all([
      buildScoutReport(ourClubId, OUR_MATCHES),
      buildScoutReport(theirClubId, THEIR_MATCHES),
      upcomingFixtures(ourSquadId),
    ]);
    if (!theirs.players.length) return NextResponse.json({ success: false, error: `${theirs.club.name} has no squad to analyse` }, { status: 422 });

    const reports = await theirReports(theirs.matches);
    // Our log only costs MFL requests when there is one
    const history = entries.length ? await buildTacticsHistory(ourClubId, entries) : null;

    const prompt = buildAnalysisPrompt({
      ours,
      theirs,
      ourFormation,
      theirFormation,
      counters: readCounters(body.counters),
      aim,
      theirReports: reports,
      history,
      notes,
      fixtures,
      matchId,
    });
    const analysis = await askGemini(prompt);
    // The XI it would field, made whole from our squad, for the matchup pitch
    analysis.team = cleanTeam(analysis.xi, analysis.formation.pick || ourFormation, ours.players, analysis.captain?.playerId, aim);
    delete analysis.xi;
    // Only players in that XI, as the page shows their stats
    analysis.players = cleanPlayerInstructions(analysis.players, new Set(analysis.team.xi.filter((id): id is number => id !== null)));
    cache.set(cacheKey, { analysis, at: Date.now() });
    if (cache.size > 300) cache.delete(cache.keys().next().value!);
    await saveAnalysis(ourClubId, notesScope, fingerprint, { ourClubId, theirClubId, ourFormation, theirFormation, aim, ...(matchId ? { matchId } : {}) }, analysis).catch(error =>
      console.error(`[API] Could not keep the analysis for club ${ourClubId}:`, error),
    );
    const adviceSaved = await rememberAdvice(ourClubId, ourSquadId, body.matchId, wallet, analysis, aim);
    const allowance = process.env.TURSO_DATABASE_URL ? await analysisAllowance(wallet, visitor).catch(() => null) : null;
    return NextResponse.json({ success: true, data: analysis, adviceSaved, allowance });
  } catch (error) {
    if (error instanceof MflRateLimitError) return busy(error.retryAfterSeconds);
    const status = error instanceof MflHttpError ? error.status : 500;
    console.error('[API] /api/match-analysis failed:', error);
    return NextResponse.json(
      { success: false, error: status === 404 ? 'No such MFL club' : 'The AI analysis failed. Try again in a minute.' },
      { status: status === 404 ? 404 : 502 },
    );
  }
}
