import { ALL_POSITIONS, POSITIONS, POSITION_GROUPS, getFilterPositions } from './positionOptions';

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

const range = (from: number, to: number, step = 1) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);

// What each dropdown offers. Age and overall are picked exactly, since a band like 70-82 matters;
// stat minimums are rough cut-offs.
export const NUMBER_FILTER_OPTIONS = Object.fromEntries(
  NUMBER_FILTERS.map(filter => [filter, filter === 'ageMax' ? range(16, 40) : filter.startsWith('overall') ? range(40, 99) : range(20, 95, 5)])
) as Record<NumberFilter, number[]>;

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

const isPosition = (value: string) =>
  value === ALL_POSITIONS || POSITIONS.some(position => position.value === value) || Object.keys(POSITION_GROUPS).includes(value);

/** Filters read back from storage. Anything missing, or no longer offered by its dropdown, falls back to its default. */
export function parseScoutFilters(raw: unknown): ScoutFilters {
  const saved = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const filters = { ...DEFAULT_SCOUT_FILTERS };

  if (typeof saved.position === 'string' && isPosition(saved.position)) filters.position = saved.position;
  for (const filter of NUMBER_FILTERS) {
    const value = saved[filter];
    if (value === null || (typeof value === 'number' && NUMBER_FILTER_OPTIONS[filter].includes(value))) filters[filter] = value;
  }
  if (typeof saved.isFreeAgent === 'boolean') filters.isFreeAgent = saved.isFreeAgent;
  if (typeof saved.limit === 'number' && LISTING_LIMITS.includes(saved.limit)) filters.limit = saved.limit;

  return filters;
}

const SCOUT_SETTINGS_KEY = 'mfl-data-scout-settings';

export interface ScoutSettings {
  filters: ScoutFilters;
  // The page checks the field is still one of its columns
  sort: { field: string; direction: 'asc' | 'desc' } | null;
}

/** The filters and sort last used on the Scout page in this browser, or null if there are none. */
export function loadScoutSettings(): ScoutSettings | null {
  try {
    const stored = window.localStorage.getItem(SCOUT_SETTINGS_KEY);
    if (stored === null) return null;

    const parsed = JSON.parse(stored);
    const sort = parsed?.sort;
    return {
      filters: parseScoutFilters(parsed?.filters),
      sort: typeof sort?.field === 'string' && (sort.direction === 'asc' || sort.direction === 'desc')
        ? { field: sort.field, direction: sort.direction }
        : null
    };
  } catch {
    return null; // Storage is blocked (private browsing, say) or what was saved is not JSON
  }
}

export function saveScoutSettings(settings: ScoutSettings): void {
  try {
    window.localStorage.setItem(SCOUT_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Remembering the settings is a convenience; the page works the same without it
  }
}
