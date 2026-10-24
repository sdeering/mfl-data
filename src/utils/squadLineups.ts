import type { MFLPlayer } from '../types/mflApi';
import type { MFLPosition } from '../types/positionOvr';
import type { SavedSquad, SquadLineups, SquadPlayers } from '../services/squadService';
import { calculatePositionOVR } from './ruleBasedPositionCalculator';
import { isRetiredPlayer } from './appSettings';

/*
 * The squad builder's model: a squad is one or more lineups (the same players tried in different formations),
 * each a starting XI, a bench and reserves, holding player IDs. Everything here is pure so the page can stay about layout.
 */

export const XI_SIZE = 11;
export const BENCH_SIZE = 7;
/** An MFL squad holds 23 players: the matchday 18, and the reserves left out of it. */
export const SQUAD_SIZE = 23;
export const RESERVES_SIZE = SQUAD_SIZE - XI_SIZE - BENCH_SIZE;

export type Slot = [position: MFLPosition, x: number, y: number];

const GK: Slot = ['GK', 50, 90];
const BACK_FOUR: Slot[] = [['LB', 14, 70], ['CB', 37, 75], ['CB', 63, 75], ['RB', 86, 70]];
const BACK_THREE: Slot[] = [['CB', 27, 74], ['CB', 50, 76], ['CB', 73, 74]];
const BACK_FIVE: Slot[] = [['LWB', 8, 60], ['CB', 28, 74], ['CB', 50, 76], ['CB', 72, 74], ['RWB', 92, 60]];

/**
 * Every formation MFL has, keyed by MFL's own name for it, with its positions and where they stand
 * as % across and down the pitch (own goal at the bottom).
 */
export const FORMATIONS: Record<string, Slot[]> = {
  '3-4-2-1': [GK, ...BACK_THREE, ['LM', 13, 48], ['CM', 38, 52], ['CM', 62, 52], ['RM', 87, 48], ['CF', 32, 32], ['CF', 68, 32], ['ST', 50, 16]],
  '3-4-3': [GK, ...BACK_THREE, ['LM', 13, 47], ['CM', 38, 52], ['CM', 62, 52], ['RM', 87, 47], ['LW', 20, 23], ['ST', 50, 17], ['RW', 80, 23]],
  '3-4-3_diamond': [GK, ...BACK_THREE, ['LM', 13, 46], ['CDM', 50, 58], ['CAM', 50, 37], ['RM', 87, 46], ['LW', 20, 22], ['ST', 50, 16], ['RW', 80, 22]],
  '3-5-2': [GK, ...BACK_THREE, ['LM', 9, 42], ['CM', 30, 50], ['CDM', 50, 59], ['CM', 70, 50], ['RM', 91, 42], ['ST', 38, 19], ['ST', 62, 19]],
  '3-5-2_B': [GK, ...BACK_THREE, ['LM', 11, 44], ['CDM', 32, 57], ['CAM', 50, 40], ['CDM', 68, 57], ['RM', 89, 44], ['ST', 38, 19], ['ST', 62, 19]],
  '4-1-2-1-2': [GK, ...BACK_FOUR, ['CDM', 50, 59], ['LM', 16, 45], ['RM', 84, 45], ['CAM', 50, 37], ['ST', 38, 17], ['ST', 62, 17]],
  '4-1-2-1-2_narrow': [GK, ...BACK_FOUR, ['CDM', 50, 61], ['CM', 27, 48], ['CM', 73, 48], ['CAM', 50, 36], ['ST', 38, 17], ['ST', 62, 17]],
  '4-1-3-2': [GK, ...BACK_FOUR, ['CDM', 50, 58], ['LM', 18, 42], ['CM', 50, 43], ['RM', 82, 42], ['ST', 38, 19], ['ST', 62, 19]],
  '4-1-4-1': [GK, ...BACK_FOUR, ['CDM', 50, 59], ['LM', 13, 40], ['CM', 34, 44], ['CM', 66, 44], ['RM', 87, 40], ['ST', 50, 17]],
  '4-2-2-2': [GK, ...BACK_FOUR, ['CDM', 37, 58], ['CDM', 63, 58], ['CAM', 25, 38], ['CAM', 75, 38], ['ST', 38, 18], ['ST', 62, 18]],
  '4-2-3-1': [GK, ...BACK_FOUR, ['CDM', 37, 58], ['CDM', 63, 58], ['LM', 17, 37], ['CAM', 50, 38], ['RM', 83, 37], ['ST', 50, 16]],
  '4-2-4': [GK, ...BACK_FOUR, ['CM', 37, 52], ['CM', 63, 52], ['LW', 14, 26], ['ST', 38, 19], ['ST', 62, 19], ['RW', 86, 26]],
  '4-3-1-2': [GK, ...BACK_FOUR, ['CM', 26, 50], ['CM', 50, 54], ['CM', 74, 50], ['CAM', 50, 37], ['ST', 38, 18], ['ST', 62, 18]],
  '4-3-2-1': [GK, ...BACK_FOUR, ['CM', 26, 52], ['CM', 50, 55], ['CM', 74, 52], ['CF', 33, 33], ['CF', 67, 33], ['ST', 50, 16]],
  '4-3-3': [GK, ...BACK_FOUR, ['CM', 28, 50], ['CM', 50, 55], ['CM', 72, 50], ['LW', 18, 24], ['ST', 50, 17], ['RW', 82, 24]],
  '4-3-3_attack': [GK, ...BACK_FOUR, ['CM', 28, 52], ['CAM', 50, 42], ['CM', 72, 52], ['LW', 18, 24], ['ST', 50, 17], ['RW', 82, 24]],
  '4-3-3_defend': [GK, ...BACK_FOUR, ['CM', 28, 50], ['CDM', 50, 58], ['CM', 72, 50], ['LW', 18, 24], ['ST', 50, 17], ['RW', 82, 24]],
  '4-3-3_false9': [GK, ...BACK_FOUR, ['CM', 28, 50], ['CDM', 50, 58], ['CM', 72, 50], ['LW', 18, 22], ['CF', 50, 30], ['RW', 82, 22]],
  '4-4-1-1': [GK, ...BACK_FOUR, ['LM', 13, 47], ['CM', 38, 52], ['CM', 62, 52], ['RM', 87, 47], ['CF', 50, 33], ['ST', 50, 16]],
  '4-4-2': [GK, ...BACK_FOUR, ['LM', 13, 45], ['CM', 38, 51], ['CM', 62, 51], ['RM', 87, 45], ['ST', 38, 20], ['ST', 62, 20]],
  '4-4-2_B': [GK, ...BACK_FOUR, ['LM', 13, 45], ['CDM', 38, 56], ['CDM', 62, 56], ['RM', 87, 45], ['ST', 38, 20], ['ST', 62, 20]],
  '5-2-3': [GK, ...BACK_FIVE, ['CM', 37, 50], ['CM', 63, 50], ['LW', 18, 24], ['ST', 50, 17], ['RW', 82, 24]],
  '5-3-2': [GK, ...BACK_FIVE, ['LM', 22, 44], ['CM', 50, 50], ['RM', 78, 44], ['ST', 38, 19], ['ST', 62, 19]],
  '5-4-1': [GK, ...BACK_FIVE, ['LM', 22, 42], ['CDM', 50, 57], ['RM', 78, 42], ['CAM', 50, 36], ['ST', 50, 17]],
  '5-4-1_flat': [GK, ...BACK_FIVE, ['LM', 14, 44], ['CM', 37, 47], ['CM', 63, 47], ['RM', 86, 44], ['ST', 50, 19]],
};
export const FORMATION_NAMES = Object.keys(FORMATIONS);

// MFL's variants of a formation, as its game shows them
const VARIANT_LABELS: Record<string, string> = { diamond: 'diamond', B: 'B', narrow: 'narrow', attack: 'att', defend: 'def', false9: 'false 9', flat: 'flat' };

/** "4-3-3 (def)" for MFL's "4-3-3_defend". */
export const formationLabel = (formation: string) => {
  const [shape, variant] = formation.split('_');
  return variant ? `${shape} (${VARIANT_LABELS[variant] ?? variant})` : shape;
};
const DEFAULT_FORMATION = '4-3-3';

export const ALL_POSITIONS: MFLPosition[] = ['GK', 'CB', 'LB', 'RB', 'LWB', 'RWB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'CF', 'ST'];

export interface Lineup {
  id: number;
  name: string;
  formation: string;
  xi: (number | null)[];
  bench: (number | null)[];
  /** The rest of the squad, out of the matchday squad */
  reserves: (number | null)[];
}

const SLOT_TYPES = ['xi', 'bench', 'reserves'] as const;

/** A place in the current lineup: one of the formation's positions, a seat on the bench, or among the reserves. */
export interface SlotRef {
  type: (typeof SLOT_TYPES)[number];
  index: number;
}

/** Natural: one of the player's positions. Alternative: one MFL rates them fairly or somewhat familiar at. */
export type FitKind = 'natural' | 'alt' | 'out';
export interface PositionFit {
  rating: number;
  kind: FitKind;
}

/** The player's rating at a position, as MFL works it out, and how familiar they are with it. */
export function positionFit(player: MFLPlayer, position: MFLPosition): PositionFit {
  const m = player.metadata;
  const result = calculatePositionOVR(
    {
      id: player.id,
      name: `${m.firstName} ${m.lastName}`,
      attributes: { PAC: m.pace, SHO: m.shooting, PAS: m.passing, DRI: m.dribbling, DEF: m.defense, PHY: m.physical, GK: m.goalkeeping || 0 },
      positions: m.positions as MFLPosition[],
      overall: m.overall,
    },
    position,
  );
  const kind: FitKind = result.penalty >= -1 ? 'natural' : result.penalty > -20 ? 'alt' : 'out';
  return { rating: result.ovr, kind };
}

export const emptyXi = () => Array<number | null>(XI_SIZE).fill(null);
export const emptyBench = () => Array<number | null>(BENCH_SIZE).fill(null);
export const emptyReserves = () => Array<number | null>(RESERVES_SIZE).fill(null);
export const lineupPlayerIds = (lineup: Lineup) => [...lineup.xi, ...lineup.bench, ...lineup.reserves].filter((id): id is number => id !== null);

const isGoalkeeper = (player: MFLPlayer) => player.metadata.positions[0] === 'GK';

/**
 * Puts players into the formation's empty positions, best fit first: of every player and position the
 * highest rating is filled, then the next, so each position gets the best player still free for it.
 * `accept` limits which fits count, e.g. none out of position.
 */
function fillPositions(
  formation: string,
  players: MFLPlayer[],
  xi: (number | null)[] = emptyXi(),
  accept: (fit: PositionFit) => boolean = () => true,
): (number | null)[] {
  const filled = [...xi];
  const placed = new Set(filled);
  const pairs: [score: number, id: number, index: number][] = [];
  for (const player of players) {
    if (placed.has(player.id)) continue;
    FORMATIONS[formation].forEach(([position], index) => {
      if (filled[index] !== null) return;
      const fit = positionFit(player, position);
      // A thousandth of the overall settles ties in favour of the better player
      if (accept(fit)) pairs.push([fit.rating + player.metadata.overall / 1000, player.id, index]);
    });
  }
  pairs.sort((a, b) => b[0] - a[0]);

  for (const [, id, index] of pairs) {
    if (filled[index] === null && !placed.has(id)) {
      filled[index] = id;
      placed.add(id);
    }
  }
  return filled;
}

/** The best of the players not in the XI on the bench, a goalkeeper first, and the next best as reserves. */
function restFrom(players: MFLPlayer[], xi: (number | null)[]): Pick<Lineup, 'bench' | 'reserves'> {
  const rest = players.filter(player => !xi.includes(player.id)).sort((a, b) => b.metadata.overall - a.metadata.overall);
  const keeper = rest.find(isGoalkeeper);
  const ids = (keeper ? [keeper, ...rest.filter(player => player !== keeper)] : rest).map(player => player.id);
  return {
    bench: [...ids.slice(0, BENCH_SIZE), ...emptyBench()].slice(0, BENCH_SIZE),
    reserves: [...ids.slice(BENCH_SIZE, BENCH_SIZE + RESERVES_SIZE), ...emptyReserves()].slice(0, RESERVES_SIZE),
  };
}

type Filled = Pick<Lineup, 'xi' | 'bench' | 'reserves'>;

/** The best XI the players can make in a formation, with the next best on the bench (a goalkeeper first) and as reserves. Never a retired player. */
export function autoFillLineup(formation: string, players: MFLPlayer[]): Filled {
  const available = players.filter(player => !isRetiredPlayer(player));
  const xi = fillPositions(formation, available);
  return { xi, ...restFrom(available, xi) };
}

/**
 * Auto-fill for a squad that already has players. They fill the formation first, each where they play
 * naturally or at an alternative position. Only positions none of them can play are filled from `others`,
 * again by players who can play there. Any position still empty takes a squad player out of position,
 * then anyone. The bench and reserves are the squad players left over.
 */
export function autoFillFromSquad(formation: string, squad: MFLPlayer[], others: MFLPlayer[]): Filled {
  const squadPlayers = squad.filter(player => !isRetiredPlayer(player));
  const inSquad = new Set(squadPlayers.map(player => player.id));
  const newcomers = others.filter(player => !isRetiredPlayer(player) && !inSquad.has(player.id));

  const playsThere = (fit: PositionFit) => fit.kind !== 'out';
  let xi = fillPositions(formation, squadPlayers, emptyXi(), playsThere);
  xi = fillPositions(formation, newcomers, xi, playsThere);
  xi = fillPositions(formation, squadPlayers, xi);
  xi = fillPositions(formation, newcomers, xi);
  return { xi, ...restFrom(squadPlayers, xi) };
}

/** A squad to start from: the best XI in two formations. */
export function defaultLineups(players: MFLPlayer[]): Lineup[] {
  return [
    { id: 1, name: 'Lineup A', formation: '4-3-3', ...autoFillLineup('4-3-3', players) },
    { id: 2, name: 'Lineup B', formation: '4-4-2', ...autoFillLineup('4-4-2', players) },
  ];
}

/** Where a click puts a player: the empty position they suit best, otherwise the first free seat on the bench, then among the reserves. */
export function bestFreeSlot(lineup: Lineup, player: MFLPlayer): SlotRef | null {
  let best: SlotRef | null = null;
  let bestRating = -1;
  FORMATIONS[lineup.formation].forEach(([position], index) => {
    if (lineup.xi[index] !== null) return;
    const { rating } = positionFit(player, position);
    if (rating > bestRating) {
      bestRating = rating;
      best = { type: 'xi', index };
    }
  });
  if (best) return best;
  const seat = lineup.bench.indexOf(null);
  if (seat >= 0) return { type: 'bench', index: seat };
  const reserve = lineup.reserves.indexOf(null);
  return reserve >= 0 ? { type: 'reserves', index: reserve } : null;
}

/**
 * Puts a player in a slot. One already in the lineup moves there and swaps with whoever had it;
 * one coming from outside replaces them.
 */
export function assignPlayer(lineup: Lineup, playerId: number, target: SlotRef): Lineup {
  const lists = { xi: [...lineup.xi], bench: [...lineup.bench], reserves: [...lineup.reserves] };
  const fromType = SLOT_TYPES.find(type => lists[type].includes(playerId));
  const from = fromType ? { list: lists[fromType], index: lists[fromType].indexOf(playerId) } : null;
  const targetList = lists[target.type];
  if (from && from.list === targetList && from.index === target.index) return lineup;

  const occupant = targetList[target.index];
  if (from) from.list[from.index] = occupant;
  targetList[target.index] = playerId;
  return { ...lineup, ...lists };
}

export function removePlayer(lineup: Lineup, playerId: number): Lineup {
  const clear = (ids: (number | null)[]) => ids.map(id => (id === playerId ? null : id));
  return { ...lineup, xi: clear(lineup.xi), bench: clear(lineup.bench), reserves: clear(lineup.reserves) };
}

/** Switches formation, keeping the same starters and moving each to the new position they suit best. */
export function changeFormation(lineup: Lineup, formation: string, playersById: Map<number, MFLPlayer>): Lineup {
  const starters = lineup.xi.map(id => (id === null ? undefined : playersById.get(id))).filter((p): p is MFLPlayer => !!p);
  return { ...lineup, formation, xi: fillPositions(formation, starters) };
}

/** "Lineup C" for the third lineup, and so on. */
export function nextLineupName(lineups: Lineup[]): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const taken = new Set(lineups.map(lineup => lineup.name));
  for (const letter of letters) {
    if (!taken.has(`Lineup ${letter}`)) return `Lineup ${letter}`;
  }
  return `Lineup ${lineups.length + 1}`;
}

// Saving

const isLineupsData = (players: SavedSquad['players']): players is SquadLineups =>
  !!players && Array.isArray((players as SquadLineups).lineups);

/** What the squads API stores for these lineups: the IDs, plus each player as they are now. */
export function toSavedSquad(lineups: Lineup[], playersById: Map<number, MFLPlayer>): { formationId: string; players: SquadLineups } {
  const players: Record<string, MFLPlayer> = {};
  lineups.flatMap(lineupPlayerIds).forEach(id => {
    const player = playersById.get(id);
    if (player) players[id] = player;
  });
  return {
    formationId: lineups[0]?.formation ?? DEFAULT_FORMATION,
    players: {
      lineups: lineups.map(({ name, formation, xi, bench, reserves }) => ({ name, formation, xi, bench, reserves })),
      players,
    },
  };
}

/** IDs padded or cut to a slot list's size, anything that isn't an ID left empty. */
export const fitSlots = (ids: unknown, size: number): (number | null)[] =>
  [...(Array.isArray(ids) ? ids : []), ...Array(size).fill(null)].slice(0, size).map(id => (typeof id === 'number' ? id : null));

/**
 * Lineups from a saved squad. Squads saved before lineups existed were one formation, keyed by position
 * ("CB1", "ST2") with any extra players as "EXTRA1"...; those become a single lineup, the extras on the bench
 * and then among the reserves. `dropped` counts the players that did not fit. Lineups saved before reserves have none.
 */
export function fromSavedSquad(saved: Pick<SavedSquad, 'formation_id' | 'players'>): { lineups: Lineup[]; players: MFLPlayer[]; dropped: number } {
  if (isLineupsData(saved.players)) {
    const lineups = saved.players.lineups
      .filter(lineup => FORMATIONS[lineup.formation])
      .map((lineup, index) => ({
        id: index + 1,
        name: lineup.name,
        formation: lineup.formation,
        xi: fitSlots(lineup.xi, XI_SIZE),
        bench: fitSlots(lineup.bench, BENCH_SIZE),
        reserves: fitSlots(lineup.reserves, RESERVES_SIZE),
      }));
    return { lineups, players: Object.values(saved.players.players ?? {}), dropped: 0 };
  }

  const formation = FORMATIONS[saved.formation_id] ? saved.formation_id : DEFAULT_FORMATION;
  const slots = FORMATIONS[formation];
  const entries = Object.entries((saved.players ?? {}) as SquadPlayers).filter(([, entry]) => entry?.player?.id);
  const xi = emptyXi();
  const leftOver: number[] = [];

  const extraNumber = (key: string) => parseInt(key.replace('EXTRA', ''), 10) || 0;
  entries
    .filter(([key]) => !key.startsWith('EXTRA'))
    .forEach(([key, entry]) => {
      const position = key.replace(/[0-9]+$/, '');
      const index = slots.findIndex(([slotPosition], i) => xi[i] === null && slotPosition === position);
      if (index >= 0) xi[index] = entry.player.id;
      else leftOver.push(entry.player.id);
    });
  const extras = entries
    .filter(([key]) => key.startsWith('EXTRA'))
    .sort(([a], [b]) => extraNumber(a) - extraNumber(b))
    .map(([, entry]) => entry.player.id);

  // Starters whose position the formation lacks take any empty one; the rest wait on the bench
  const benchQueue: number[] = [];
  for (const id of leftOver) {
    const index = xi.indexOf(null);
    if (index >= 0) xi[index] = id;
    else benchQueue.push(id);
  }
  benchQueue.push(...extras);
  return {
    lineups: [
      {
        id: 1,
        name: 'Lineup A',
        formation,
        xi,
        bench: fitSlots(benchQueue, BENCH_SIZE),
        reserves: fitSlots(benchQueue.slice(BENCH_SIZE), RESERVES_SIZE),
      },
    ],
    players: entries.map(([, entry]) => entry.player),
    dropped: Math.max(0, benchQueue.length - BENCH_SIZE - RESERVES_SIZE),
  };
}

/** Every player in a saved squad, whichever way it was saved. */
export function savedSquadPlayerIds(saved: Pick<SavedSquad, 'formation_id' | 'players'>): Set<number> {
  const { lineups, players } = fromSavedSquad(saved);
  return new Set([...lineups.flatMap(lineupPlayerIds), ...players.map(player => player.id)]);
}
