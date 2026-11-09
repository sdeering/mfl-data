import { NextRequest, NextResponse } from 'next/server';
import { MflHttpError, fetchMflCached, mflBlockedFor } from '@/src/services/formationResults';
import type { ScoutMatch } from '@/src/services/scoutService';
import { MflRateLimitError } from '@/src/services/playerProgressionCache';
import { SCOUT_LIMITS, buildScoutReport } from '@/src/services/scoutReportBuilder';
import { buildTacticsHistory, clubOwnership, clubPlaysIn, loadTacticsEntries, saveAdvice } from '@/src/services/tacticsLog';
import { adviceFrom } from '@/src/utils/tacticsHistory';
import type { Outcome } from '@/src/utils/formationPlanner';
import {
  ANALYSIS_SCHEMA,
  buildAnalysisPrompt,
  cleanPlayerInstructions,
  cleanTactics,
  type MatchAnalysis,
  type MatchAnalysisRequest,
  type MatchReport,
  type RankedCounter,
  type SideReport,
} from '@/src/services/matchAnalysis';
import { describeWait, takeRateLimits, visitorKey } from '@/src/lib/rateLimit';
import { analysisAllowance, analysisLimits } from '@/src/lib/aiAccess';
import { sessionWallet } from '@/src/lib/session';
import { FORMATIONS } from '@/src/utils/squadLineups';
import { isOutcome, squadFits } from '@/src/utils/formationPlanner';

export const maxDuration = 90;

const GEMINI_PROXY_URL = process.env.GEMINI_PROXY_URL || 'https://gcloud-proxy-179582583097.us-central1.run.app';
const MODEL = 'gemini-3.8-flash';
const TIMEOUT_MS = 80 * 1000;
/** Must match what the Matches page scouts, so the reports come from the same cache */
const OUR_MATCHES = 15;
const THEIR_MATCHES = 10;
/** Their latest matches whose per-player stats it reads */
const REPORTED_MATCHES = 5;
const CACHE_MS = 6 * 3600 * 1000;


/** A wait as hours once it's over an hour and a half, e.g. "8 hours" */
const inHours = (seconds: number) => (seconds > 5400 ? `${Math.round(seconds / 3600)} hours` : describeWait(seconds));

const cache = new Map<string, { analysis: MatchAnalysis; at: number }>();

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

async function askGemini(prompt: string): Promise<MatchAnalysis> {
  const key = process.env.GEMINI_PROXY_API_KEY;
  if (!key) throw new Error('GEMINI_PROXY_API_KEY is not set');
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
  const text: string | undefined = result?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? '').join('');
  if (!text) throw new Error('Gemini gave no analysis');
  const analysis = JSON.parse(text) as MatchAnalysis;
  if (!analysis.summary || !Array.isArray(analysis.attack)) throw new Error('Gemini gave an analysis in the wrong shape');
  return {
    summary: analysis.summary,
    formation: isFormation(analysis.formation?.pick) ? analysis.formation : { pick: '', reason: analysis.formation?.reason ?? '' },
    captain: analysis.captain?.player ? { player: String(analysis.captain.player), reason: String(analysis.captain.reason ?? '') } : undefined,
    attack: analysis.attack ?? [],
    defend: analysis.defend ?? [],
    matchups: analysis.matchups ?? [],
    lineup: analysis.lineup ?? [],
    styleSummary: typeof analysis.styleSummary === 'string' ? analysis.styleSummary : '',
    tactics: cleanTactics(analysis.tactics),
    historyNotes: Array.isArray(analysis.historyNotes) ? analysis.historyNotes.filter(note => note?.title && note?.detail) : [],
    // Checked against our XI once it's known
    players: Array.isArray(analysis.players) ? analysis.players : [],
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
  try {
    return NextResponse.json({ success: true, data: await analysisAllowance(wallet, visitorKey(request)) });
  } catch (error) {
    console.error('[API] GET /api/match-analysis failed:', error);
    return NextResponse.json({ success: false, error: 'Could not read your analyses left' }, { status: 502 });
  }
}

/**
 * POST /api/match-analysis { ourClubId, theirClubId, ourFormation, theirFormation, counters?, aim?, matchId?, walletAddress? }
 * An AI scouting report on the opponent for the Match Prep Tool: both squads, their form and their latest match
 * stats go to Gemini, which finds edges to play on. Kept for 6 hours per matchup, and asking again in that time is
 * free; a fresh one counts against the visitor's daily analyses unless their wallet is whitelisted.
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
    const { squadId, owner } = await clubOwnership(ourClubId);
    if (!owner || owner.toLowerCase() !== wallet) {
      return NextResponse.json({ success: false, error: 'AI analysis is for your own clubs' }, { status: 403 });
    }
    ourSquadId = squadId;
  } catch (error) {
    if (error instanceof MflRateLimitError) {
      return NextResponse.json({ success: false, error: `MFL is busy right now. Try again in ${describeWait(error.retryAfterSeconds)}.` }, { status: 429 });
    }
    return NextResponse.json({ success: false, error: 'No such MFL club' }, { status: 404 });
  }
  // Logging a match makes a new analysis, so it reads the log as it is
  const entries = await loadTacticsEntries(ourClubId);
  const logVersion = entries.length ? `${entries.length}-${entries.map(entry => entry.updatedAt).sort().at(-1)}` : '0';
  const cacheKey = `v10:${ourClubId}:${theirClubId}:${ourFormation}:${theirFormation}:${aim}:${logVersion}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_MS) {
    const adviceSaved = await rememberAdvice(ourClubId, ourSquadId, body.matchId, wallet, cached.analysis, aim);
    return NextResponse.json({ success: true, data: cached.analysis, cached: true, adviceSaved });
  }

  const busy = (seconds: number, what = 'MFL is busy right now') =>
    NextResponse.json({ success: false, error: `${what}. Try again in ${describeWait(seconds)}.` }, { status: 429, headers: { 'Retry-After': String(seconds) } });

  const visitor = visitorKey(request);
  try {
    if (process.env.TURSO_DATABASE_URL) {
      const blocked = await mflBlockedFor();
      if (blocked) return busy(blocked);
      const allowance = await analysisAllowance(wallet, visitor);
      if (allowance.remaining === 0) {
        return NextResponse.json(
          {
            success: false,
            error: `You've used today's ${allowance.limit} AI analyses. More in ${inHours(allowance.resetsIn)}. A matchup analysed in the last 6 hours opens again for free. For more, ask @DogeSports69 on X for access.`,
            allowance,
          },
          { status: 429, headers: { 'Retry-After': String(allowance.resetsIn) } },
        );
      }
      const wait = await takeRateLimits([...analysisLimits(wallet, visitor), ...SCOUT_LIMITS]);
      if (wait) return busy(wait, 'That is a lot of analyses');
    }

    const [ours, theirs] = await Promise.all([buildScoutReport(ourClubId, OUR_MATCHES), buildScoutReport(theirClubId, THEIR_MATCHES)]);
    if (!theirs.players.length) return NextResponse.json({ success: false, error: `${theirs.club.name} has no squad to analyse` }, { status: 422 });

    const reports = await theirReports(theirs.matches);
    // Our log only costs MFL requests when there is one
    const history = entries.length ? await buildTacticsHistory(ourClubId, entries) : null;

    const prompt = buildAnalysisPrompt({ ours, theirs, ourFormation, theirFormation, counters: readCounters(body.counters), aim, theirReports: reports, history });
    const analysis = await askGemini(prompt);
    // Only players in the XI we're planning, as the page shows their stats
    const ourXi = squadFits(ours.players).get(ourFormation);
    analysis.players = cleanPlayerInstructions(analysis.players, new Set(ourXi?.slots.flatMap(slot => (slot.playerId === null ? [] : [slot.playerId])) ?? []));
    cache.set(cacheKey, { analysis, at: Date.now() });
    if (cache.size > 300) cache.delete(cache.keys().next().value!);
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
