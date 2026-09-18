import { ALL_POSITIONS, getFilterPositions } from './positionOptions';

// Outfield stats the marketplace search can set a minimum for
export const FILTER_STATS = ['pace', 'shooting', 'passing', 'dribbling', 'defense', 'physical'] as const;
export type FilterStat = typeof FILTER_STATS[number];

// Named after the MFL listing parameter each one becomes. null leaves that filter off.
export type NumberFilter = 'ageMax' | 'overallMin' | 'overallMax' | `${FilterStat}Min`;
export type ScoutFilters = Record<NumberFilter, number | null> & {
  position: string; // A position, a position group, or ALL_POSITIONS
  isFreeAgent: boolean; // Only players without a club
  limit: number;
};

export const NUMBER_FILTERS: NumberFilter[] = ['ageMax', 'overallMin', 'overallMax', ...FILTER_STATS.map(stat => `${stat}Min` as const)];

// Every listed player costs a paced MFL request the first time their history is loaded
export const LISTING_LIMITS = [20, 30, 50];

// Young free agents with room to grow
export const DEFAULT_SCOUT_FILTERS: ScoutFilters = {
  position: ALL_POSITIONS,
  ageMax: 23,
  overallMin: 70,
  overallMax: 82,
  paceMin: 50,
  shootingMin: null,
  passingMin: 50,
  dribblingMin: null,
  defenseMin: null,
  physicalMin: null,
  isFreeAgent: true,
  limit: 20
};

export function filtersEqual(a: ScoutFilters, b: ScoutFilters): boolean {
  return a.position === b.position && a.isFreeAgent === b.isFreeAgent && a.limit === b.limit
    && NUMBER_FILTERS.every(filter => a[filter] === b[filter]);
}

/** The MFL listings search for these filters: available players, newest listing first. */
export function buildListingsQuery(filters: ScoutFilters): URLSearchParams {
  const query = new URLSearchParams({
    limit: String(LISTING_LIMITS.includes(filters.limit) ? filters.limit : DEFAULT_SCOUT_FILTERS.limit),
    type: 'PLAYER',
    sorts: 'listing.createdDateTime',
    sortsOrders: 'DESC',
    status: 'AVAILABLE'
  });

  for (const filter of NUMBER_FILTERS) {
    const value = filters[filter];
    if (value === null || !Number.isFinite(value)) continue;
    query.set(filter, String(Math.min(99, Math.max(0, Math.round(value)))));
  }
  // MFL matches any position a player can play, not only their primary one
  const positions = getFilterPositions(filters.position);
  if (positions) query.set('positions', positions.join(','));
  // Left off rather than sent as false: unticked means every player, not only those with a club
  if (filters.isFreeAgent) query.set('isFreeAgent', 'true');
  query.set('view', 'full');

  return query;
}
