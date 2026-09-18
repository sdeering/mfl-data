'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { loadProgressionHistories, type PlayerHistories, type ProgressionLoadProgress } from '../services/playerProgressionService';
import type { MFLListing, MFLPosition } from '../types/mflApi';
import { ALL_POSITIONS, POSITIONS, POSITION_GROUPS } from '../utils/positionOptions';
import { ATTRIBUTE_STATS, STAT_LABELS, STAT_NAMES, getWindowStart, type AttributeStat } from '../utils/progressionCounts';
import {
  DEFAULT_SCOUT_FILTERS,
  FILTER_STATS,
  LISTING_LIMITS,
  buildListingsQuery,
  filtersEqual,
  type NumberFilter,
  type ScoutFilters
} from '../utils/scoutFilters';
import { getTierColor } from '../utils/ratingUtils';
import { getOverallPointsSince } from '../utils/preciseOverallGain';
import { calculatePositionOVR } from '../utils/ruleBasedPositionCalculator';

// Rise in precise (2-decimal) overall over each period
const OVERALL_COLUMNS = [
  { key: 'overall7', days: 7, label: '+OVR 7D' },
  { key: 'overall30', days: 30, label: '+OVR 30D' },
  { key: 'overall90', days: 90, label: '+OVR 90D' }
] as const;
type OverallKey = typeof OVERALL_COLUMNS[number]['key'];

const range = (from: number, to: number, step = 1) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);

// Age and overall are picked exactly, since a band like 70-82 matters; stat minimums are rough cut-offs
const NUMBER_SELECTS: Array<{ filter: NumberFilter; label: string; title: string; options: number[] }> = [
  { filter: 'ageMax', label: 'Max age', title: 'Oldest age to include', options: range(16, 40) },
  { filter: 'overallMin', label: 'Min OVR', title: 'Lowest overall to include', options: range(40, 99) },
  { filter: 'overallMax', label: 'Max OVR', title: 'Highest overall to include', options: range(40, 99) },
  ...FILTER_STATS.map(stat => ({
    filter: `${stat}Min` as const,
    label: `Min ${STAT_LABELS[stat]}`,
    title: `Lowest ${STAT_NAMES[stat].toLowerCase()} to include`,
    options: range(20, 95, 5)
  }))
];

type SortField = 'name' | 'age' | 'position' | 'rating' | 'price' | 'listed' | OverallKey | AttributeStat;

interface ScoutRow {
  listing: MFLListing;
  name: string;
  positionRatings: Array<{ position: MFLPosition; rating: number }>; // Every position the player can play
  overallPoints: Record<OverallKey, number> | null; // null until the player's history has loaded
}

// Rating at one of the player's playable positions (primary = overall), as on the club players table
function getPositionRating(player: MFLListing['player'], position: MFLPosition): number {
  const m = player.metadata;
  const result = calculatePositionOVR({
    id: player.id,
    name: `${m.firstName} ${m.lastName}`,
    attributes: { PAC: m.pace, SHO: m.shooting, PAS: m.passing, DRI: m.dribbling, DEF: m.defense, PHY: m.physical, GK: m.goalkeeping || 0 },
    positions: m.positions,
    overall: m.overall
  }, position);
  return result.success ? result.ovr : 0;
}

const isOverallKey = (field: SortField): field is OverallKey => OVERALL_COLUMNS.some(column => column.key === field);

// Compact, and as wide as their share of the row, so that every filter fits on one line
const controlClass = 'w-full px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent';
const labelClass = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 whitespace-nowrap';
// On a narrow screen the filters wrap instead, and these keep each one usable
const fieldClass = 'flex-1 min-w-[4.25rem] lg:min-w-0';
const wideFieldClass = 'flex-[1.75] min-w-[7rem] lg:min-w-0';
const thClass = 'px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none whitespace-nowrap';
const numberCellClass = 'px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300';

function formatListedAgo(timestamp: number, now: number): string {
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}

export default function ScoutPage() {
  const [listings, setListings] = useState<MFLListing[]>([]);
  const [isLoadingListings, setIsLoadingListings] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [histories, setHistories] = useState<PlayerHistories>({});
  const [progress, setProgress] = useState<ProgressionLoadProgress | null>(null);
  const [loadedAt, setLoadedAt] = useState(() => Date.now());
  const [reloadKey, setReloadKey] = useState(0);

  // Editing a filter only changes the draft; nothing is asked of MFL until it is searched for
  const [draftFilters, setDraftFilters] = useState<ScoutFilters>(DEFAULT_SCOUT_FILTERS);
  const [filters, setFilters] = useState<ScoutFilters>(DEFAULT_SCOUT_FILTERS);

  const [sortField, setSortField] = useState<SortField>('overall30');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Load the listings, then the progression history of every listed player
  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      setIsLoadingListings(true);
      setError(null);
      setProgress(null);
      try {
        const res = await fetch(`/api/listings?${buildListingsQuery(filters)}`, { signal: controller.signal });
        const body = await res.json().catch(() => null);
        if (!res.ok || !body?.success) {
          throw new Error(
            res.status === 429
              ? `MFL is limiting requests right now — try again in about ${Math.max(1, Math.ceil((body?.retryAfterSeconds ?? 600) / 60))} minutes.`
              : body?.error || `Failed to load listings (${res.status})`
          );
        }

        const loaded: MFLListing[] = body.data;
        setListings(loaded);
        setLoadedAt(Date.now());
        setIsLoadingListings(false);

        await loadProgressionHistories(
          loaded.map(listing => listing.player.id),
          update => {
            if (controller.signal.aborted) return;
            setHistories(current => ({ ...current, ...update.histories }));
            setProgress(update);
          },
          controller.signal
        );
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error('Failed to load scouting data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load listings');
        setIsLoadingListings(false);
      }
    };
    load();

    return () => controller.abort();
  }, [filters, reloadKey]);

  const search = (next: ScoutFilters) => {
    setDraftFilters(next);
    setFilters(next);
    setReloadKey(key => key + 1); // Searching again with the same filters checks for new listings
  };

  const rows = useMemo<ScoutRow[]>(() => {
    return listings.map(listing => {
      const entries = histories[listing.player.id];

      return {
        listing,
        name: `${listing.player.metadata.firstName} ${listing.player.metadata.lastName}`,
        positionRatings: listing.player.metadata.positions.map(position => ({ position, rating: getPositionRating(listing.player, position) })),
        overallPoints: entries
          ? Object.fromEntries(
              OVERALL_COLUMNS.map(column => [column.key, getOverallPointsSince(listing.player, entries, getWindowStart(column.days, loadedAt))])
            ) as Record<OverallKey, number>
          : null
      };
    });
  }, [listings, histories, loadedAt]);

  const sortedRows = useMemo(() => {
    const getValue = (row: ScoutRow): string | number => {
      const { metadata } = row.listing.player;
      switch (sortField) {
        case 'name': return row.name;
        case 'age': return metadata.age;
        case 'position': return metadata.positions[0] ?? '';
        case 'rating': return metadata.overall;
        case 'price': return row.listing.price;
        case 'listed': return row.listing.createdDateTime;
        // Players still loading sort below those with no gains
        default: return isOverallKey(sortField) ? row.overallPoints?.[sortField] ?? -1 : metadata[sortField];
      }
    };
    const direction = sortDirection === 'asc' ? 1 : -1;

    return [...rows].sort((a, b) => {
      const aValue = getValue(a);
      const bValue = getValue(b);
      const result = typeof aValue === 'string' && typeof bValue === 'string'
        ? aValue.localeCompare(bValue)
        : Number(aValue) - Number(bValue);
      // Ties keep the marketplace order: newest listing first
      return result * direction || b.listing.createdDateTime - a.listing.createdDateTime;
    });
  }, [rows, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(direction => (direction === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      // Text columns read best A-Z; numbers are most useful biggest first
      setSortDirection(field === 'name' || field === 'position' ? 'asc' : 'desc');
    }
  };

  const sortArrow = (field: SortField) => (sortField === field ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : '');
  const isRefreshing = !!progress && !progress.done;
  const isLoadingHistories = !isLoadingListings && !error && listings.length > 0 && !progress;
  const isBusy = isLoadingListings || isRefreshing;
  const isFiltered = !filtersEqual(draftFilters, DEFAULT_SCOUT_FILTERS) || !filtersEqual(filters, DEFAULT_SCOUT_FILTERS);
  const pending = <span className="text-gray-400 dark:text-gray-500">…</span>;
  // A rating on a badge of its MFL tier colour, as on the agency and club tables. The badge brings its
  // own background, so it reads on both themes - the tier colours alone don't, as text.
  const renderRating = (value: number, compact = false) => {
    if (!value) return <span className="text-gray-400 dark:text-gray-500">–</span>; // An outfield player's goalkeeping, say
    const tierColors = getTierColor(value);
    const size = compact ? 'min-w-[1.75rem] rounded px-1 text-xs leading-5' : 'w-10 rounded-lg shadow-sm px-2 py-0.5';
    return <span className={`inline-block text-center font-bold tabular-nums ${size} ${tierColors.text} ${tierColors.bg} ${tierColors.border}`}>{value}</span>;
  };

  return (
    <div className="min-h-screen px-4 lg:px-0">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Scout</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          The newest marketplace listings that match your filters, with how much each player’s overall has risen over the last 7, 30 and 90 days
        </p>
      </div>

      {/* Filters - applied on Search, so MFL is only asked once per change of mind */}
      <form
        className="flex flex-wrap lg:flex-nowrap items-end gap-2 mb-6"
        aria-label="Listing filters"
        onSubmit={e => {
          e.preventDefault();
          search(draftFilters);
        }}
      >
        <div className={wideFieldClass}>
          <label htmlFor="scout-position" className={labelClass}>Position</label>
          <select
            id="scout-position"
            title="Players who can play this position, not only as their primary one"
            value={draftFilters.position}
            onChange={e => setDraftFilters(current => ({ ...current, position: e.target.value }))}
            className={controlClass}
          >
            <option value={ALL_POSITIONS}>All Positions</option>
            <option disabled>────────────</option>
            {POSITIONS.map(position => <option key={position.value} value={position.value}>{position.label}</option>)}
            <option disabled>────────────</option>
            {Object.entries(POSITION_GROUPS).map(([value, group]) => <option key={value} value={value}>{group.label}</option>)}
          </select>
        </div>
        {NUMBER_SELECTS.map(({ filter, label, title, options }) => (
          <div key={filter} className={fieldClass}>
            <label htmlFor={`scout-${filter}`} className={labelClass}>{label}</label>
            <select
              id={`scout-${filter}`}
              title={title}
              value={draftFilters[filter] ?? ''}
              onChange={e => setDraftFilters(current => ({ ...current, [filter]: e.target.value === '' ? null : Number(e.target.value) }))}
              className={controlClass}
            >
              <option value="">Any</option>
              {options.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
        ))}
        <div className={wideFieldClass}>
          <label htmlFor="scout-players" className={labelClass}>Players</label>
          <select
            id="scout-players"
            value={draftFilters.isFreeAgent ? 'freeAgents' : 'all'}
            onChange={e => setDraftFilters(current => ({ ...current, isFreeAgent: e.target.value === 'freeAgents' }))}
            className={controlClass}
          >
            <option value="freeAgents">Free agents</option>
            <option value="all">All players</option>
          </select>
        </div>
        <div className={wideFieldClass}>
          <label htmlFor="scout-limit" className={labelClass}>Listings</label>
          <select
            id="scout-limit"
            value={draftFilters.limit}
            onChange={e => setDraftFilters(current => ({ ...current, limit: Number(e.target.value) }))}
            className={controlClass}
          >
            {LISTING_LIMITS.map(limit => <option key={limit} value={limit}>Newest {limit}</option>)}
          </select>
        </div>
        <button
          type="submit"
          disabled={isBusy}
          className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm whitespace-nowrap"
        >
          Search
        </button>
        {isFiltered && (
          <button type="button" onClick={() => search(DEFAULT_SCOUT_FILTERS)} disabled={isBusy} className="px-1 py-2 text-sm text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50">
            Reset
          </button>
        )}
      </form>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6 flex items-center justify-between gap-4">
          <p className="text-red-800 dark:text-red-200">{error}</p>
          <button
            onClick={() => setReloadKey(key => key + 1)}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm whitespace-nowrap"
          >
            Try again
          </button>
        </div>
      )}

      {isLoadingListings && listings.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-400">Loading listings...</span>
        </div>
      )}

      {!isLoadingListings && !error && listings.length === 0 && (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
          <p className="text-gray-600 dark:text-gray-400">No players are listed that match these filters right now.</p>
        </div>
      )}

      {listings.length > 0 && (
        // The last results stay in place, dimmed, while a new search loads
        <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden ${isLoadingListings ? 'opacity-50' : ''}`}>
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Listings
              <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                {listings.length} · rise in exact overall over each period
              </span>
            </h2>

            {(isLoadingHistories || isRefreshing) && (
              <div className="mt-3" role="status">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  {progress
                    ? `Loading progression history from MFL… ${progress.refreshed} / ${progress.toRefresh} players`
                    : 'Checking progression history…'}
                </p>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                  <div
                    className="bg-blue-600 h-1 rounded-full transition-all duration-300"
                    style={{ width: progress ? `${(progress.refreshed / progress.toRefresh) * 100}%` : '0%' }}
                  />
                </div>
              </div>
            )}

            {progress?.rateLimitedSeconds !== undefined && (
              <p className="mt-3 text-xs text-amber-700 dark:text-amber-400" role="status">
                MFL is limiting requests right now, so {progress.toRefresh > 0
                  ? `${progress.toRefresh - progress.refreshed} of ${progress.toRefresh} players are still to be loaded`
                  : 'progression could not be checked'}. Everything loaded so far is saved — search again in about{' '}
                {Math.max(1, Math.ceil(progress.rateLimitedSeconds / 60))} minute{Math.ceil(progress.rateLimitedSeconds / 60) > 1 ? 's' : ''} to continue.
              </p>
            )}

            {progress && !isRefreshing && progress.failedIds.length > 0 && (
              <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">
                Couldn’t load {progress.failedIds.length} player{progress.failedIds.length !== 1 ? 's' : ''} from MFL, so their progression may be missing.{' '}
                <button onClick={() => setReloadKey(key => key + 1)} className="underline">Try again</button>
              </p>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className={`${thClass} text-left`} onClick={() => handleSort('name')}>Player{sortArrow('name')}</th>
                  <th className={`${thClass} text-right`} onClick={() => handleSort('age')}>Age{sortArrow('age')}</th>
                  <th className={`${thClass} text-left`} onClick={() => handleSort('position')} title="Each position the player can play, with their rating there">Pos{sortArrow('position')}</th>
                  <th className={`${thClass} text-right`} onClick={() => handleSort('rating')}>Rating{sortArrow('rating')}</th>
                  <th className={`${thClass} text-right`} onClick={() => handleSort('price')}>Price{sortArrow('price')}</th>
                  <th className={`${thClass} text-right`} onClick={() => handleSort('listed')}>Listed{sortArrow('listed')}</th>
                  {OVERALL_COLUMNS.map(column => (
                    <th
                      key={column.key}
                      className={`${thClass} text-right`}
                      onClick={() => handleSort(column.key)}
                      title={`Rise in exact overall (the 2-decimal overall on the player page) over the last ${column.days} days`}
                    >
                      {column.label}{sortArrow(column.key)}
                    </th>
                  ))}
                  {ATTRIBUTE_STATS.map(stat => (
                    <th key={stat} className={`${thClass} text-center`} onClick={() => handleSort(stat)} title={STAT_NAMES[stat]}>
                      {STAT_LABELS[stat]}{sortArrow(stat)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {sortedRows.map(({ listing, name, positionRatings, overallPoints }) => (
                  <tr key={listing.listingResourceId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-3 py-2 whitespace-nowrap">
                      <a href={`/players/${listing.player.id}`} className="text-blue-600 dark:text-blue-400 hover:underline">{name}</a>
                    </td>
                    <td className={numberCellClass}>{listing.player.metadata.age}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-700 dark:text-gray-300">
                      {positionRatings.map(({ position, rating }) => (
                        <React.Fragment key={position}>
                          <span className="mr-1.5">
                            {position} {renderRating(rating, true)}
                          </span>{' '}
                        </React.Fragment>
                      ))}
                    </td>
                    <td className="px-3 py-2 text-right">{renderRating(listing.player.metadata.overall)}</td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                      <a
                        href={`https://app.playmfl.com/players/${listing.player.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open on MFL"
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        ${listing.price.toLocaleString()}
                      </a>
                    </td>
                    <td className={`${numberCellClass} whitespace-nowrap`} title={new Date(listing.createdDateTime).toLocaleString()}>
                      {formatListedAgo(listing.createdDateTime, loadedAt)}
                    </td>
                    {OVERALL_COLUMNS.map(column => (
                      <td
                        key={column.key}
                        className={`px-3 py-2 text-right tabular-nums font-semibold text-gray-900 dark:text-white ${sortField === column.key ? 'bg-gray-50 dark:bg-gray-700/40' : ''}`}
                      >
                        {overallPoints ? (overallPoints[column.key] > 0 ? `+${overallPoints[column.key].toFixed(2)}` : '–') : pending}
                      </td>
                    ))}
                    {ATTRIBUTE_STATS.map(stat => (
                      <td key={stat} className="px-3 py-2 text-center">{renderRating(listing.player.metadata[stat])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
