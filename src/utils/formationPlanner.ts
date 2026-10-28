import type { MFLPlayer } from '../types/mflApi';
import { FORMATIONS, FORMATION_NAMES, XI_SIZE, autoFillLineup, positionFit, type FitKind } from './squadLineups';
import metaSnapshot from '../data/formationMeta.json';

/*
 * Which formation to play. The formation meta (how every MFL formation has done against every other) is weighed
 * with how well a squad lines up in each formation and with recent results, both the club's own and its
 * opponent's. Everything here is pure, so the page only lays it out.
 */

/** Results of one formation against another, from its own side. */
export interface Tally {
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
}

export interface FormationMeta {
  source: string;
  engine: string;
  /** Only matches between teams at most this far apart in OVR count */
  maxOvrDifference: number;
  fetchedAt: string;
  /** Keyed `${formation}|${opponentFormation}` */
  cells: Map<string, Tally>;
  /** Each formation against all the others, added up */
  overall: Map<string, Tally>;
  /** Points a game across every match, about 1.4 as a draw gives both sides a point */
  averagePpg: number;
  /** Chances of a win, draw and loss across every match */
  averageOdds: Odds;
  /** Games across all the formations, every match counted from both sides */
  totalGames: number;
  /** Matches behind it */
  matches: number;
}

/** Formation results as rows of [formation, opponentFormation, wins, draws, losses, goalsFor, goalsAgainst]. */
export interface MetaSnapshot {
  source: string;
  engine: string;
  maxOvrDifference: number;
  fetchedAt: string;
  rows: (string | number)[][];
}

export const BUNDLED_META = metaSnapshot as MetaSnapshot;

/** Chances of a win, a draw and a loss, adding up to 1 */
export interface Odds {
  win: number;
  draw: number;
  loss: number;
}

const games = (tally: Tally) => tally.wins + tally.draws + tally.losses;
const oddsOf = (tally: Tally): Odds => ({ win: tally.wins / games(tally), draw: tally.draws / games(tally), loss: tally.losses / games(tally) });
/** Expected points a game for these chances */
export const oddsPoints = (odds: Odds) => 3 * odds.win + odds.draw;
const points = (tally: Tally) => 3 * tally.wins + tally.draws;
const emptyTally = (): Tally => ({ wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 });
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

export function buildFormationMeta(snapshot: MetaSnapshot = BUNDLED_META): FormationMeta {
  const cells = new Map<string, Tally>();
  const overall = new Map<string, Tally>();
  for (const [formation, opponentFormation, wins, draws, losses, goalsFor, goalsAgainst] of snapshot.rows) {
    const cell = { wins, draws, losses, goalsFor, goalsAgainst } as Tally;
    cells.set(`${formation}|${opponentFormation}`, cell);
    const total = overall.get(formation as string) ?? emptyTally();
    total.wins += cell.wins;
    total.draws += cell.draws;
    total.losses += cell.losses;
    total.goalsFor += cell.goalsFor;
    total.goalsAgainst += cell.goalsAgainst;
    overall.set(formation as string, total);
  }
  const all = [...overall.values()];
  const totalGames = sum(all.map(games));
  const everything = all.reduce(
    (total, tally) => ({ ...total, wins: total.wins + tally.wins, draws: total.draws + tally.draws, losses: total.losses + tally.losses }),
    emptyTally(),
  );
  return {
    source: snapshot.source,
    engine: snapshot.engine,
    maxOvrDifference: snapshot.maxOvrDifference,
    fetchedAt: snapshot.fetchedAt,
    cells,
    overall,
    averagePpg: totalGames ? sum(all.map(points)) / totalGames : 1.4,
    averageOdds: totalGames ? oddsOf(everything) : { win: 0.37, draw: 0.26, loss: 0.37 },
    totalGames,
    matches: Math.round(totalGames / 2),
  };
}

/** Games our own meta needs before the planner uses it in place of the mfl-coach snapshot */
export const MIN_OWN_GAMES = 2000;

/**
 * The meta the planner goes by: our own, kept up to date from MFL, once it holds enough games; until then the
 * bundled mfl-coach snapshot.
 */
export function chooseFormationMeta(own: (MetaSnapshot & { totalGames: number }) | null | undefined): FormationMeta {
  return own && own.totalGames >= MIN_OWN_GAMES ? buildFormationMeta(own) : buildFormationMeta(BUNDLED_META);
}

const overallOdds = (meta: FormationMeta, formation: string): Odds => {
  const tally = meta.overall.get(formation);
  return tally && games(tally) ? oddsOf(tally) : meta.averageOdds;
};

/** How much of all play a formation is, from 0 to 1. */
export const metaShare = (meta: FormationMeta, formation: string) =>
  meta.totalGames ? games(meta.overall.get(formation) ?? emptyTally()) / meta.totalGames : 1 / FORMATION_NAMES.length;

/** Games a pairing counts for before its own results outweigh how the two formations do against everyone */
const META_PRIOR_GAMES = 30;

/**
 * Chances of `formation` beating, drawing with and losing to `opponentFormation`. A pairing seen only a few times
 * is pulled toward what the two formations do against everyone, so a lucky handful of games can't top the table.
 */
export function metaOdds(meta: FormationMeta, formation: string, opponentFormation: string): Odds {
  const cell = meta.cells.get(`${formation}|${opponentFormation}`) ?? emptyTally();
  const ours = overallOdds(meta, formation);
  const theirs = overallOdds(meta, opponentFormation);
  // What the two do against everyone: our wins are as likely as their losses
  const baseline = { win: (ours.win + theirs.loss) / 2, draw: (ours.draw + theirs.draw) / 2, loss: (ours.loss + theirs.win) / 2 };
  const weigh = (count: number, base: number) => (count + META_PRIOR_GAMES * base) / (games(cell) + META_PRIOR_GAMES);
  return { win: weigh(cell.wins, baseline.win), draw: weigh(cell.draws, baseline.draw), loss: weigh(cell.losses, baseline.loss) };
}

/** Points a game `formation` can expect against `opponentFormation`, from the meta. */
export const metaPpg = (meta: FormationMeta, formation: string, opponentFormation: string) =>
  oddsPoints(metaOdds(meta, formation, opponentFormation));

/** Games behind a pairing in the meta. */
export const metaGames = (meta: FormationMeta, formation: string, opponentFormation: string) =>
  games(meta.cells.get(`${formation}|${opponentFormation}`) ?? emptyTally());

/** One of a formation's positions in a squad's best XI: who plays it, their rating there and how familiar it is to them */
export interface FilledSlot {
  playerId: number | null;
  rating: number;
  kind: FitKind;
}

export interface FormationFit {
  formation: string;
  /** Average rating of the best XI the squad makes in it */
  rating: number;
  /** How far that is below the squad's best formation, 0 for the best */
  gap: number;
  /** That XI, position by position in the formation's order */
  slots: FilledSlot[];
  /** Positions it fills with someone at an alternative position */
  alternative: string[];
  /** Positions the XI has to fill with someone who doesn't play there */
  outOfPosition: string[];
}

/** How well a squad lines up in every formation: its best XI in each, never a retired player. Empty for no players. */
export function squadFits(players: MFLPlayer[]): Map<string, FormationFit> {
  if (players.length === 0) return new Map();
  const byId = new Map(players.map(player => [player.id, player]));
  const fits = FORMATION_NAMES.map(formation => {
    const { xi } = autoFillLineup(formation, players);
    const slots: FilledSlot[] = FORMATIONS[formation].map(([position], index) => {
      const id = xi[index];
      const player = id === null ? undefined : byId.get(id);
      return player ? { playerId: player.id, ...positionFit(player, position) } : { playerId: null, rating: 0, kind: 'out' as const };
    });
    const positions = (kind: FitKind) => FORMATIONS[formation].filter((_, index) => slots[index].kind === kind).map(([position]) => position);
    return {
      formation,
      rating: sum(slots.map(slot => slot.rating)) / XI_SIZE,
      slots,
      alternative: positions('alt'),
      outOfPosition: positions('out'),
    };
  });
  const best = Math.max(...fits.map(fit => fit.rating));
  return new Map(fits.map(fit => [fit.formation, { ...fit, gap: best - fit.rating }]));
}

/** One of a club's past matches from its own side, with the formation each team played. */
export interface PlayedMatch {
  formation: string | null;
  opponentFormation: string | null;
  goalsFor: number;
  goalsAgainst: number;
}

export const matchResult = (match: Pick<PlayedMatch, 'goalsFor' | 'goalsAgainst'>): 'W' | 'D' | 'L' =>
  match.goalsFor > match.goalsAgainst ? 'W' : match.goalsFor < match.goalsAgainst ? 'L' : 'D';

const RESULT_POINTS = { W: 3, D: 1, L: 0 };
const isFormation = (formation: string | null): formation is string => !!formation && formation in FORMATIONS;

export interface FormationGuess {
  formation: string;
  probability: number;
  /** In how many of the recent matches it was played */
  timesPlayed: number;
  fit?: FormationFit;
}

/** Each match further back counts this much less than the one after it */
const RECENCY_DECAY = 0.8;
/** OVR below the squad's best formation that makes a formation e times less likely */
const FIT_TEMPERATURE = 1.5;
/** OVR a formation the club has been playing can fall short by before that counts against it */
const FIT_ALLOWANCE = 1;
/** How many recent matches the squad and the meta's popularity count for, beside what was played */
const PRIOR_MATCHES = 0.75;

/**
 * The formations a club will likely play next, most likely first. Mostly what it played lately, the latest
 * counting most, unless its squad can no longer line up in it (a three-up front with no wingers left, say).
 * With little history it falls back on popular formations the squad suits.
 */
export function predictFormations(matches: PlayedMatch[], fits: Map<string, FormationFit>, meta: FormationMeta): FormationGuess[] {
  const gap = (formation: string) => fits.get(formation)?.gap ?? 0;
  const usage = new Map<string, number>();
  const timesPlayed = new Map<string, number>();
  let weight = 1;
  for (const match of matches) {
    if (isFormation(match.formation)) {
      usage.set(match.formation, (usage.get(match.formation) ?? 0) + weight);
      timesPlayed.set(match.formation, (timesPlayed.get(match.formation) ?? 0) + 1);
    }
    weight *= RECENCY_DECAY;
  }

  const prior = FORMATION_NAMES.map(formation => Math.sqrt(metaShare(meta, formation)) * Math.exp(-gap(formation) / FIT_TEMPERATURE));
  const priorTotal = sum(prior);
  const scores = FORMATION_NAMES.map(
    (formation, index) =>
      (usage.get(formation) ?? 0) * Math.exp(-Math.max(0, gap(formation) - FIT_ALLOWANCE) / FIT_TEMPERATURE) +
      (PRIOR_MATCHES * prior[index]) / priorTotal,
  );
  const total = sum(scores);
  return FORMATION_NAMES.map((formation, index) => ({
    formation,
    probability: scores[index] / total,
    timesPlayed: timesPlayed.get(formation) ?? 0,
    fit: fits.get(formation),
  })).sort((a, b) => b.probability - a.probability);
}

/** The formations a season's opponents will likely play: those faced lately, blended with the whole game's. */
export function seasonField(ourMatches: PlayedMatch[], meta: FormationMeta): FormationGuess[] {
  const faced = ourMatches.map(match => match.opponentFormation).filter(isFormation);
  // With 10 faced, they count as much as the whole game does
  const facedWeight = faced.length / (faced.length + 10);
  return FORMATION_NAMES.map(formation => {
    const timesPlayed = faced.filter(played => played === formation).length;
    const probability = (1 - facedWeight) * metaShare(meta, formation) + (faced.length ? (facedWeight * timesPlayed) / faced.length : 0);
    return { formation, probability, timesPlayed };
  }).sort((a, b) => b.probability - a.probability);
}

export interface FormationPick extends Odds {
  formation: string;
  /** Expected points a game against the likely opposition, from the meta */
  meta: number;
  /**
   * Points a game from how strong our XI is in it: against the opponent's likely XI when we know their squad,
   * otherwise against our own best formation
   */
  strength: number;
  /** Average rating of our best XI in it */
  xiRating: number;
  /** How much better our recent results with it were than with our other formations, against the meta, in points a game */
  ourForm: number;
  ourGames: number;
  /** How much better teams playing it did against this opponent lately than its other opponents did */
  theirRecord: number;
  theirGames: number;
  /** All of the above added up: expected points a game */
  score: number;
  alternative: string[];
  outOfPosition: string[];
}

/** Points a game one OVR across the XI is worth, roughly */
const PPG_PER_OVR = 0.1;
/** Matches of our own the meta counts for, against our form with a formation */
const OUR_PRIOR_GAMES = 6;
/** Matches the meta counts for, against how an opponent has done against a formation */
const THEIR_PRIOR_GAMES = 4;

/**
 * How far results with `formation` beat the meta by more than all the results did, in points a game. A strong
 * team beats the meta whatever it plays, so only how much better it did with this formation than with the others
 * counts; one formation played every time says nothing either way. Shrunk toward 0 while there are few games,
 * so one big win doesn't decide it.
 */
function beatTheMeta(
  results: { formation: string; opponentFormation: string; points: number }[],
  formation: string,
  priorGames: number,
  meta: FormationMeta,
): { value: number; games: number } {
  const surplus = (result: (typeof results)[number]) => result.points - metaPpg(meta, result.formation, result.opponentFormation);
  const usual = results.length ? sum(results.map(surplus)) / results.length : 0;
  const withIt = results.filter(result => result.formation === formation);
  return { value: sum(withIt.map(result => surplus(result) - usual)) / (withIt.length + priorGames), games: withIt.length };
}

/** Moves chance between a win and a loss to add `points` expected points a game, leaving each at least 1%. */
function shiftOdds(odds: Odds, points: number): Odds {
  const move = points / 3;
  if (move >= 0) {
    const moved = Math.min(move, Math.max(0, odds.loss - 0.01));
    return { win: odds.win + moved, draw: odds.draw, loss: odds.loss - moved };
  }
  const moved = Math.min(-move, Math.max(0, odds.win - 0.01));
  return { win: odds.win - moved, draw: odds.draw, loss: odds.loss + moved };
}

/**
 * Average rating of the XI an opponent will likely field: their best XI in each formation they may play,
 * weighed by how likely it is. Null without their squad.
 */
export function likelyRating(guesses: FormationGuess[]): number | null {
  const known = guesses.filter(guess => guess.fit);
  const weight = sum(known.map(guess => guess.probability));
  return weight ? sum(known.map(guess => guess.probability * guess.fit!.rating)) / weight : null;
}

/**
 * Our formations ranked by expected points a game against `opposition` (the formations it will likely play):
 * the chances of a win, draw and loss from the meta, adjusted for how strong our XI is in each (against the
 * opponent's likely XI, `theirRating`, when known) and for recent results: ours with each formation, and the
 * opponent's against it.
 */
export function rankFormations(
  opposition: FormationGuess[],
  ourFits: Map<string, FormationFit>,
  ourMatches: PlayedMatch[],
  theirMatches: PlayedMatch[],
  meta: FormationMeta,
  theirRating: number | null = null,
): FormationPick[] {
  const ours = ourMatches
    .filter(match => isFormation(match.formation) && isFormation(match.opponentFormation))
    .map(match => ({ formation: match.formation!, opponentFormation: match.opponentFormation!, points: RESULT_POINTS[matchResult(match)] }));
  // The opponent's matches turned around: how the teams it played did with their formation against its
  const againstThem = theirMatches
    .filter(match => isFormation(match.formation) && isFormation(match.opponentFormation))
    .map(match => ({
      formation: match.opponentFormation!,
      opponentFormation: match.formation!,
      points: RESULT_POINTS[matchResult({ goalsFor: match.goalsAgainst, goalsAgainst: match.goalsFor })],
    }));

  return FORMATION_NAMES.map(formation => {
    const metaOddsAgainst = opposition.reduce(
      (total, guess) => {
        const odds = metaOdds(meta, formation, guess.formation);
        return { win: total.win + guess.probability * odds.win, draw: total.draw + guess.probability * odds.draw, loss: total.loss + guess.probability * odds.loss };
      },
      { win: 0, draw: 0, loss: 0 },
    );
    const fit = ourFits.get(formation);
    const ourForm = beatTheMeta(ours, formation, OUR_PRIOR_GAMES, meta);
    const theirRecord = beatTheMeta(againstThem, formation, THEIR_PRIOR_GAMES, meta);
    const strength = fit && theirRating !== null ? PPG_PER_OVR * (fit.rating - theirRating) : -PPG_PER_OVR * (fit?.gap ?? 0);
    const odds = shiftOdds(metaOddsAgainst, strength + ourForm.value + theirRecord.value);
    return {
      formation,
      ...odds,
      meta: oddsPoints(metaOddsAgainst),
      strength,
      xiRating: fit?.rating ?? 0,
      ourForm: ourForm.value,
      ourGames: ourForm.games,
      theirRecord: theirRecord.value,
      theirGames: theirRecord.games,
      score: oddsPoints(odds),
      alternative: fit?.alternative ?? [],
      outOfPosition: fit?.outOfPosition ?? [],
    };
  }).sort((a, b) => b.score - a.score);
}

/**
 * Upcoming fixtures split into the next match day's (usually one, two when a league and a cup match fall on the
 * same day) and the ones after it. Days are the viewer's own calendar days. Fixtures come soonest first.
 */
export function splitByMatchDay<T extends { startDate: number }>(fixtures: T[]): { next: T[]; later: T[] } {
  if (fixtures.length === 0) return { next: [], later: [] };
  const day = (fixture: T) => new Date(fixture.startDate).toDateString();
  const nextDay = day(fixtures[0]);
  return { next: fixtures.filter(fixture => day(fixture) === nextDay), later: fixtures.filter(fixture => day(fixture) !== nextDay) };
}
