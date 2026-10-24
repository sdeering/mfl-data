'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { loadProgressionHistories, type PlayerHistories, type ProgressionLoadProgress } from '../services/playerProgressionService';
import type { MFLListing, MFLPosition } from '../types/mflApi';
import { ALL_POSITIONS, POSITIONS, POSITION_GROUPS } from '../utils/positionOptions';
import { ATTRIBUTE_STATS, STAT_LABELS, STAT_NAMES, getWindowStart, type AttributeStat } from '../utils/progressionCounts';
import {
  DEFAULT_SCOUT_FILTERS,
  FILTER_STATS,
  LISTING_LIMITS,
  NUMBER_FILTER_OPTIONS,
  buildListingsQuery,
  filtersEqual,
  deleteWalletPreset,
  fetchPlayed,
  fetchWalletPresets,
  loadScoutPresets,
  loadScoutSettings,
  saveScoutPresets,
  saveWalletPreset,
  saveScoutSettings,
  type NumberFilter,
  type ScoutPreset,
  type ScoutFilters
} from '../utils/scoutFilters';
import { getOverallPointsSince } from '../utils/preciseOverallGain';
import { calculatePositionOVR } from '../utils/ruleBasedPositionCalculator';
import { getOffPrimaryGain, rankPositionRatings, type RankedPositionRating } from '../utils/positionRatingOrder';
import {
  InitialsAvatar,
  PageHeader,
  Panel,
  PositionChip,
  Select,
  TierBadge,
  btnDanger,
  btnPill,
  btnPrimary,
  btnSecondary,
  labelClass,
  rowClass,
  sortableThClass,
  tableClass,
  tdClass,
  theadRowClass
} from './ui';

// Rise in precise (2-decimal) overall over each period
const OVERALL_COLUMNS = [
  { key: 'overall7', days: 7, label: '+OVR 7D' },
  { key: 'overall30', days: 30, label: '+OVR 30D' },
  { key: 'overall90', days: 90, label: '+OVR 90D' }
] as const;
type OverallKey = typeof OVERALL_COLUMNS[number]['key'];

const NUMBER_SELECTS: Array<{ filter: NumberFilter; label: string; title: string }> = [
  { filter: 'ageMax', label: 'Max age', title: 'Oldest age to include' },
  { filter: 'overallMin', label: 'Min OVR', title: 'Lowest overall to include' },
  { filter: 'overallMax', label: 'Max OVR', title: 'Highest overall to include' },
  { filter: 'priceMax', label: 'Max price', title: 'Highest listing price to include, in dollars' },
  ...FILTER_STATS.map(stat => ({ filter: `${stat}Min` as const, label: `Min ${STAT_LABELS[stat]}`, title: `Lowest ${STAT_NAMES[stat].toLowerCase()} to include` }))
];

type SortField = 'name' | 'age' | 'position' | 'rating' | 'price' | 'listed' | OverallKey | AttributeStat;
const SORT_FIELDS: SortField[] = ['name', 'age', 'position', 'rating', 'price', 'listed', ...OVERALL_COLUMNS.map(column => column.key), ...ATTRIBUTE_STATS];
const isSortField = (field: string): field is SortField => (SORT_FIELDS as string[]).includes(field);

interface ScoutRow {
  listing: MFLListing;
  name: string;
  positionRatings: RankedPositionRating<MFLPosition>[]; // Every position the player can play, best rating first
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

const checkboxBoxClass = 'flex items-center justify-center h-10';
const checkboxClass = 'h-[18px] w-[18px] cursor-pointer accent-accent';

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
  // Players whose progression has been loaded since the listings were, so narrowing the table and
  // widening it again doesn't ask for them twice
  const loadedHistoryIds = useRef<Set<number>>(new Set());
  const [isCheckingHistories, setIsCheckingHistories] = useState(false);

  // Editing a filter only changes the draft; nothing is asked of MFL until it is searched for
  const [draftFilters, setDraftFilters] = useState<ScoutFilters>(DEFAULT_SCOUT_FILTERS);
  // null until the settings saved in this browser have been read, so the first search is the right one
  const [filters, setFilters] = useState<ScoutFilters | null>(null);

  const [sortField, setSortField] = useState<SortField>('overall30');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Open on the filters and sort last used in this browser. They are read once mounted, as the
  // server can't see them and rendering them straight away would not match what it sent.
  useEffect(() => {
    const saved = loadScoutSettings();
    if (saved?.sort && isSortField(saved.sort.field)) {
      setSortField(saved.sort.field);
      setSortDirection(saved.sort.direction);
    }
    setDraftFilters(saved?.filters ?? DEFAULT_SCOUT_FILTERS);
    setFilters(saved?.filters ?? DEFAULT_SCOUT_FILTERS);
  }, []);

  // Filter and sort combinations saved by name. With a wallet connected they are kept on the server, so
  // they follow the user between devices; otherwise they stay in this browser. Read once mounted, like
  // the settings above.
  const { account } = useWallet();
  const [presets, setPresets] = useState<ScoutPreset[]>([]);
  const [presetId, setPresetId] = useState('');
  const [presetError, setPresetError] = useState<string | null>(null);

  useEffect(() => {
    const local = loadScoutPresets();
    setPresetId('');
    if (!account) {
      setPresets(local);
      return;
    }

    let cancelled = false;
    (async () => {
      const remote = await fetchWalletPresets(account);
      if (cancelled) return;
      if (!remote) {
        setPresets([]);
        setPresetError('Could not load your saved presets');
        return;
      }
      setPresetError(null);
      // Presets made in this browser before a wallet was connected move to the wallet
      const names = new Set(remote.map(p => p.name.toLowerCase()));
      const moved = (await Promise.all(local.filter(p => !names.has(p.name.toLowerCase())).map(p => saveWalletPreset(account, p))))
        .filter((p): p is ScoutPreset => p !== null);
      if (cancelled) return;
      if (moved.length === local.length) saveScoutPresets([]);
      setPresets([...remote, ...moved]);
    })();
    return () => { cancelled = true; };
  }, [account]);

  const updatePresets = (next: ScoutPreset[]) => {
    setPresets(next);
    if (!account) saveScoutPresets(next);
  };

  // Remember every change as it is made - there is nothing to press to save
  const hasReadSettings = filters !== null;
  useEffect(() => {
    if (!hasReadSettings) return; // Saving any sooner would replace what was saved with the defaults
    saveScoutSettings({ filters: draftFilters, sort: { field: sortField, direction: sortDirection } });
  }, [hasReadSettings, draftFilters, sortField, sortDirection]);

  // Load the listings. Progression is loaded below, only for the players on show.
  useEffect(() => {
    if (!filters) return;
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
        loadedHistoryIds.current = new Set(); // A new search checks every player's progression afresh
        setListings(loaded);
        setLoadedAt(Date.now());
        setIsLoadingListings(false);
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
    // Someone may have played since; a player who has played stays that way
    setPlayed(current => Object.fromEntries(Object.entries(current).filter(([, hasPlayed]) => hasPlayed)));
  };

  const applyPreset = (id: string) => {
    setPresetId(id);
    const preset = presets.find(p => p.id === id);
    if (!preset) return;
    if (isSortField(preset.sort.field)) {
      setSortField(preset.sort.field);
      setSortDirection(preset.sort.direction);
    }
    search(preset.filters);
  };

  const savePreset = async () => {
    const current = presets.find(p => p.id === presetId);
    const name = window.prompt('Name this preset', current?.name ?? '')?.trim();
    if (!name) return;
    // Reusing a name updates that preset instead of making a duplicate
    const existing = presets.find(p => p.name.toLowerCase() === name.toLowerCase());
    let preset: ScoutPreset = {
      id: existing?.id ?? `${Date.now()}`,
      name: existing?.name ?? name,
      filters: draftFilters,
      sort: { field: sortField, direction: sortDirection }
    };
    if (account) {
      const stored = await saveWalletPreset(account, preset);
      if (!stored) {
        setPresetError('Could not save the preset');
        return;
      }
      preset = stored;
    }
    setPresetError(null);
    updatePresets(existing ? presets.map(p => (p.id === preset.id ? preset : p)) : [...presets, preset]);
    setPresetId(preset.id);
  };

  const deletePreset = async () => {
    const preset = presets.find(p => p.id === presetId);
    if (!preset || !window.confirm(`Delete the preset "${preset.name}"?`)) return;
    if (account && !(await deleteWalletPreset(account, preset.id))) {
      setPresetError('Could not delete the preset');
      return;
    }
    setPresetError(null);
    updatePresets(presets.filter(p => p.id !== presetId));
    setPresetId('');
  };

  const rows = useMemo<ScoutRow[]>(() => {
    return listings.map(listing => {
      const entries = histories[listing.player.id];

      return {
        listing,
        name: `${listing.player.metadata.firstName} ${listing.player.metadata.lastName}`,
        positionRatings: rankPositionRatings(listing.player.metadata.positions, position => getPositionRating(listing.player, position)),
        overallPoints: entries
          ? Object.fromEntries(
              OVERALL_COLUMNS.map(column => [column.key, getOverallPointsSince(listing.player, entries, getWindowStart(column.days, loadedAt))])
            ) as Record<OverallKey, number>
          : null
      };
    });
  }, [listings, histories, loadedAt]);

  // Applied as it is picked: it narrows the listings already loaded, so there is nothing to ask MFL
  const { betterOffPrimary, newlyMinted } = draftFilters;

  // Whether each listed player has played a game, checked only while "Newly minted" is ticked. Anyone
  // not checked yet stays hidden. Each check is a paced MFL request, so it is made once per player.
  const [played, setPlayed] = useState<Record<number, boolean>>({});
  const [playedNotice, setPlayedNotice] = useState<string | null>(null);
  const [isCheckingPlayed, setIsCheckingPlayed] = useState(false);
  const playedRef = useRef(played); // Read by the check below without restarting it after every batch
  playedRef.current = played;
  const listedIds = useMemo(() => listings.map(listing => listing.player.id), [listings]);
  useEffect(() => {
    if (!newlyMinted || isLoadingListings) return;
    const unchecked = listedIds.filter(id => playedRef.current[id] === undefined);
    if (unchecked.length === 0) return;

    const controller = new AbortController();
    (async () => {
      setIsCheckingPlayed(true);
      setPlayedNotice(null);
      try {
        for (let i = 0; i < unchecked.length; i += 5) {
          const result = await fetchPlayed(unchecked.slice(i, i + 5), controller.signal);
          if (controller.signal.aborted) return;
          setPlayed(current => ({ ...current, ...result.played }));
          if (result.rateLimitedSeconds !== undefined) {
            const minutes = Math.max(1, Math.ceil(result.rateLimitedSeconds / 60));
            setPlayedNotice(`MFL is limiting requests right now, so some players could not be checked. Search again in about ${minutes} minute${minutes > 1 ? 's' : ''}.`);
            return;
          }
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error('Failed to check games played:', err);
        setPlayedNotice('Could not check which players have played a game');
      } finally {
        if (!controller.signal.aborted) setIsCheckingPlayed(false);
      }
    })();
    return () => {
      controller.abort();
      setIsCheckingPlayed(false);
    };
  }, [newlyMinted, isLoadingListings, listedIds, reloadKey]);

  const shownRows = useMemo(
    () => rows.filter(row =>
      (!betterOffPrimary || getOffPrimaryGain(row.positionRatings) > 0)
      && (!newlyMinted || played[row.listing.player.id] === false)
    ),
    [rows, betterOffPrimary, newlyMinted, played]
  );

  // Load the progression of the players on show (each one costs a paced MFL request if it is out of
  // date), and of any more that come into view when a filter is changed
  const shownIds = useMemo(() => shownRows.map(row => row.listing.player.id).join(','), [shownRows]);
  useEffect(() => {
    if (isLoadingListings) return;
    const missing = shownIds.split(',').filter(Boolean).map(Number).filter(id => !loadedHistoryIds.current.has(id));
    if (missing.length === 0) return;

    const controller = new AbortController();
    setProgress(null);
    setIsCheckingHistories(true);
    loadProgressionHistories(
      missing,
      update => {
        if (controller.signal.aborted) return;
        setHistories(current => ({ ...current, ...update.histories }));
        setProgress(update);
        setIsCheckingHistories(false);
        if (update.done) missing.forEach(id => loadedHistoryIds.current.add(id));
      },
      controller.signal
    ).catch(err => {
      if (controller.signal.aborted) return;
      console.error('Failed to load progression:', err);
      setError(err instanceof Error ? err.message : 'Failed to load progression');
      setIsCheckingHistories(false);
    });

    return () => {
      controller.abort();
      setIsCheckingHistories(false);
    };
  }, [shownIds, loadedAt, isLoadingListings]);

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

    return [...shownRows].sort((a, b) => {
      const aValue = getValue(a);
      const bValue = getValue(b);
      const result = typeof aValue === 'string' && typeof bValue === 'string'
        ? aValue.localeCompare(bValue)
        : Number(aValue) - Number(bValue);
      // Ties keep the marketplace order: newest listing first
      return result * direction || b.listing.createdDateTime - a.listing.createdDateTime;
    });
  }, [shownRows, sortField, sortDirection]);

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
  const headerClass = (field: SortField, align = 'text-left') => `${sortableThClass} ${align} ${sortField === field ? 'text-accent-ink!' : ''}`;
  const isRefreshing = !!progress && !progress.done;
  const isLoadingHistories = isCheckingHistories && !progress;
  const isBusy = isLoadingListings || isRefreshing;
  const isFiltered = !filtersEqual(draftFilters, DEFAULT_SCOUT_FILTERS) || (filters !== null && !filtersEqual(filters, DEFAULT_SCOUT_FILTERS));
  const pending = <span className="text-faint">…</span>;

  return (
    <div className="flex flex-col gap-[22px]">
      <PageHeader
        title="Player Scouting"
        subtitle="The newest marketplace listings that match your filters, with how much each player’s overall has risen over the last 7, 30 and 90 days"
      />

      <Panel className="overflow-hidden">
        {/* Presets - saved filters and sort order, applied as soon as one is picked */}
        <div className="flex flex-wrap items-center gap-2 px-[18px] pt-4">
          <label htmlFor="scout-preset" className="text-xs font-semibold text-muted">Preset</label>
          <Select
            id="scout-preset"
            value={presetId}
            onChange={e => applyPreset(e.target.value)}
            disabled={presets.length === 0}
            className="min-w-[10rem] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <option value="">{presets.length === 0 ? 'None saved yet' : 'Choose a preset…'}</option>
            {presets.map(preset => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
          </Select>
          <button type="button" onClick={savePreset} title="Save the current filters and sort order under a name" className={btnPill}>
            Save current
          </button>
          {presetId && (
            <button type="button" onClick={deletePreset} className={btnDanger}>
              Delete
            </button>
          )}
          <span className="text-xs font-medium text-muted-3">
            {account ? 'Saved to your wallet' : 'Saved in this browser — connect your wallet to keep them across devices'}
          </span>
          {presetError && <span className="text-xs font-semibold text-danger-ink" role="alert">{presetError}</span>}
        </div>

        {/* Filters - applied on Search, so MFL is only asked once per change of mind */}
        <form
          className="flex flex-wrap items-end gap-3 px-[18px] py-4"
          aria-label="Listing filters"
          onSubmit={e => {
            e.preventDefault();
            search(draftFilters);
          }}
        >
          <label className={`${labelClass} whitespace-nowrap`}>
            Position
            <Select
              title="Players who can play this position, not only as their primary one"
              value={draftFilters.position}
              onChange={e => setDraftFilters(current => ({ ...current, position: e.target.value }))}
            >
              <option value={ALL_POSITIONS}>All Positions</option>
              <option disabled>────────────</option>
              {POSITIONS.map(position => <option key={position.value} value={position.value}>{position.label}</option>)}
              <option disabled>────────────</option>
              {Object.entries(POSITION_GROUPS).map(([value, group]) => <option key={value} value={value}>{group.label}</option>)}
            </Select>
          </label>
          {NUMBER_SELECTS.map(({ filter, label, title }) => (
            <label key={filter} className={`${labelClass} whitespace-nowrap`}>
              {label}
              <Select
                title={title}
                value={draftFilters[filter] ?? ''}
                onChange={e => setDraftFilters(current => ({ ...current, [filter]: e.target.value === '' ? null : Number(e.target.value) }))}
              >
                <option value="">Any</option>
                {NUMBER_FILTER_OPTIONS[filter].map(option => <option key={option} value={option}>{filter === 'priceMax' ? `$${option}` : option}</option>)}
              </Select>
            </label>
          ))}
          {/* The tick boxes sit as tall as the dropdowns, so the row stays level */}
          <label className={`${labelClass} whitespace-nowrap`}>
            Free agent
            <span className={checkboxBoxClass}>
              <input
                type="checkbox"
                title="Only players without a club. Untick for every player, under contract or not."
                checked={draftFilters.isFreeAgent}
                onChange={e => setDraftFilters(current => ({ ...current, isFreeAgent: e.target.checked }))}
                className={checkboxClass}
              />
            </span>
          </label>
          <label className={`${labelClass} whitespace-nowrap`}>
            Off Pri
            <span className={checkboxBoxClass}>
              <input
                type="checkbox"
                title="Only players who rate higher at another position than their primary one. Narrows the loaded listings straight away."
                checked={betterOffPrimary}
                onChange={e => setDraftFilters(current => ({ ...current, betterOffPrimary: e.target.checked }))}
                className={checkboxClass}
              />
            </span>
          </label>
          <label className={`${labelClass} whitespace-nowrap`}>
            New mint
            <span className={checkboxBoxClass}>
              <input
                type="checkbox"
                title="Only players who have yet to play a game. Each listed player is checked with MFL, which takes a few seconds."
                checked={newlyMinted}
                onChange={e => setDraftFilters(current => ({ ...current, newlyMinted: e.target.checked }))}
                className={checkboxClass}
              />
            </span>
          </label>
          <label className={`${labelClass} whitespace-nowrap`}>
            Listings
            <Select
              value={draftFilters.limit}
              onChange={e => setDraftFilters(current => ({ ...current, limit: Number(e.target.value) }))}
            >
              {LISTING_LIMITS.map(limit => <option key={limit} value={limit}>Newest {limit}</option>)}
            </Select>
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={isBusy} className={btnPrimary}>
              Search
            </button>
            {isFiltered && (
              <button type="button" onClick={() => search(DEFAULT_SCOUT_FILTERS)} disabled={isBusy} className={btnSecondary}>
                Reset
              </button>
            )}
          </div>
        </form>

        {error && (
          <div className="mx-[18px] mb-4 flex items-center justify-between gap-4 rounded-2xl border border-red-500/45 bg-red-500/12 px-4 py-3">
            <p className="m-0 text-sm font-semibold text-danger-ink">{error}</p>
            <button onClick={() => setReloadKey(key => key + 1)} className={btnDanger}>
              Try again
            </button>
          </div>
        )}

        {isLoadingListings && listings.length === 0 && (
          <div className="flex items-center justify-center gap-3 py-16 border-t border-line text-sm font-medium text-muted">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            Loading listings...
          </div>
        )}

        {!isLoadingListings && !error && listings.length === 0 && (
          <p className="m-0 py-16 border-t border-line text-center text-sm font-medium text-muted">
            No players are listed that match these filters right now.
          </p>
        )}

        {listings.length > 0 && (
          // The last results stay in place, dimmed, while a new search loads
          <div className={isLoadingListings ? 'opacity-50' : undefined}>
            <div className="px-[18px] py-4 border-t border-line">
              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <h2 className="m-0 font-display text-[22px] font-bold text-fg">Listings</h2>
                <span className="text-[13px] font-medium text-muted">
                  {shownRows.length === listings.length ? listings.length : `${shownRows.length} of ${listings.length}`} · rise in exact overall over each period
                </span>
              </div>

              {isCheckingPlayed && (
                <p className="mt-3 mb-0 text-xs font-medium text-muted" role="status">
                  Checking which players have yet to play a game… {listedIds.filter(id => played[id] !== undefined).length} / {listedIds.length}
                </p>
              )}
              {playedNotice && <p className="mt-3 mb-0 text-xs font-medium text-warn-ink" role="status">{playedNotice}</p>}

              {(isLoadingHistories || isRefreshing) && (
                <div className="mt-3" role="status">
                  <p className="mt-0 mb-1.5 text-xs font-medium text-muted">
                    {progress
                      ? `Loading progression history from MFL… ${progress.refreshed} / ${progress.toRefresh} players`
                      : 'Checking progression history…'}
                  </p>
                  <div className="w-full h-1 rounded-full bg-line">
                    <div
                      className="h-1 rounded-full bg-accent transition-all duration-300"
                      style={{ width: progress ? `${(progress.refreshed / progress.toRefresh) * 100}%` : '0%' }}
                    />
                  </div>
                </div>
              )}

              {progress?.rateLimitedSeconds !== undefined && (
                <p className="mt-3 mb-0 text-xs font-medium text-warn-ink" role="status">
                  MFL is limiting requests right now, so {progress.toRefresh > 0
                    ? `${progress.toRefresh - progress.refreshed} of ${progress.toRefresh} players are still to be loaded`
                    : 'progression could not be checked'}. Everything loaded so far is saved — search again in about{' '}
                  {Math.max(1, Math.ceil(progress.rateLimitedSeconds / 60))} minute{Math.ceil(progress.rateLimitedSeconds / 60) > 1 ? 's' : ''} to continue.
                </p>
              )}

              {progress && !isRefreshing && progress.failedIds.length > 0 && (
                <p className="mt-3 mb-0 text-xs font-medium text-warn-ink">
                  Couldn’t load {progress.failedIds.length} player{progress.failedIds.length !== 1 ? 's' : ''} from MFL, so their progression may be missing.{' '}
                  <button onClick={() => setReloadKey(key => key + 1)} className="underline cursor-pointer">Try again</button>
                </p>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className={tableClass}>
                <thead>
                  <tr className={theadRowClass}>
                    <th className={`${headerClass('name')} pl-[18px]`} onClick={() => handleSort('name')}>Player{sortArrow('name')}</th>
                    <th className={headerClass('age')} onClick={() => handleSort('age')}>Age{sortArrow('age')}</th>
                    <th className={headerClass('position')} onClick={() => handleSort('position')} title="Each position the player can play, with their rating there">Pos{sortArrow('position')}</th>
                    <th className={headerClass('rating')} onClick={() => handleSort('rating')}>Rating{sortArrow('rating')}</th>
                    <th className={headerClass('price', 'text-right')} onClick={() => handleSort('price')}>Price{sortArrow('price')}</th>
                    <th className={headerClass('listed', 'text-right')} onClick={() => handleSort('listed')}>Listed{sortArrow('listed')}</th>
                    {OVERALL_COLUMNS.map(column => (
                      <th
                        key={column.key}
                        className={headerClass(column.key, 'text-right')}
                        onClick={() => handleSort(column.key)}
                        title={`Rise in exact overall (the 2-decimal overall on the player page) over the last ${column.days} days`}
                      >
                        {column.label}{sortArrow(column.key)}
                      </th>
                    ))}
                    {ATTRIBUTE_STATS.map(stat => (
                      <th key={stat} className={headerClass(stat, 'text-center')} onClick={() => handleSort(stat)} title={STAT_NAMES[stat]}>
                        {STAT_LABELS[stat]}{sortArrow(stat)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map(({ listing, name, positionRatings, overallPoints }) => (
                    <tr key={listing.listingResourceId} className={rowClass}>
                      <td className={`${tdClass} pl-[18px]`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <InitialsAvatar name={name} />
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <a href={`/players/${listing.player.id}`} className="text-[15px] font-bold text-fg hover:text-accent-ink transition-colors">{name}</a>
                            <span className="font-mono text-xs font-medium text-muted-3">ID {listing.player.id}</span>
                          </div>
                        </div>
                      </td>
                      <td className={`${tdClass} text-sm font-semibold text-fg-3 tabular-nums`}>{listing.player.metadata.age}</td>
                      <td className={tdClass}>
                        <div className="flex gap-[5px]">
                          {positionRatings.map(({ position, rating, isPrimary, diff }) => (
                            <React.Fragment key={position}>
                              <PositionChip
                                position={position}
                                rating={rating}
                                gain={diff}
                                title={isPrimary ? 'Primary position' : diff > 0 ? `+${diff} vs primary position` : undefined}
                              />{' '}
                            </React.Fragment>
                          ))}
                        </div>
                      </td>
                      <td className={tdClass}><TierBadge value={listing.player.metadata.overall} size="lg" /></td>
                      <td className={`${tdClass} text-right text-sm font-semibold tabular-nums`}>
                        <a
                          href={`https://app.playmfl.com/players/${listing.player.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open on MFL"
                          className="text-price hover:underline underline-offset-2"
                        >
                          ${listing.price.toLocaleString()}
                        </a>
                      </td>
                      <td className={`${tdClass} text-right text-sm font-medium text-muted`} title={new Date(listing.createdDateTime).toLocaleString()}>
                        {formatListedAgo(listing.createdDateTime, loadedAt)}
                      </td>
                      {OVERALL_COLUMNS.map(column => (
                        <td
                          key={column.key}
                          className={`${tdClass} text-right text-sm font-bold tabular-nums ${sortField === column.key ? 'bg-[rgba(var(--glass-rgb),.03)]' : ''}`}
                        >
                          {overallPoints
                            ? (overallPoints[column.key] > 0
                              ? <span className="text-accent-ink">+{overallPoints[column.key].toFixed(2)}</span>
                              : <span className="text-faint">–</span>)
                            : pending}
                        </td>
                      ))}
                      {ATTRIBUTE_STATS.map(stat => (
                        <td key={stat} className={`${tdClass} text-center`}><TierBadge value={listing.player.metadata[stat]} /></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {sortedRows.length === 0 && (
              <p className="m-0 px-[18px] py-8 text-center text-sm font-medium text-muted">
                None of these listings rate higher at another position than their primary one.
              </p>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}
