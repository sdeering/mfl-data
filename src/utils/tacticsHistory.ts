import { TACTIC_SETTINGS, TACTIC_STEPS } from '../services/matchAnalysis';

/*
 * A club's tactics log: the playing style settings its manager used in each match, with the result and xG, and
 * what that history says about each setting. Pure, so the page and the AI analysis read the same numbers.
 */

/** Setting key to step, 1 to TACTIC_STEPS */
export type TacticSettings = Record<string, number>;

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
}

export interface TacticsHistory {
  /** Our latest played matches, newest first */
  matches: ClubMatchLog[];
  /** Settings logged ahead of matches not played yet, by match ID */
  planned: Record<number, TacticSettings>;
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
  { band: 'mid', steps: [3, 4] },
  { band: 'high', steps: [5, 6] },
] as const;
export type Band = (typeof BANDS)[number]['band'];
export const bandOf = (step: number): Band => (step <= 2 ? 'low' : step <= 4 ? 'mid' : 'high');

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
