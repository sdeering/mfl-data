import type { MFLPlayer } from '../types/mflApi';
import type { MFLPosition } from '../types/positionOvr';
import type { SavedSquad, SquadLineups, SquadPlayers } from '../services/squadService';
import { calculatePositionOVR } from './ruleBasedPositionCalculator';
import { isRetiredPlayer } from './appSettings';

/*
 * The squad builder's model: a squad is one or more lineups (the same players tried in different formations),
 * each a starting XI and a bench, holding player IDs. Everything here is pure so the page can stay about layout.
 */

export const XI_SIZE = 11;
export const BENCH_SIZE = 7;

export type Slot = [position: MFLPosition, x: number, y: number];

const GK: Slot = ['GK', 50, 90];
const BACK_FOUR: Slot[] = [['LB', 14, 70], ['CB', 37, 75], ['CB', 63, 75], ['RB', 86, 70]];
const BACK_THREE: Slot[] = [['CB', 27, 74], ['CB', 50, 77], ['CB', 73, 74]];

/** Each formation's positions, with where they stand as % across and down the pitch (own goal at the bottom). */
export const FORMATIONS: Record<string, Slot[]> = {
  '4-3-3': [GK, ...BACK_FOUR, ['CM', 28, 50], ['CDM', 50, 58], ['CM', 72, 50], ['LW', 18, 24], ['ST', 50, 17], ['RW', 82, 24]],
  '4-4-2': [GK, ...BACK_FOUR, ['LM', 13, 45], ['CM', 38, 51], ['CM', 62, 51], ['RM', 87, 45], ['ST', 38, 20], ['ST', 62, 20]],
  '4-2-3-1': [GK, ...BACK_FOUR, ['CDM', 37, 58], ['CDM', 63, 58], ['LW', 17, 34], ['CAM', 50, 37], ['RW', 83, 34], ['ST', 50, 16]],
  '4-1-2-1-2': [GK, ...BACK_FOUR, ['CDM', 50, 61], ['CM', 27, 48], ['CM', 73, 48], ['CAM', 50, 36], ['ST', 38, 17], ['ST', 62, 17]],
  '3-5-2': [GK, ...BACK_THREE, ['LWB', 11, 46], ['CM', 33, 48], ['CDM', 50, 58], ['CM', 67, 48], ['RWB', 89, 46], ['ST', 38, 19], ['ST', 62, 19]],
  '3-4-3': [GK, ...BACK_THREE, ['LM', 13, 47], ['CM', 38, 52], ['CM', 62, 52], ['RM', 87, 47], ['LW', 20, 23], ['ST', 50, 17], ['RW', 80, 23]],
  '5-3-2': [GK, ['LWB', 9, 62], ['CB', 30, 75], ['CB', 50, 77], ['CB', 70, 75], ['RWB', 91, 62], ['CM', 29, 48], ['CM', 50, 53], ['CM', 71, 48], ['ST', 38, 19], ['ST', 62, 19]],
};
export const FORMATION_NAMES = Object.keys(FORMATIONS);
const DEFAULT_FORMATION = '4-3-3';

export const ALL_POSITIONS: MFLPosition[] = ['GK', 'CB', 'LB', 'RB', 'LWB', 'RWB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'CF', 'ST'];

export interface Lineup {
  id: number;
  name: string;
  formation: string;
  xi: (number | null)[];
  bench: (number | null)[];
}

/** A place in the current lineup: one of the formation's positions, or a seat on the bench. */
export interface SlotRef {
  type: 'xi' | 'bench';
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
export const lineupPlayerIds = (lineup: Lineup) => [...lineup.xi, ...lineup.bench].filter((id): id is number => id !== null);

const isGoalkeeper = (player: MFLPlayer) => player.metadata.positions[0] === 'GK';

/**
 * Puts the given players into the formation's positions, best fit first: of every player and position
 * the highest rating is filled, then the next, so each position gets the best player still free for it.
 */
function placeBestFit(formation: string, players: MFLPlayer[]): (number | null)[] {
  const slots = FORMATIONS[formation];
  const pairs: [score: number, id: number, index: number][] = [];
  for (const player of players) {
    slots.forEach(([position], index) => {
      // A thousandth of the overall settles ties in favour of the better player
      pairs.push([positionFit(player, position).rating + player.metadata.overall / 1000, player.id, index]);
    });
  }
  pairs.sort((a, b) => b[0] - a[0]);

  const xi = emptyXi();
  const placed = new Set<number>();
  for (const [, id, index] of pairs) {
    if (xi[index] === null && !placed.has(id)) {
      xi[index] = id;
      placed.add(id);
    }
  }
  return xi;
}

/** The best XI the players can make in a formation, with the next best on the bench (a goalkeeper first). */
export function autoFillLineup(formation: string, players: MFLPlayer[]): Pick<Lineup, 'xi' | 'bench'> {
  const available = players.filter(player => !isRetiredPlayer(player));
  const xi = placeBestFit(formation, available);
  const rest = available.filter(player => !xi.includes(player.id)).sort((a, b) => b.metadata.overall - a.metadata.overall);
  const keeper = rest.find(isGoalkeeper);
  const bench = (keeper ? [keeper, ...rest.filter(player => player !== keeper)] : rest).slice(0, BENCH_SIZE).map(player => player.id);
  return { xi, bench: [...bench, ...emptyBench()].slice(0, BENCH_SIZE) };
}

/** A squad to start from: the best XI in two formations. */
export function defaultLineups(players: MFLPlayer[]): Lineup[] {
  return [
    { id: 1, name: 'Lineup A', formation: '4-3-3', ...autoFillLineup('4-3-3', players) },
    { id: 2, name: 'Lineup B', formation: '4-4-2', ...autoFillLineup('4-4-2', players) },
  ];
}

/** Where a click puts a player: the empty position they suit best, otherwise the first free seat on the bench. */
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
  return seat >= 0 ? { type: 'bench', index: seat } : null;
}

/**
 * Puts a player in a slot. One already in the lineup moves there and swaps with whoever had it;
 * one coming from outside replaces them.
 */
export function assignPlayer(lineup: Lineup, playerId: number, target: SlotRef): Lineup {
  const xi = [...lineup.xi];
  const bench = [...lineup.bench];
  const targetList = target.type === 'xi' ? xi : bench;
  const from = xi.includes(playerId) ? { list: xi, index: xi.indexOf(playerId) } : bench.includes(playerId) ? { list: bench, index: bench.indexOf(playerId) } : null;
  if (from && from.list === targetList && from.index === target.index) return lineup;

  const occupant = targetList[target.index];
  if (from) from.list[from.index] = occupant;
  targetList[target.index] = playerId;
  return { ...lineup, xi, bench };
}

export function removePlayer(lineup: Lineup, playerId: number): Lineup {
  const clear = (ids: (number | null)[]) => ids.map(id => (id === playerId ? null : id));
  return { ...lineup, xi: clear(lineup.xi), bench: clear(lineup.bench) };
}

/** Switches formation, keeping the same starters and moving each to the new position they suit best. */
export function changeFormation(lineup: Lineup, formation: string, playersById: Map<number, MFLPlayer>): Lineup {
  const starters = lineup.xi.map(id => (id === null ? undefined : playersById.get(id))).filter((p): p is MFLPlayer => !!p);
  return { ...lineup, formation, xi: placeBestFit(formation, starters) };
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

/** The season the agency's contracts run in: MFL gives each a start season, and they last a season at a time. */
export function currentSeason(players: MFLPlayer[]): number | null {
  const seasons = players.map(player => player.activeContract?.startSeason).filter((season): season is number => typeof season === 'number');
  return seasons.length ? Math.max(...seasons) : null;
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
      lineups: lineups.map(({ name, formation, xi, bench }) => ({ name, formation, xi, bench })),
      players,
    },
  };
}

/**
 * Lineups from a saved squad. Squads saved before lineups existed were one formation, keyed by position
 * ("CB1", "ST2") with any extra players as "EXTRA1"...; those become a single lineup, the extras on the bench.
 * `dropped` counts the players that did not fit on it.
 */
export function fromSavedSquad(saved: Pick<SavedSquad, 'formation_id' | 'players'>): { lineups: Lineup[]; players: MFLPlayer[]; dropped: number } {
  if (isLineupsData(saved.players)) {
    const fit = (ids: unknown, size: number) => [...(Array.isArray(ids) ? ids : []), ...Array(size).fill(null)].slice(0, size).map(id => (typeof id === 'number' ? id : null));
    const lineups = saved.players.lineups
      .filter(lineup => FORMATIONS[lineup.formation])
      .map((lineup, index) => ({ id: index + 1, name: lineup.name, formation: lineup.formation, xi: fit(lineup.xi, XI_SIZE), bench: fit(lineup.bench, BENCH_SIZE) }));
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
    lineups: [{ id: 1, name: 'Lineup A', formation, xi, bench: [...benchQueue, ...emptyBench()].slice(0, BENCH_SIZE) }],
    players: entries.map(([, entry]) => entry.player),
    dropped: Math.max(0, benchQueue.length - BENCH_SIZE),
  };
}

/** Every player in a saved squad, whichever way it was saved. */
export function savedSquadPlayerIds(saved: Pick<SavedSquad, 'formation_id' | 'players'>): Set<number> {
  const { lineups, players } = fromSavedSquad(saved);
  return new Set([...lineups.flatMap(lineupPlayerIds), ...players.map(player => player.id)]);
}
