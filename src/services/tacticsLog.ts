import { executeRaw } from '../lib/db-helpers';
import { MflHttpError, fetchMflCached, keptFormationResults, toFormationResult, type MatchDetails } from './formationResults';
import { MflRateLimitError } from './playerProgressionCache';
import type { MatchReport } from './matchAnalysis';
import { validSettings, type ClubMatchLog, type TacticSettings, type TacticsHistory } from '../utils/tacticsHistory';

/*
 * A club's tactics log on the server: the settings kept in club_tactics, joined with the club's played matches
 * from MFL, their formations and their xG.
 */

const HOUR = 3600;
/** Matches of each kind the history looks back over */
const LISTED = 40;

interface ListedClubMatch {
  id: number;
  startDate: number;
  status: string;
  type: string;
  homeSquad: { id: number; club: { id: number; name: string } };
  awaySquad: { id: number; club: { id: number; name: string } };
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  competition?: { name?: string };
}

export interface TacticsEntry {
  matchId: number;
  settings: TacticSettings;
  updatedAt: string;
}

/** The settings logged for a club, by match. Empty without a database. */
export async function loadTacticsEntries(clubId: number): Promise<TacticsEntry[]> {
  if (!process.env.TURSO_DATABASE_URL) return [];
  const { data, error } = await executeRaw('SELECT match_id, settings, updated_at FROM club_tactics WHERE club_id = ?', [clubId]);
  if (error || !data) return [];
  return data.flatMap(row => {
    let settings: TacticSettings | null = null;
    try {
      settings = validSettings(JSON.parse(row.settings));
    } catch {
      settings = null;
    }
    return settings ? [{ matchId: Number(row.match_id), settings, updatedAt: String(row.updated_at) }] : [];
  });
}

/** Keeps the settings used in a match, or with null forgets them. */
export async function saveTacticsEntry(clubId: number, matchId: number, settings: TacticSettings | null, walletAddress: string): Promise<void> {
  const { error } = settings
    ? await executeRaw(
        `INSERT INTO club_tactics (club_id, match_id, settings, wallet_address, updated_at) VALUES (?, ?, ?, ?, datetime('now'))
         ON CONFLICT (club_id, match_id) DO UPDATE SET settings = excluded.settings, wallet_address = excluded.wallet_address, updated_at = excluded.updated_at`,
        [clubId, matchId, JSON.stringify(settings), walletAddress],
      )
    : await executeRaw('DELETE FROM club_tactics WHERE club_id = ? AND match_id = ?', [clubId, matchId]);
  if (error) throw new Error(error.message);
}

/** The club's squad ID and owner's wallet, from MFL */
export async function clubOwnership(clubId: number): Promise<{ squadId: number | undefined; owner: string | undefined }> {
  const club = await fetchMflCached<{ squads?: { id: number }[]; ownedBy?: { walletAddress?: string } }>(`/clubs/${clubId}`, 24 * HOUR);
  return { squadId: club.squads?.[0]?.id, owner: club.ownedBy?.walletAddress };
}

/** Whether a match is one the club plays in, asked of MFL fresh so a fixture just made counts */
export async function clubPlaysIn(squadId: number, matchId: number): Promise<boolean> {
  // MFL answers 404 for a match asked for without its formations
  const match = await fetchMflCached<{ homeSquad?: { id: number }; awaySquad?: { id: number } }>(`/matches/${matchId}?withFormations=true`, 0).catch(error => {
    if (error instanceof MflHttpError && error.status === 404) return null;
    throw error;
  });
  return match?.homeSquad?.id === squadId || match?.awaySquad?.id === squadId;
}

/** Their side of a match report's team totals: shots don't matter here, xG does */
const xgOf = (report: MatchReport | null, home: boolean) => {
  if (!report?.home?.playersStats || !report.away?.playersStats) return { xGFor: null, xGAgainst: null };
  const total = (side: MatchReport['home']) => Math.round(side.playersStats.reduce((sum, line) => sum + (Number(line.xG) || 0), 0) * 100) / 100;
  return home ? { xGFor: total(report.home), xGAgainst: total(report.away) } : { xGFor: total(report.away), xGAgainst: total(report.home) };
};

/**
 * The club's latest played matches, competitive and friendly, with the settings logged for each, and for those the
 * formations and xG; plus settings logged for matches not played yet. Only logged matches cost MFL requests beyond
 * the two listings, and those are kept for a week.
 */
export async function buildTacticsHistory(clubId: number, entries?: TacticsEntry[]): Promise<TacticsHistory> {
  const logged = entries ?? (await loadTacticsEntries(clubId));
  const { squadId } = await clubOwnership(clubId);
  if (!squadId) return { matches: [], planned: {} };

  const [competitive, all] = await Promise.all([
    fetchMflCached<ListedClubMatch[]>(`/matches?squadId=${squadId}&past=true&onlyCompetitions=true&limit=${LISTED}`, HOUR),
    fetchMflCached<ListedClubMatch[]>(`/matches?squadId=${squadId}&past=true&limit=${LISTED}`, HOUR),
  ]);
  const byId = new Map<number, ListedClubMatch>();
  for (const match of [...competitive, ...all]) if (match.status === 'ENDED' || match.status === undefined) byId.set(match.id, match);
  const played = [...byId.values()].sort((a, b) => b.startDate - a.startDate);
  const settingsById = new Map(logged.map(entry => [entry.matchId, entry.settings]));
  const kept = await keptFormationResults(played.filter(match => settingsById.has(match.id)).map(match => match.id));

  const matches: ClubMatchLog[] = [];
  for (const match of played) {
    const home = match.homeSquad.id === squadId;
    const settings = settingsById.get(match.id) ?? null;
    let formations = { formation: null as string | null, opponentFormation: null as string | null };
    let xg = { xGFor: null as number | null, xGAgainst: null as number | null };
    if (settings) {
      // One at a time: MFL blocks bursts
      let result = kept.get(match.id) ?? null;
      if (!result) {
        const details = await fetchMflCached<MatchDetails>(`/matches/${match.id}?withFormations=true`, 168 * HOUR).catch(error => {
          if (error instanceof MflRateLimitError) throw error;
          return null;
        });
        result = details && toFormationResult(match.id, details);
      }
      if (result) formations = home ? { formation: result.homeFormation, opponentFormation: result.awayFormation } : { formation: result.awayFormation, opponentFormation: result.homeFormation };
      const report = await fetchMflCached<MatchReport>(`/matches/${match.id}/report`, 168 * HOUR).catch(error => {
        if (error instanceof MflRateLimitError) throw error;
        return null;
      });
      xg = xgOf(report, home);
    }
    const opponent = home ? match.awaySquad.club : match.homeSquad.club;
    matches.push({
      matchId: match.id,
      startDate: match.startDate,
      type: match.type,
      competition: match.competition?.name ?? '',
      opponent: { clubId: opponent.id, name: home ? match.awayTeamName : match.homeTeamName },
      home,
      goalsFor: (home ? match.homeScore : match.awayScore) ?? 0,
      goalsAgainst: (home ? match.awayScore : match.homeScore) ?? 0,
      ...formations,
      ...xg,
      settings,
    });
  }
  const playedIds = new Set(played.map(match => match.id));
  const planned = Object.fromEntries(logged.filter(entry => !playedIds.has(entry.matchId)).map(entry => [entry.matchId, entry.settings]));
  return { matches, planned };
}
