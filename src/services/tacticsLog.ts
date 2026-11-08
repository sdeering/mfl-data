import { executeRaw } from '../lib/db-helpers';
import { MflHttpError, fetchMflCached, keptFormationResults, toFormationResult, type MatchDetails } from './formationResults';
import { MflRateLimitError } from './playerProgressionCache';
import type { MatchReport } from './matchAnalysis';
import {
  validPlayerSettings,
  validSettings,
  type ClubMatchLog,
  type PlayerSettings,
  type StoredAdvice,
  type TacticSettings,
  type TacticsHistory,
} from '../utils/tacticsHistory';
import { playerSettingsFrom, sameTactics, teamSettingsFrom, type ReportFormation } from '../utils/mflTactics';

/*
 * A club's tactics log on the server: the settings kept in club_tactics, joined with the club's played matches
 * from MFL, their formations and their xG.
 */

const HOUR = 3600;
/** A club's list of played matches is kept 5 minutes, so a match shows soon after it ends */
const RECENT_MATCHES_CACHE = 300;
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
  players: PlayerSettings;
  updatedAt: string;
}

const parse = (text: unknown): unknown => {
  try {
    return typeof text === 'string' ? JSON.parse(text) : null;
  } catch {
    return null;
  }
};

/** The settings logged for a club, by match. Empty without a database. */
export async function loadTacticsEntries(clubId: number): Promise<TacticsEntry[]> {
  if (!process.env.TURSO_DATABASE_URL) return [];
  const { data, error } = await executeRaw('SELECT match_id, settings, player_settings, updated_at FROM club_tactics WHERE club_id = ?', [clubId]);
  if (error || !data) return [];
  return data.flatMap(row => {
    const settings = validSettings(parse(row.settings));
    const players = validPlayerSettings(parse(row.player_settings)) ?? {};
    return settings ? [{ matchId: Number(row.match_id), settings, players, updatedAt: String(row.updated_at) }] : [];
  });
}

/** What the AI advised for a club's matches, by match. Empty without a database. */
export async function loadAdvice(clubId: number): Promise<Map<number, StoredAdvice>> {
  if (!process.env.TURSO_DATABASE_URL) return new Map();
  const { data, error } = await executeRaw('SELECT match_id, advice, created_at FROM club_match_advice WHERE club_id = ?', [clubId]);
  if (error || !data) return new Map();
  return new Map(
    data.flatMap(row => {
      const advice = parse(row.advice) as Omit<StoredAdvice, 'createdAt'> | null;
      if (!advice || typeof advice.formation !== 'string') return [];
      return [
        [
          Number(row.match_id),
          {
            formation: advice.formation,
            aim: String(advice.aim ?? 'win'),
            captain: advice.captain ?? null,
            settings: validSettings(advice.settings),
            players: validPlayerSettings(advice.players) ?? {},
            createdAt: String(row.created_at),
          },
        ] as const,
      ];
    }),
  );
}

/** Keeps the latest advice for a club's match */
export async function saveAdvice(clubId: number, matchId: number, advice: Omit<StoredAdvice, 'createdAt'>, walletAddress: string): Promise<void> {
  const { error } = await executeRaw(
    `INSERT INTO club_match_advice (club_id, match_id, advice, wallet_address, created_at) VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT (club_id, match_id) DO UPDATE SET advice = excluded.advice, wallet_address = excluded.wallet_address, created_at = excluded.created_at`,
    [clubId, matchId, JSON.stringify(advice), walletAddress],
  );
  if (error) throw new Error(error.message);
}

/** Keeps the settings and individual instructions used in a match, or with null forgets them. */
export async function saveTacticsEntry(
  clubId: number,
  matchId: number,
  settings: TacticSettings | null,
  players: PlayerSettings,
  walletAddress: string,
): Promise<void> {
  const { error } = settings
    ? await executeRaw(
        `INSERT INTO club_tactics (club_id, match_id, settings, player_settings, wallet_address, updated_at) VALUES (?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT (club_id, match_id) DO UPDATE SET settings = excluded.settings, player_settings = excluded.player_settings,
           wallet_address = excluded.wallet_address, updated_at = excluded.updated_at`,
        [clubId, matchId, JSON.stringify(settings), JSON.stringify(players), walletAddress],
      )
    : await executeRaw('DELETE FROM club_tactics WHERE club_id = ? AND match_id = ?', [clubId, matchId]);
  if (error) throw new Error(error.message);
}

export type ImportOutcome = { status: 'saved' | 'updated' | 'unchanged' } | { status: 'skipped'; reason: string };

/**
 * Logs the tactics MFL's match report shows the club's owner for one of the club's played matches: the team's
 * settings, and individual instructions by player ID from the match's positions. Unchanged when the log already has
 * the same, so an import can stop there. Skipped when the report's formation isn't the one the club played, since
 * then it isn't this match's.
 */
export async function importReportTactics(
  clubId: number,
  squadId: number,
  matchId: number,
  formation: ReportFormation,
  walletAddress: string,
): Promise<ImportOutcome> {
  const details = await fetchMflCached<MatchDetails>(`/matches/${matchId}?withFormations=true`, 168 * HOUR).catch(error => {
    if (error instanceof MflHttpError && error.status === 404) return null;
    throw error;
  });
  if (!details) return { status: 'skipped', reason: 'MFL has no such match' };
  const home = details.homeSquad?.id === squadId;
  if (!home && details.awaySquad?.id !== squadId) return { status: 'skipped', reason: "Not one of this club's matches" };
  if (details.status !== 'ENDED') return { status: 'skipped', reason: 'Not played yet' };
  const played = home ? details.homeFormation : details.awayFormation;
  if (formation.type && played?.type && formation.type !== played.type) {
    return { status: 'skipped', reason: `The report's formation (${formation.type}) isn't the one played (${played.type})` };
  }

  const playerIdAt = (index: number) => played?.positions?.find(position => position.index === index)?.player?.id;
  const settings = validSettings(teamSettingsFrom(formation));
  const players = validPlayerSettings(playerSettingsFrom(formation, playerIdAt));
  if (!settings || !players) return { status: 'skipped', reason: "Couldn't read the tactics" };

  const { data } = await executeRaw('SELECT settings, player_settings FROM club_tactics WHERE club_id = ? AND match_id = ?', [clubId, matchId]);
  const row = data?.[0];
  const logged = row && validSettings(parse(row.settings));
  if (logged && sameTactics({ settings, players }, { settings: logged, players: validPlayerSettings(parse(row.player_settings)) ?? {} })) {
    return { status: 'unchanged' };
  }
  await saveTacticsEntry(clubId, matchId, settings, players, walletAddress);
  return { status: logged ? 'updated' : 'saved' };
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
  const [logged, advice] = await Promise.all([entries ?? loadTacticsEntries(clubId), loadAdvice(clubId)]);
  const { squadId } = await clubOwnership(clubId);
  if (!squadId) return { matches: [], planned: {} };

  const [competitive, all] = await Promise.all([
    fetchMflCached<ListedClubMatch[]>(`/matches?squadId=${squadId}&past=true&onlyCompetitions=true&limit=${LISTED}`, RECENT_MATCHES_CACHE),
    fetchMflCached<ListedClubMatch[]>(`/matches?squadId=${squadId}&past=true&limit=${LISTED}`, RECENT_MATCHES_CACHE),
  ]);
  const byId = new Map<number, ListedClubMatch>();
  for (const match of [...competitive, ...all]) if (match.status === 'ENDED' || match.status === undefined) byId.set(match.id, match);
  const played = [...byId.values()].sort((a, b) => b.startDate - a.startDate);
  const settingsById = new Map(logged.map(entry => [entry.matchId, entry.settings]));
  const playersById = new Map(logged.map(entry => [entry.matchId, entry.players]));
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
      players: settings ? playersById.get(match.id) ?? {} : null,
      advice: advice.get(match.id) ?? null,
    });
  }
  const playedIds = new Set(played.map(match => match.id));
  const ahead = logged.filter(entry => !playedIds.has(entry.matchId));
  return {
    matches,
    planned: Object.fromEntries(ahead.map(entry => [entry.matchId, entry.settings])),
    plannedPlayers: Object.fromEntries(ahead.map(entry => [entry.matchId, entry.players])),
  };
}
