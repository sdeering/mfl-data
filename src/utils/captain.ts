import type { MFLPlayer } from '../types/mflApi';
import { lineOf, type Line } from './squadComparison';
import { FORMATIONS, XI_SIZE, positionFit } from './squadLineups';

/*
 * MFL's captain: they play at +2 OVR, and the whole XI gets an attribute bonus by the captain's position. Which
 * captain helps most depends on the XI: a midfield captain's passing suits an XI rated on passing, a forward's
 * shooting one rated on shooting. Pure, so the planner, the page and the AI read the same numbers.
 */

/** The captain's own boost, on their rating at their position */
export const CAPTAIN_OVR = 2;

type BoostedAttribute = 'pace' | 'shooting' | 'passing' | 'dribbling' | 'defense' | 'physical';

/** What the whole XI gets, by the captain's line, as MFL's "How the captain works" lists it */
export const CAPTAIN_BONUS: Record<Line, Partial<Record<BoostedAttribute, number>>> = {
  GK: { defense: 2 },
  DEF: { defense: 2, physical: 1 },
  MID: { passing: 2, dribbling: 1 },
  ATT: { shooting: 2, pace: 1 },
};

export const describeBonus = (line: Line) =>
  Object.entries(CAPTAIN_BONUS[line])
    .map(([attribute, value]) => `+${value} ${attribute.slice(0, 3).toUpperCase()}`)
    .join(', ');

/** Attributes top out at 99: the position calculator rates a player 0 past it */
const MAX_ATTRIBUTE = 99;

/** The player with the line's bonus added to their attributes */
function boosted(player: MFLPlayer, line: Line): MFLPlayer {
  const metadata = { ...player.metadata };
  for (const [attribute, value] of Object.entries(CAPTAIN_BONUS[line]) as [BoostedAttribute, number][]) {
    metadata[attribute] = Math.min(MAX_ATTRIBUTE, metadata[attribute] + value);
  }
  return { ...player, metadata };
}

export interface CaptainOption {
  playerId: number;
  /** Their position in the formation, and its line, which decides the XI's bonus */
  position: string;
  line: Line;
  /** The XI's average rating with them as captain */
  rating: number;
  /** How much that is above the XI with no captain */
  gain: number;
}

/**
 * Every player in the XI as captain, the one who lifts the XI's average rating most first. `xi` holds player IDs
 * by the formation's positions, null where empty (counted as 0, as the XI's rating counts them).
 */
export function captainOptions(formation: string, xi: (number | null)[], playersById: Map<number, MFLPlayer>): CaptainOption[] {
  const slots = FORMATIONS[formation].map(([position], index) => {
    const id = xi[index];
    const player = id === null || id === undefined ? undefined : playersById.get(id);
    return { position, line: lineOf(position), player };
  });
  const base = slots.reduce((total, slot) => total + (slot.player ? positionFit(slot.player, slot.position).rating : 0), 0) / XI_SIZE;
  // The XI's total with each line's bonus, worked out once per line
  const totals = new Map<Line, number>();
  const totalWith = (line: Line) => {
    if (!totals.has(line)) {
      totals.set(line, slots.reduce((total, slot) => total + (slot.player ? positionFit(boosted(slot.player, line), slot.position).rating : 0), 0));
    }
    return totals.get(line)!;
  };
  return slots
    .filter(slot => slot.player)
    .map(slot => {
      const rating = (totalWith(slot.line) + CAPTAIN_OVR) / XI_SIZE;
      return { playerId: slot.player!.id, position: slot.position, line: slot.line, rating, gain: rating - base };
    })
    // The best lift, then the higher-rated player, who is likelier to play the whole match
    .sort((a, b) => b.rating - a.rating || playersById.get(b.playerId)!.metadata.overall - playersById.get(a.playerId)!.metadata.overall);
}
