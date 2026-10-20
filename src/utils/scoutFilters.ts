import { ALL_POSITIONS, POSITIONS, POSITION_GROUPS, getFilterPositions } from './positionOptions';

// Outfield stats the marketplace search can set a minimum for
export const FILTER_STATS = ['pace', 'shooting', 'passing', 'dribbling', 'defense', 'physical'] as const;
export type FilterStat = typeof FILTER_STATS[number];

// Named after the MFL listing parameter each one becomes. null leaves that filter off.
export type NumberFilter = 'ageMax' | 'overallMin' | 'overallMax' | 'priceMax' | `${FilterStat}Min`;

export type ScoutFilters = Record<NumberFilter, number | null> & {
  position: string; // A position, a position group, or ALL_POSITIONS
  // Only players without a club. Off is every player, under contract or not.
  isFreeAgent: boolean;
  limit: number;
  // Only players who rate higher at another position than their primary. MFL can't search for it,
  // so it narrows the listings already loaded.
  betterOffPrimary: boolean;
  // Only players who have yet to play a game, so freshly minted. MFL can't search for it either, so
  // each listed player is checked and the ones who have played are hidden.
  newlyMinted: boolean;
};

export const NUMBER_FILTERS: NumberFilter[] = ['ageMax', 'overallMin', 'overallMax', 'priceMax', ...FILTER_STATS.map(stat => `${stat}Min` as const)];

const range = (from: number, to: number, step = 1) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);

// Listing prices to cap at, in dollars
const PRICE_MAX_OPTIONS = [5, 10, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200, 250, 300, 400, 500, 750, 1000];

// What each dropdown offers. Age and overall are picked exactly, since a band like 70-82 matters;
// stat minimums are rough cut-offs.
export const NUMBER_FILTER_OPTIONS = Object.fromEntries(
  NUMBER_FILTERS.map(filter => [filter, filter === 'priceMax' ? PRICE_MAX_OPTIONS : filter === 'ageMax' ? range(16, 40) : filter.startsWith('overall') ? range(40, 99) : range(20, 95, 5)])
) as Record<NumberFilter, number[]>;

// Every listed player costs a paced MFL request the first time their history is loaded
export const LISTING_LIMITS = [20, 30, 50];

// Young free agents with room to grow
export const DEFAULT_SCOUT_FILTERS: ScoutFilters = {
  position: ALL_POSITIONS,
  ageMax: 23,
  overallMin: 70,
  overallMax: 82,
  priceMax: null,
  paceMin: 50,
  shootingMin: null,
  passingMin: 50,
  dribblingMin: null,
  defenseMin: null,
  physicalMin: null,
  isFreeAgent: true,
  limit: 20,
  betterOffPrimary: false,
  newlyMinted: false
};

export function filtersEqual(a: ScoutFilters, b: ScoutFilters): boolean {
  return a.position === b.position && a.isFreeAgent === b.isFreeAgent && a.limit === b.limit && a.betterOffPrimary === b.betterOffPrimary && a.newlyMinted === b.newlyMinted
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
    // Ratings and ages top out at 99; a price in dollars does not
    query.set(filter, String(Math.min(filter === 'priceMax' ? 100000 : 99, Math.max(0, Math.round(value)))));
  }
  // MFL matches any position a player can play, not only their primary one
  const positions = getFilterPositions(filters.position);
  if (positions) query.set('positions', positions.join(','));
  // Left off for every player: MFL takes isFreeAgent=false as only those under contract
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
  if (saved.players === 'freeAgents' || saved.players === 'underContract' || saved.players === 'all') {
    // Saved when this was a Free agents / Under contract / All players dropdown
    filters.isFreeAgent = saved.players === 'freeAgents';
  } else if (typeof saved.isFreeAgent === 'boolean') {
    filters.isFreeAgent = saved.isFreeAgent;
  }
  if (typeof saved.limit === 'number' && LISTING_LIMITS.includes(saved.limit)) filters.limit = saved.limit;
  if (typeof saved.betterOffPrimary === 'boolean') filters.betterOffPrimary = saved.betterOffPrimary;
  if (typeof saved.newlyMinted === 'boolean') filters.newlyMinted = saved.newlyMinted;

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

const SCOUT_PRESETS_KEY = 'mfl-data-scout-presets';

export interface ScoutPreset {
  id: string;
  name: string;
  filters: ScoutFilters;
  sort: { field: string; direction: 'asc' | 'desc' };
}

/** The presets saved in this browser, in the order they were made. */
export function loadScoutPresets(): ScoutPreset[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SCOUT_PRESETS_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap((preset): ScoutPreset[] => {
      const { id, name, sort } = preset ?? {};
      if (typeof id !== 'string' || typeof name !== 'string' || typeof sort?.field !== 'string') return [];
      if (sort.direction !== 'asc' && sort.direction !== 'desc') return [];
      return [{ id, name, filters: parseScoutFilters(preset.filters), sort: { field: sort.field, direction: sort.direction } }];
    });
  } catch {
    return []; // Storage is blocked or what was saved is not JSON
  }
}

export function saveScoutPresets(presets: ScoutPreset[]): void {
  try {
    window.localStorage.setItem(SCOUT_PRESETS_KEY, JSON.stringify(presets));
  } catch {
    // Presets are a convenience; the page works the same without them
  }
}

/** The presets saved for a wallet, or null if they could not be reached. */
export async function fetchWalletPresets(walletAddress: string): Promise<ScoutPreset[] | null> {
  try {
    const res = await fetch(`/api/scout-presets?${new URLSearchParams({ walletAddress })}`);
    if (!res.ok) return null;
    return (await res.json()).presets as ScoutPreset[];
  } catch {
    return null;
  }
}

/** Saves a preset for a wallet. Returns it as stored (a same-named preset keeps its id), or null on failure. */
export async function saveWalletPreset(walletAddress: string, preset: ScoutPreset): Promise<ScoutPreset | null> {
  try {
    const res = await fetch('/api/scout-presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress, preset })
    });
    return res.ok ? (await res.json()).preset as ScoutPreset : null;
  } catch {
    return null;
  }
}

export async function deleteWalletPreset(walletAddress: string, id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/scout-presets?${new URLSearchParams({ walletAddress, id })}`, { method: 'DELETE' });
    return res.ok;
  } catch {
    return false;
  }
}

export interface PlayedCheck {
  played: Record<number, boolean>; // Whether each player has played a game
  rateLimitedSeconds?: number; // Set when MFL asked us to back off before the rest could be checked
}

/** Whether each of these players (a few at a time) has played a game. */
export async function fetchPlayed(playerIds: number[], signal?: AbortSignal): Promise<PlayedCheck> {
  const res = await fetch(`/api/scout/played?${new URLSearchParams({ ids: playerIds.join(',') })}`, { signal });
  const body = await res.json().catch(() => null);
  if (res.status === 429) return { played: body?.played ?? {}, rateLimitedSeconds: body?.retryAfterSeconds ?? 600 };
  if (!res.ok || !body?.success) throw new Error(body?.error ?? 'Failed to check games played');
  return { played: body.played };
}
