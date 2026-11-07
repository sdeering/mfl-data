import { PLAYER_SETTINGS, TACTIC_SETTINGS, TACTIC_STEPS, type MatchAnalysis } from '../services/matchAnalysis';

/*
 * A club's tactics log: the playing style settings its manager used in each match, with the result and xG, and
 * what that history says about each setting. Pure, so the page and the AI analysis read the same numbers.
 */

/** Setting key to step, 1 to TACTIC_STEPS */
export type TacticSettings = Record<string, number>;

/**
 * Individual instructions by player ID: for each player only the settings set for them (PLAYER_SETTINGS keys),
 * the rest following the team's step
 */
export type PlayerSettings = Record<string, TacticSettings>;

/** What the AI analysis advised for a match, kept when the owner asked for it ahead of the match */
export interface StoredAdvice {
  /** The formation key it advised */
  formation: string;
  /** What we wanted from the match: win, smash or notLose */
  aim: string;
  captain: string | null;
  /** Its team settings, or null when it gave no full set */
  settings: TacticSettings | null;
  players: PlayerSettings;
  createdAt: string;
}

/** One of our played matches, with the settings logged for it when there are any */
export interface ClubMatchLog {
  matchId: number;
  startDate: number;
  /** LEAGUE, CUP or FRIENDLY */
  type: string;
  competition: string;
  opponent: { clubId: number; name: string };
  home: boolean;
  goalsFor: number;
  goalsAgainst: number;
  formation: string | null;
  opponentFormation: string | null;
  /** From the match report, for logged matches */
  xGFor: number | null;
  xGAgainst: number | null;
  settings: TacticSettings | null;
  /** Individual instructions logged with the settings */
  players?: PlayerSettings | null;
  /** What the AI advised for it, when the owner asked before it */
  advice?: StoredAdvice | null;
}

export interface TacticsHistory {
  /** Our latest played matches, newest first */
  matches: ClubMatchLog[];
  /** Settings logged ahead of matches not played yet, by match ID */
  planned: Record<number, TacticSettings>;
  /** Individual instructions logged ahead of them */
  plannedPlayers?: Record<number, PlayerSettings>;
}

/** Every setting given a whole step from 1 to TACTIC_STEPS, or null when any is missing or wrong */
export function validSettings(value: unknown): TacticSettings | null {
  if (!value || typeof value !== 'object') return null;
  const settings: TacticSettings = {};
  for (const { key } of TACTIC_SETTINGS) {
    const step = (value as Record<string, unknown>)[key];
    if (typeof step !== 'number' || !Number.isInteger(step) || step < 1 || step > TACTIC_STEPS) return null;
    settings[key] = step;
  }
  return settings;
}

/** Most players a match's individual instructions can hold: the XI */
export const MAX_LOGGED_PLAYERS = 11;

/**
 * Individual instructions with whole steps for known player settings, players with none left out; {} for none
 * given, null when anything is wrong
 */
export function validPlayerSettings(value: unknown): PlayerSettings | null {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > MAX_LOGGED_PLAYERS) return null;
  const players: PlayerSettings = {};
  for (const [id, settings] of entries) {
    if (!/^\d{1,12}$/.test(id) || !settings || typeof settings !== 'object' || Array.isArray(settings)) return null;
    const own: TacticSettings = {};
    for (const [key, step] of Object.entries(settings as Record<string, unknown>)) {
      if (!PLAYER_SETTINGS.some(setting => setting.key === key)) return null;
      if (typeof step !== 'number' || !Number.isInteger(step) || step < 1 || step > TACTIC_STEPS) return null;
      own[key] = step;
    }
    if (Object.keys(own).length) players[id] = own;
  }
  return players;
}

/** An analysis as advice to keep: its formation, captain, team settings and individual instructions */
export function adviceFrom(analysis: MatchAnalysis, aim: string): Omit<StoredAdvice, 'createdAt'> {
  const tactics = analysis.tactics ?? [];
  return {
    formation: analysis.formation.pick,
    aim,
    captain: analysis.captain?.player ?? null,
    settings: tactics.length === TACTIC_SETTINGS.length ? Object.fromEntries(tactics.map(pick => [pick.key, pick.step])) : null,
    players: Object.fromEntries(
      (analysis.players ?? []).filter(item => item.settings.length).map(item => [String(item.playerId), Object.fromEntries(item.settings.map(pick => [pick.key, pick.step]))]),
    ),
  };
}

/** How many of the team's settings were set as advised */
export function adviceAgreement(settings: TacticSettings, advised: TacticSettings): { same: number; total: number } {
  return { same: TACTIC_SETTINGS.filter(setting => settings[setting.key] === advised[setting.key]).length, total: TACTIC_SETTINGS.length };
}

/** Setting this share of the team's settings as advised counts as following the advice */
export const FOLLOWED_SHARE = 0.75;

/** Whether a logged match followed its advice, null when it has no settings or no advice to follow */
export function followedAdvice(match: ClubMatchLog): boolean | null {
  if (!match.settings || !match.advice?.settings) return null;
  const { same, total } = adviceAgreement(match.settings, match.advice.settings);
  return same / total >= FOLLOWED_SHARE;
}

/** Our record when we followed the advice and when we didn't, null with no logged match to judge */
export function adviceRecord(matches: ClubMatchLog[]): { followed: Record3; ignored: Record3 } | null {
  const judged = matches.filter(match => followedAdvice(match) !== null);
  if (!judged.length) return null;
  return { followed: recordOf(judged.filter(match => followedAdvice(match))), ignored: recordOf(judged.filter(match => !followedAdvice(match))) };
}

export interface PlayerSettingEffect {
  playerId: number;
  key: string;
  /** Our record with each step set for them */
  bySteps: { step: number; record: Record3 }[];
  /** Our record in the other logged matches, where they followed the team or didn't play */
  team: Record3;
}

/** How we did with each individual instruction we've tried, the most tried first */
export function playerSettingEffects(matches: ClubMatchLog[]): PlayerSettingEffect[] {
  const logged = matches.filter(match => match.settings);
  const tried = new Map<string, { playerId: number; key: string }>();
  for (const match of logged) {
    for (const [id, own] of Object.entries(match.players ?? {})) for (const key of Object.keys(own)) tried.set(`${id}|${key}`, { playerId: Number(id), key });
  }
  const stepOf = (match: ClubMatchLog, playerId: number, key: string) => match.players?.[playerId]?.[key];
  return [...tried.values()]
    .map(({ playerId, key }) => {
      const set = logged.filter(match => stepOf(match, playerId, key) !== undefined);
      const steps = [...new Set(set.map(match => stepOf(match, playerId, key)!))].sort((a, b) => a - b);
      return {
        playerId,
        key,
        bySteps: steps.map(step => ({ step, record: recordOf(set.filter(match => stepOf(match, playerId, key) === step)) })),
        team: recordOf(logged.filter(match => stepOf(match, playerId, key) === undefined)),
      };
    })
    .sort((a, b) => b.bySteps.reduce((total, item) => total + item.record.games, 0) - a.bySteps.reduce((total, item) => total + item.record.games, 0));
}

const POINTS = { W: 3, D: 1, L: 0 } as const;
const resultOf = (match: Pick<ClubMatchLog, 'goalsFor' | 'goalsAgainst'>) =>
  match.goalsFor > match.goalsAgainst ? 'W' : match.goalsFor < match.goalsAgainst ? 'L' : 'D';

export const loggedMatches = (history: TacticsHistory | null) => (history?.matches ?? []).filter(match => match.settings);

export interface Record3 {
  games: number;
  wins: number;
  draws: number;
  losses: number;
  /** Points a game */
  ppg: number | null;
  /** Average xG for less xG against, over the games with a report */
  xgDiff: number | null;
}

export function recordOf(matches: ClubMatchLog[]): Record3 {
  const count = (result: 'W' | 'D' | 'L') => matches.filter(match => resultOf(match) === result).length;
  const withXg = matches.filter(match => match.xGFor !== null && match.xGAgainst !== null);
  return {
    games: matches.length,
    wins: count('W'),
    draws: count('D'),
    losses: count('L'),
    ppg: matches.length ? matches.reduce((total, match) => total + POINTS[resultOf(match)], 0) / matches.length : null,
    xgDiff: withXg.length ? withXg.reduce((total, match) => total + match.xGFor! - match.xGAgainst!, 0) / withXg.length : null,
  };
}

/** A setting's steps in three ranges, as the history groups them */
export const BANDS = [
  { band: 'low', steps: [1, 2] },
  { band: 'mid', steps: [3] },
  { band: 'high', steps: [4, 5] },
] as const;
export type Band = (typeof BANDS)[number]['band'];
export const bandOf = (step: number): Band => (step <= 2 ? 'low' : step === 3 ? 'mid' : 'high');

export interface SettingEffect {
  key: string;
  bands: Record<Band, Record3>;
  /** The band with the most points a game, among those played at least MIN_BAND_GAMES times, when two or more were */
  best: Band | null;
}

/** Games in a band before it counts towards which band did best */
export const MIN_BAND_GAMES = 2;

/** How we did with each setting low, mid and high, over the logged matches given */
export function settingEffects(matches: ClubMatchLog[]): SettingEffect[] {
  const logged = matches.filter(match => match.settings);
  return TACTIC_SETTINGS.map(({ key }) => {
    const bands = Object.fromEntries(
      BANDS.map(({ band }) => [band, recordOf(logged.filter(match => bandOf(match.settings![key]) === band))]),
    ) as Record<Band, Record3>;
    // Points a game first, then xG; a tie at the top has no best
    const score = (band: Band) => [bands[band].ppg ?? 0, bands[band].xgDiff ?? 0];
    const ranked = BANDS.filter(({ band }) => bands[band].games >= MIN_BAND_GAMES)
      .map(({ band }) => band)
      .sort((a, b) => score(b)[0] - score(a)[0] || score(b)[1] - score(a)[1]);
    const tied = ranked.length >= 2 && score(ranked[0])[0] === score(ranked[1])[0] && score(ranked[0])[1] === score(ranked[1])[1];
    const best = ranked.length >= 2 && !tied ? ranked[0] : null;
    return { key, bands, best };
  });
}

/** Logged matches against this club, and against this formation, newest first */
export function similarMatches(matches: ClubMatchLog[], opponentClubId: number, opponentFormation: string) {
  const logged = matches.filter(match => match.settings);
  return {
    sameOpponent: logged.filter(match => match.opponent.clubId === opponentClubId),
    sameFormation: logged.filter(match => match.opponentFormation === opponentFormation),
  };
}
