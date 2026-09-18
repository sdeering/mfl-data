'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useTheme } from '../contexts/ThemeContext';
import { useRenderedSurface } from '../hooks/useRenderedSurface';
import { supabaseDataService } from '../services/clientDataService';
import { loadProgressionHistories, type PlayerHistories, type ProgressionLoadProgress } from '../services/playerProgressionService';
import type { MFLPlayer, MFLPosition } from '../types/mflApi';
import { POSITIONS, POSITION_GROUPS } from '../utils/positionOptions';
import {
  ATTRIBUTE_STATS,
  PROGRESSION_STATS,
  STAT_COLORS,
  STAT_LABELS,
  STAT_NAMES,
  attributeTotal,
  buildDailySeries,
  getProgressionEvents,
  sumEvents,
  type OverallPointsEvent,
  type ProgressionEvent,
  type ProgressionStat,
  type ProgressionTotals
} from '../utils/progressionCounts';
import {
  ALL_SQUADS,
  NO_SQUAD,
  buildSquads,
  getDefaultSquad,
  getSquadId,
  getSquadName,
  isInSquad,
  type Squad
} from '../utils/progressionSquads';
import { getOverallPointsEvents } from '../utils/preciseOverallGain';
import PlayerProgressionChart, { PlayerProgressionDayTable, type ProgressionChartMode } from './PlayerProgressionChart';

interface PlayerProgressionPageProps {
  walletAddress?: string; // View another wallet's players; defaults to the connected wallet
}

const INITIAL_ROWS = 100;
const PERIODS = [7, 14, 30, 90, 180, 365]; // Days; the chart always has one bar per day
const DEFAULT_PERIOD = 90;

const CHART_MODES: ProgressionChartMode[] = ['attributes', 'overallPoints', 'overall', ...ATTRIBUTE_STATS];

type SortField = 'name' | 'age' | 'position' | 'squad' | 'rating' | 'total' | 'overallPoints' | ProgressionStat;

interface PlayerRow {
  player: MFLPlayer;
  name: string;
  squad: string | null;
  totals: ProgressionTotals;
  total: number;
  overallPoints: number; // Rise in precise (2-decimal) overall over the period
}

const controlClass = 'px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent';
const labelClass = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1';
const thClass = 'px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none whitespace-nowrap';

export default function PlayerProgressionPage({ walletAddress }: PlayerProgressionPageProps) {
  const { account } = useWallet();
  const { theme } = useTheme();
  const wallet = walletAddress ?? account;

  const [players, setPlayers] = useState<MFLPlayer[]>([]);
  const [ownedClubIds, setOwnedClubIds] = useState<Set<string>>(new Set());
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [histories, setHistories] = useState<PlayerHistories>({});
  const [progress, setProgress] = useState<ProgressionLoadProgress | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [hasCheckedWallet, setHasCheckedWallet] = useState(false);
  // Squad filter values whose histories are fully loaded, so going back to one is instant
  const loadedSquadsRef = useRef<Set<string>>(new Set());
  const chartCardRef = useRef<HTMLDivElement>(null);

  // null until the default squad has been worked out from the wallet's players
  const [squadFilter, setSquadFilter] = useState<string | null>(null);
  const [positionFilter, setPositionFilter] = useState('all'); // A position, a position group, or 'all'
  const [maxAge, setMaxAge] = useState<number | null>(null);
  const [periodDays, setPeriodDays] = useState(DEFAULT_PERIOD);

  const [mode, setMode] = useState<ProgressionChartMode>('attributes');
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [sortField, setSortField] = useState<SortField>('total');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showAllRows, setShowAllRows] = useState(false);

  // Give the wallet a moment to reconnect before asking the visitor to connect
  useEffect(() => {
    const timer = setTimeout(() => setHasCheckedWallet(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  // Load the wallet's players and the clubs it owns. Both come from our own database.
  useEffect(() => {
    if (!wallet) return;

    let cancelled = false;
    const load = async () => {
      setIsLoadingPlayers(true);
      setError(null);
      setSquadFilter(null);
      setHistories({});
      setProgress(null);
      loadedSquadsRef.current = new Set();
      try {
        const [playerData, clubs] = await Promise.all([
          supabaseDataService.getAgencyPlayers(wallet),
          // Ownership only picks the default squad, so the page still works without it
          supabaseDataService.getClubsForWallet(wallet).catch(() => [])
        ]);
        if (cancelled) return;
        setPlayers(playerData);
        setOwnedClubIds(new Set(clubs.map(club => String(club.mfl_club_id))));
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load players:', err);
        setError(err instanceof Error ? err.message : 'Failed to load your players');
      } finally {
        if (!cancelled) setIsLoadingPlayers(false);
      }
    };
    load();

    return () => {
      cancelled = true;
    };
  }, [wallet, reloadKey]);

  const squads = useMemo(() => buildSquads(players, ownedClubIds), [players, ownedClubIds]);
  const playersWithoutSquad = useMemo(() => players.filter(player => getSquadId(player) === null).length, [players]);
  const defaultSquad = useMemo(() => getDefaultSquad(squads), [squads]);

  // Open on the default squad once the players are known
  useEffect(() => {
    if (players.length > 0) setSquadFilter(current => current ?? defaultSquad);
  }, [players, defaultSquad]);

  // Load progression histories for the selected squad only. Other squads load when they are picked,
  // which keeps MFL requests down to the players actually being looked at.
  useEffect(() => {
    if (squadFilter === null || loadedSquadsRef.current.has(squadFilter) || loadedSquadsRef.current.has(ALL_SQUADS)) {
      return;
    }

    const controller = new AbortController();
    const playerIds = players.filter(player => isInSquad(player, squadFilter)).map(player => player.id);
    setProgress(null);

    loadProgressionHistories(
      playerIds,
      update => {
        if (controller.signal.aborted) return;
        setHistories(current => ({ ...current, ...update.histories }));
        setProgress(update);
        // An interrupted load is retried the next time this squad is opened
        if (update.done && update.rateLimitedSeconds === undefined && update.failedIds.length === 0) {
          loadedSquadsRef.current.add(squadFilter);
        }
      },
      controller.signal
    ).catch(err => {
      if (controller.signal.aborted) return;
      console.error('Failed to load player progression:', err);
      setError(err instanceof Error ? err.message : 'Failed to load player progression');
    });

    return () => controller.abort();
  }, [squadFilter, players, reloadKey]);

  const eventsByPlayer = useMemo(() => {
    const events = new Map<number, ProgressionEvent[]>();
    for (const [playerId, entries] of Object.entries(histories)) {
      events.set(Number(playerId), getProgressionEvents(entries));
    }
    return events;
  }, [histories]);

  const filteredPlayers = useMemo(() => {
    const wantedPositions = POSITION_GROUPS[positionFilter]?.positions ?? [positionFilter as MFLPosition];

    return players.filter(player => {
      if (squadFilter === null || !isInSquad(player, squadFilter)) return false;
      if (positionFilter !== 'all' && !player.metadata.positions.some(position => wantedPositions.includes(position))) return false;
      return maxAge === null || player.metadata.age <= maxAge;
    });
  }, [players, squadFilter, positionFilter, maxAge]);

  // Every age from the wallet's youngest player to its oldest
  const ageOptions = useMemo(() => {
    if (players.length === 0) return [];
    const ages = players.map(player => player.metadata.age);
    const youngest = Math.min(...ages);
    return Array.from({ length: Math.max(...ages) - youngest + 1 }, (_, i) => youngest + i);
  }, [players]);

  // Rises in each player's precise overall, the 2-decimal overall shown on the player page
  const overallPointsByPlayer = useMemo(() => {
    const events = new Map<number, OverallPointsEvent[]>();
    for (const player of players) {
      const entries = histories[player.id];
      if (entries) events.set(player.id, getOverallPointsEvents(player, entries));
    }
    return events;
  }, [players, histories]);

  const days = useMemo(() => {
    const events = filteredPlayers.flatMap(player => eventsByPlayer.get(player.id) ?? []);
    const overallPointsEvents = filteredPlayers.flatMap(player => overallPointsByPlayer.get(player.id) ?? []);
    return buildDailySeries(events, periodDays, Date.now(), overallPointsEvents);
  }, [filteredPlayers, eventsByPlayer, overallPointsByPlayer, periodDays]);

  // The table counts the same days the chart shows, so the two always agree
  const windowStart = days[0].dayStart;

  const rows = useMemo<PlayerRow[]>(() => {
    return filteredPlayers.map(player => {
      const events = (eventsByPlayer.get(player.id) ?? []).filter(event => event.date >= windowStart);
      const totals = sumEvents(events);
      const overallPoints = (overallPointsByPlayer.get(player.id) ?? [])
        .filter(event => event.date >= windowStart)
        .reduce((sum, event) => sum + event.points, 0);
      return {
        player,
        name: `${player.metadata.firstName} ${player.metadata.lastName}`,
        squad: getSquadName(player),
        totals,
        total: attributeTotal(totals),
        overallPoints: Math.round(overallPoints * 100) / 100
      };
    });
  }, [filteredPlayers, eventsByPlayer, overallPointsByPlayer, windowStart]);

  const sortedRows = useMemo(() => {
    const getValue = (row: PlayerRow): string | number => {
      switch (sortField) {
        case 'name': return row.name;
        case 'age': return row.player.metadata.age;
        case 'position': return row.player.metadata.positions[0] ?? '';
        case 'squad': return row.squad ?? '';
        case 'rating': return row.player.metadata.overall;
        case 'total': return row.total;
        case 'overallPoints': return row.overallPoints;
        default: return row.totals[sortField] ?? 0;
      }
    };
    const direction = sortDirection === 'asc' ? 1 : -1;

    return [...rows].sort((a, b) => {
      const aValue = getValue(a);
      const bValue = getValue(b);
      const result = typeof aValue === 'string' && typeof bValue === 'string'
        ? aValue.localeCompare(bValue)
        : Number(aValue) - Number(bValue);
      return result * direction || a.name.localeCompare(b.name);
    });
  }, [rows, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(direction => (direction === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      // Text columns read best A-Z; numbers are most useful biggest first
      setSortDirection(field === 'name' || field === 'position' || field === 'squad' ? 'asc' : 'desc');
    }
  };

  const resetFilters = () => {
    setSquadFilter(defaultSquad);
    setPositionFilter('all');
    setMaxAge(null);
    setPeriodDays(DEFAULT_PERIOD);
  };

  const isFiltered = squadFilter !== defaultSquad || positionFilter !== 'all' || maxAge !== null || periodDays !== DEFAULT_PERIOD;
  const isRefreshing = !!progress && !progress.done;
  const isSquadLoaded = squadFilter !== null && (loadedSquadsRef.current.has(squadFilter) || loadedSquadsRef.current.has(ALL_SQUADS));
  const isLoadingHistories = !!wallet && !error && !isLoadingPlayers && players.length > 0 && !progress && !isSquadLoaded;
  // Match the chart to what is actually on screen; until that is measured, go by the theme setting
  const chartSurface = useRenderedSurface(chartCardRef, players.length > 0);
  const isDark = chartSurface?.isDark ?? theme === 'dark';
  const surfaceColor = chartSurface?.color ?? (isDark ? '#1f2937' : '#ffffff');

  const attributeProgressions = rows.reduce((sum, row) => sum + row.total, 0);
  const overallProgressions = rows.reduce((sum, row) => sum + (row.totals.overall ?? 0), 0);
  const playersProgressed = rows.filter(row => row.total > 0 || (row.totals.overall ?? 0) > 0).length;
  const modeName = mode === 'attributes' ? 'All stats' : STAT_NAMES[mode];
  const visibleRows = showAllRows ? sortedRows : sortedRows.slice(0, INITIAL_ROWS);

  const sortArrow = (field: SortField) => (sortField === field ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : '');
  const renderSquadOption = (squad: Squad) => (
    <option key={squad.id} value={squad.id}>
      {squad.name} ({squad.playerCount}, avg age {squad.averageAge.toFixed(1)})
    </option>
  );

  if (!wallet) {
    return (
      <div className="min-h-screen px-4 lg:px-0">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Player Progression</h1>
        {hasCheckedWallet && (
          <p className="text-gray-600 dark:text-gray-400 mt-2">Connect your wallet to see how your players are progressing.</p>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 lg:px-0">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Player Progression</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Stat points gained by your players over the last {periodDays} days, day by day</p>
      </div>

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

      {isLoadingPlayers && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-400">Loading your players...</span>
        </div>
      )}

      {!isLoadingPlayers && !error && players.length === 0 && (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
          <p className="text-gray-600 dark:text-gray-400">No players found for this wallet.</p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">If you own players, use “Sync Agency Data” in the wallet menu first.</p>
        </div>
      )}

      {players.length > 0 && (
        <>
          {/* Filters - one row, scoping everything below */}
          <div className="flex flex-wrap items-end gap-3 mb-6">
            <div>
              <label htmlFor="progression-period" className={labelClass}>Period</label>
              <select id="progression-period" value={periodDays} onChange={e => setPeriodDays(Number(e.target.value))} className={controlClass}>
                {PERIODS.map(period => <option key={period} value={period}>Last {period} days</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="progression-squad" className={labelClass}>Squad</label>
              <select id="progression-squad" value={squadFilter ?? ALL_SQUADS} onChange={e => setSquadFilter(e.target.value)} className={`${controlClass} max-w-full`}>
                {squads.some(squad => squad.isOwned) && (
                  <optgroup label="Your clubs">
                    {squads.filter(squad => squad.isOwned).map(renderSquadOption)}
                  </optgroup>
                )}
                {squads.some(squad => !squad.isOwned) && (
                  <optgroup label={squads.some(squad => squad.isOwned) ? 'Other clubs' : 'Clubs'}>
                    {squads.filter(squad => !squad.isOwned).map(renderSquadOption)}
                  </optgroup>
                )}
                {playersWithoutSquad > 0 && <option value={NO_SQUAD}>No squad ({playersWithoutSquad})</option>}
                <option value={ALL_SQUADS}>All squads ({players.length})</option>
              </select>
            </div>
            <div>
              <label htmlFor="progression-position" className={labelClass}>Position</label>
              <select id="progression-position" value={positionFilter} onChange={e => setPositionFilter(e.target.value)} className={controlClass}>
                <option value="all">All Positions</option>
                <option disabled>────────────</option>
                {POSITIONS.map(position => <option key={position.value} value={position.value}>{position.label}</option>)}
                <option disabled>────────────</option>
                {Object.entries(POSITION_GROUPS).map(([value, group]) => <option key={value} value={value}>{group.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="progression-max-age" className={labelClass}>Max age</label>
              <select
                id="progression-max-age"
                value={maxAge ?? ''}
                onChange={e => setMaxAge(e.target.value === '' ? null : Number(e.target.value))}
                className={controlClass}
              >
                <option value="">Any age</option>
                {ageOptions.map(age => <option key={age} value={age}>{age}</option>)}
              </select>
            </div>
            {isFiltered && (
              <button onClick={resetFilters} className="px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:underline">
                Reset
              </button>
            )}
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Players', value: rows.length, note: rows.length !== players.length ? `of ${players.length}` : null },
              { label: 'Players who progressed', value: playersProgressed, note: null },
              { label: 'Stat progressions', value: attributeProgressions, note: 'excludes overall' },
              { label: 'Overall progressions', value: overallProgressions, note: null }
            ].map(tile => (
              <div key={tile.label} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{tile.label}</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white mt-1">
                  {tile.value.toLocaleString()}
                  {tile.note && <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">{tile.note}</span>}
                </p>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div ref={chartCardRef} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 lg:p-4 mb-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Progressions per day
                <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">{modeName}</span>
              </h2>
              <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden text-sm">
                {(['chart', 'table'] as const).map(option => (
                  <button
                    key={option}
                    onClick={() => setView(option)}
                    aria-pressed={view === option}
                    className={`px-3 py-1 capitalize transition-colors ${
                      view === option
                        ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-1 mb-4" role="group" aria-label="Progression to chart">
              {CHART_MODES.map(option => (
                <button
                  key={option}
                  onClick={() => setMode(option)}
                  aria-pressed={mode === option}
                  title={option === 'attributes' ? 'Every stat, excluding overall' : STAT_NAMES[option]}
                  className={`px-3 py-1 text-sm font-bold rounded-full border transition-colors inline-flex items-center gap-1.5 ${
                    mode === option
                      ? 'bg-gray-900 text-white border-transparent dark:bg-white dark:text-gray-900'
                      : 'text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {option !== 'attributes' && (
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STAT_COLORS[option][isDark ? 'dark' : 'light'] }} />
                  )}
                  {option === 'attributes' ? 'All stats' : STAT_LABELS[option]}
                </button>
              ))}
            </div>

            {(isLoadingHistories || isRefreshing) && (
              <div className="mb-3" role="status">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  {progress
                    ? `Updating progression history from MFL… ${progress.refreshed} / ${progress.toRefresh} players`
                    : 'Checking for new progressions…'}
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
              <p className="mb-3 text-xs text-amber-700 dark:text-amber-400" role="status">
                MFL is limiting requests right now, so {progress.toRefresh > 0
                  ? `${progress.toRefresh - progress.refreshed} of ${progress.toRefresh} players are still to be updated`
                  : 'new progressions could not be checked'}. Everything loaded so far is saved — reload in about{' '}
                {Math.max(1, Math.ceil(progress.rateLimitedSeconds / 60))} minute{Math.ceil(progress.rateLimitedSeconds / 60) > 1 ? 's' : ''} to continue.
              </p>
            )}

            {progress && !isRefreshing && progress.failedIds.length > 0 && (
              <p className="mb-3 text-xs text-amber-700 dark:text-amber-400">
                Couldn’t update {progress.failedIds.length} player{progress.failedIds.length !== 1 ? 's' : ''} from MFL, so their latest progressions may be missing.{' '}
                <button onClick={() => setReloadKey(key => key + 1)} className="underline">Try again</button>
              </p>
            )}

            {/* While histories are still arriving the chart stays in place, dimmed */}
            <div className={isLoadingHistories ? 'opacity-50' : undefined}>
              {view === 'chart'
                ? <PlayerProgressionChart days={days} mode={mode} isDark={isDark} surface={surfaceColor} />
                : <PlayerProgressionDayTable days={days} mode={mode} />}
            </div>
          </div>

          {/* Players */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Players
                <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                  {rows.length}{rows.length !== players.length ? ` of ${players.length}` : ''} · stat points gained, last {periodDays} days
                </span>
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className={`${thClass} text-left`} onClick={() => handleSort('name')}>Player{sortArrow('name')}</th>
                    <th className={`${thClass} text-right`} onClick={() => handleSort('age')}>Age{sortArrow('age')}</th>
                    <th className={`${thClass} text-left`} onClick={() => handleSort('position')}>Pos{sortArrow('position')}</th>
                    <th className={`${thClass} text-left`} onClick={() => handleSort('squad')}>Squad{sortArrow('squad')}</th>
                    <th className={`${thClass} text-right`} onClick={() => handleSort('rating')}>Rating{sortArrow('rating')}</th>
                    <th className={`${thClass} text-right`} onClick={() => handleSort('total')} title="Stat points gained, excluding overall">Total{sortArrow('total')}</th>
                    <th className={`${thClass} text-right`} onClick={() => handleSort('overallPoints')} title="Rise in exact overall (the 2-decimal overall on the player page) over the period">
                      +{STAT_LABELS.overallPoints}{sortArrow('overallPoints')}
                    </th>
                    {PROGRESSION_STATS.map(stat => (
                      <th key={stat} className={`${thClass} text-right`} onClick={() => handleSort(stat)} title={`${STAT_NAMES[stat]} progressions`}>
                        +{STAT_LABELS[stat]}{sortArrow(stat)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {visibleRows.map(row => (
                    <tr key={row.player.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-3 py-2 whitespace-nowrap">
                        <a href={`/players/${row.player.id}`} className="text-blue-600 dark:text-blue-400 hover:underline">{row.name}</a>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">{row.player.metadata.age}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-gray-700 dark:text-gray-300">{row.player.metadata.positions.join(', ')}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-gray-700 dark:text-gray-300">{row.squad ?? <span className="text-gray-400 dark:text-gray-500">–</span>}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">{row.player.metadata.overall}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold text-gray-900 dark:text-white">{row.total || '–'}</td>
                      <td
                        className={`px-3 py-2 text-right tabular-nums ${
                          mode === 'overallPoints' ? 'font-semibold text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700/40' : 'text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {row.overallPoints > 0 ? `+${row.overallPoints.toFixed(2)}` : '–'}
                      </td>
                      {PROGRESSION_STATS.map(stat => (
                        <td
                          key={stat}
                          className={`px-3 py-2 text-right tabular-nums ${
                            mode === stat ? 'font-semibold text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700/40' : 'text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          {row.totals[stat] || '–'}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={7 + PROGRESSION_STATS.length} className="px-3 py-8 text-center text-gray-500 dark:text-gray-400">
                        No players match these filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {sortedRows.length > visibleRows.length && (
              <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 text-center">
                <button onClick={() => setShowAllRows(true)} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
                  Show all {sortedRows.length} players
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
