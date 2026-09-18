import type { MFLPlayer } from '../types/mflApi';
import type { PlayerExperienceEntry } from '../types/playerExperience';
import { calculatePreciseOverallRating } from './overallRatingCalculator';
import { ATTRIBUTE_STATS, type AttributeStat, type OverallPointsEvent } from './progressionCounts';

/**
 * Each rise in a player's precise overall - the 2-decimal overall shown on the player page, which is
 * the average of their attributes weighted for their primary position.
 *
 * The history is replayed entry by entry, comparing the precise overall before and after each one.
 * A player's first entry only sets their starting attributes, so it is never a gain itself.
 */
export function getOverallPointsEvents(player: MFLPlayer, entries: PlayerExperienceEntry[]): OverallPointsEvent[] {
  const sorted = [...entries].sort((a, b) => a.date - b.date);
  const attributes = {} as Record<AttributeStat, number>;
  // A stat the history never mentions has not changed, so the player's current value stands in
  for (const stat of ATTRIBUTE_STATS) {
    const firstRecorded = sorted.find(entry => typeof entry.values[stat] === 'number')?.values[stat];
    attributes[stat] = firstRecorded ?? player.metadata[stat] ?? 0;
  }

  const preciseOverall = () => calculatePreciseOverallRating({ ...attributes, positions: player.metadata.positions });
  const events: OverallPointsEvent[] = [];
  let current = preciseOverall();

  for (const entry of sorted) {
    let changed = false;
    for (const stat of ATTRIBUTE_STATS) {
      const value = entry.values[stat];
      if (typeof value === 'number' && value !== attributes[stat]) {
        attributes[stat] = value;
        changed = true;
      }
    }
    if (!changed) continue;

    const next = preciseOverall();
    if (next > current) events.push({ date: entry.date, points: next - current });
    current = next;
  }

  return events;
}
