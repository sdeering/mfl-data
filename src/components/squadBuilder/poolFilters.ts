import type { MFLPlayer } from '../../types/mflApi';
import type { MFLPosition } from '../../types/positionOvr';
import { positionFit } from '../../utils/squadLineups';
import { isRetiringThisSeason } from '../../utils/appSettings';
import { STAT_KEYS, fullName } from './shared';

export type StatKey = (typeof STAT_KEYS)[number];
export type Range = [min: number, max: number];

export const POSITION_GROUPS: Record<string, MFLPosition[] | null> = {
  All: null,
  GK: ['GK'],
  DEF: ['CB', 'LB', 'RB', 'LWB', 'RWB'],
  MID: ['CDM', 'CM', 'CAM', 'LM', 'RM'],
  FWD: ['LW', 'RW', 'ST', 'CF'],
};

/** MFL's card types, by the overall each starts at. */
export const CARD_TYPES = [
  { key: 'common', label: 'Common', min: 0 },
  { key: 'limited', label: 'Limited', min: 55 },
  { key: 'uncommon', label: 'Uncommon', min: 65 },
  { key: 'rare', label: 'Rare', min: 75 },
  { key: 'legendary', label: 'Legendary', min: 85 },
  { key: 'ultimate', label: 'Ultimate', min: 95 },
] as const;
export type CardType = (typeof CARD_TYPES)[number]['key'];

export const cardTypeOf = (overall: number): CardType => [...CARD_TYPES].reverse().find(type => overall >= type.min)?.key ?? 'common';

export interface PoolFilters {
  group: string;
  cardTypes: CardType[];
  overall: Range;
  /** The player's best rating at one of their positions */
  positionRating: Range;
  stats: Record<StatKey, Range>;
  /** Leave out players in the lineup or in another saved squad */
  hideSelected: boolean;
  /** Leave out players retiring at the end of this season, here and when auto-filling */
  hideRetiring: boolean;
}

const FULL: Range = [0, 100];
export const DEFAULT_POOL_FILTERS: PoolFilters = {
  group: 'All',
  cardTypes: [],
  overall: FULL,
  positionRating: FULL,
  stats: { pace: FULL, shooting: FULL, passing: FULL, dribbling: FULL, defense: FULL, physical: FULL },
  hideSelected: false,
  hideRetiring: false,
};

export const isFiltering = (filters: PoolFilters) => JSON.stringify(filters) !== JSON.stringify(DEFAULT_POOL_FILTERS);

const within = (value: number, [min, max]: Range) => value >= min && value <= max;
const bestPositionRating = (player: MFLPlayer) =>
  Math.max(0, ...player.metadata.positions.map(position => positionFit(player, position as MFLPosition).rating));

/** The players matching the search (a name or ID) and the filters, highest overall first. */
export function filterPool(players: MFLPlayer[], search: string, filters: PoolFilters, isSelected: (player: MFLPlayer) => boolean): MFLPlayer[] {
  const q = search.trim().toLowerCase();
  const positions = POSITION_GROUPS[filters.group];
  return players
    .filter(player => {
      const m = player.metadata;
      return (
        (!q || fullName(player).toLowerCase().includes(q) || String(player.id).includes(q)) &&
        (!positions || m.positions.some(position => positions.includes(position as MFLPosition))) &&
        (filters.cardTypes.length === 0 || filters.cardTypes.includes(cardTypeOf(m.overall))) &&
        within(m.overall, filters.overall) &&
        STAT_KEYS.every(key => within(m[key] ?? 0, filters.stats[key])) &&
        (!filters.hideSelected || !isSelected(player)) &&
        (!filters.hideRetiring || !isRetiringThisSeason(player)) &&
        // Last, as it works out ratings
        (filters.positionRating === FULL || within(bestPositionRating(player), filters.positionRating))
      );
    })
    .sort((a, b) => b.metadata.overall - a.metadata.overall);
}
