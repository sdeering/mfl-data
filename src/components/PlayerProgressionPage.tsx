'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { supabaseDataService } from '../services/clientDataService';
import { loadProgressionHistories, type PlayerHistories, type ProgressionLoadProgress } from '../services/playerProgressionService';
import type { MFLPlayer, MFLPosition } from '../types/mflApi';
import { POSITIONS, POSITION_GROUPS } from '../utils/positionOptions';
import {
  ATTRIBUTE_STATS,
  PROGRESSION_STATS,
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
import PlayerProgressionChart, { PlayerProgressionDayTable, SERIES_COLORS, type ProgressionChartMode } from './PlayerProgressionChart';
import {
  KpiTile,
  PageHeader,
  Panel,
  Select,
  TierText,
  btnDanger,
  btnSecondary,
  labelClass,
  linkClass,
  rowClass,
  sortableThClass,
  tableClass,
  tdClass,
  theadRowClass
} from './ui';

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

// The filters sit on the page rather than in a panel, so they take the panel colour to stand out
const filterSelectClass = 'h-11! bg-panel/90!';
// The column of the stat being charted
const highlightClass = 'font-semibold bg-[rgba(var(--glass-rgb),.03)]';
const blank = <span className="text-faint-2">–</span>;

export default function PlayerProgressionPage({ walletAddress }: PlayerProgressionPageProps) {
  const { account } = useWallet();
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

  const attributeProgressions = rows.reduce((sum, row) => sum + row.total, 0);
  const overallProgressions = rows.reduce((sum, row) => sum + (row.totals.overall ?? 0), 0);
  const playersProgressed = rows.filter(row => row.total > 0 || (row.totals.overall ?? 0) > 0).length;
  const modeName = mode === 'attributes' ? 'All stats' : STAT_NAMES[mode];
  const visibleRows = showAllRows ? sortedRows : sortedRows.slice(0, INITIAL_ROWS);

  const sortArrow = (field: SortField) => (sortField === field ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : '');
  const headerClass = (field: SortField, align = 'text-left') => `${sortableThClass} ${align} ${sortField === field ? 'text-accent-ink!' : ''}`;
  const renderSquadOption = (squad: Squad) => (
    <option key={squad.id} value={squad.id}>
      {squad.name} ({squad.playerCount}, avg age {squad.averageAge.toFixed(1)})
    </option>
  );

  if (!wallet) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Player Progression" />
        {hasCheckedWallet && (
          <Panel className="px-5 py-16 text-center">
            <p className="m-0 text-sm font-medium text-muted">Connect your wallet to see how your players are progressing.</p>
          </Panel>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Player Progression" subtitle={`Stat points gained by your players over the last ${periodDays} days, day by day`} />

      {error && (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-red-500/45 bg-red-500/12 px-4 py-3">
          <p className="m-0 text-sm font-semibold text-danger-ink">{error}</p>
          <button onClick={() => setReloadKey(key => key + 1)} className={btnDanger}>
            Try again
          </button>
        </div>
      )}

      {isLoadingPlayers && (
        <Panel className="flex items-center justify-center gap-3 py-16 text-sm font-medium text-muted">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          Loading your players...
        </Panel>
      )}

      {!isLoadingPlayers && !error && players.length === 0 && (
        <Panel className="px-5 py-16 text-center">
          <p className="m-0 text-sm font-medium text-muted">No players found for this wallet.</p>
          <p className="mt-1 mb-0 text-sm text-muted-3">If you own players, use “Sync Agency Data” in the wallet menu first.</p>
        </Panel>
      )}

      {players.length > 0 && (
        <>
          {/* Filters - one row, scoping everything below */}
          <div className="flex flex-wrap items-end gap-3">
            <label className={labelClass}>
              Period
              <Select value={periodDays} onChange={e => setPeriodDays(Number(e.target.value))} className={`${filterSelectClass} min-w-[150px]`}>
                {PERIODS.map(period => <option key={period} value={period}>Last {period} days</option>)}
              </Select>
            </label>
            <label className={`${labelClass} min-w-0 max-w-full`}>
              Squad
              <Select value={squadFilter ?? ALL_SQUADS} onChange={e => setSquadFilter(e.target.value)} className={`${filterSelectClass} min-w-[300px] max-w-full`}>
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
              </Select>
            </label>
            <label className={labelClass}>
              Position
              <Select value={positionFilter} onChange={e => setPositionFilter(e.target.value)} className={`${filterSelectClass} min-w-[220px]`}>
                <option value="all">All Positions</option>
                <option disabled>────────────</option>
                {POSITIONS.map(position => <option key={position.value} value={position.value}>{position.label}</option>)}
                <option disabled>────────────</option>
                {Object.entries(POSITION_GROUPS).map(([value, group]) => <option key={value} value={value}>{group.label}</option>)}
              </Select>
            </label>
            <label className={labelClass}>
              Max age
              <Select
                value={maxAge ?? ''}
                onChange={e => setMaxAge(e.target.value === '' ? null : Number(e.target.value))}
                className={`${filterSelectClass} min-w-[110px]`}
              >
                <option value="">Any age</option>
                {ageOptions.map(age => <option key={age} value={age}>{age}</option>)}
              </Select>
            </label>
            {isFiltered && (
              <button onClick={resetFilters} className={`${btnSecondary} h-11!`}>
                Reset
              </button>
            )}
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <KpiTile label="Players" value={rows.length.toLocaleString()} sub={rows.length !== players.length ? `of ${players.length}` : undefined} />
            <KpiTile label="Players who progressed" value={playersProgressed.toLocaleString()} />
            <KpiTile label="Stat progressions" value={attributeProgressions.toLocaleString()} sub="excludes overall" accent />
            <KpiTile label="Overall progressions" value={overallProgressions.toLocaleString()} />
          </div>

          {/* Chart */}
          <Panel className="flex flex-col gap-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-baseline gap-x-2.5">
                <h2 className="m-0 font-display text-[22px] font-bold text-fg">Progressions per day</h2>
                <span className="text-[13px] font-medium text-muted">{modeName}</span>
              </div>
              <div className="flex p-[3px] rounded-full bg-field border border-line-3">
                {(['chart', 'table'] as const).map(option => (
                  <button
                    key={option}
                    onClick={() => setView(option)}
                    aria-pressed={view === option}
                    className={`h-[30px] px-3.5 rounded-full text-[13px] font-semibold capitalize cursor-pointer transition-colors ${
                      view === option ? 'bg-fg text-canvas' : 'text-fg-3 hover:text-fg'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Progression to chart">
              {CHART_MODES.map(option => (
                <button
                  key={option}
                  onClick={() => setMode(option)}
                  aria-pressed={mode === option}
                  title={option === 'attributes' ? 'Every stat, excluding overall' : STAT_NAMES[option]}
                  className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-xs font-bold cursor-pointer transition-colors ${
                    mode === option
                      ? 'border-fg bg-fg text-canvas'
                      : 'border-line-2 bg-[rgba(var(--glass-rgb),.03)] text-fg-2 hover:border-line-hover'
                  }`}
                >
                  <span
                    className={`w-[7px] h-[7px] rounded-full ${option === 'attributes' ? 'bg-current' : ''}`}
                    style={option === 'attributes' ? undefined : { backgroundColor: SERIES_COLORS[option] }}
                  />
                  {option === 'attributes' ? 'All stats' : STAT_LABELS[option]}
                </button>
              ))}
            </div>

            {(isLoadingHistories || isRefreshing) && (
              <div role="status">
                <p className="mt-0 mb-1.5 text-xs font-medium text-muted">
                  {progress
                    ? `Updating progression history from MFL… ${progress.refreshed} / ${progress.toRefresh} players`
                    : 'Checking for new progressions…'}
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
              <p className="m-0 text-xs font-medium text-warn-ink" role="status">
                MFL is limiting requests right now, so {progress.toRefresh > 0
                  ? `${progress.toRefresh - progress.refreshed} of ${progress.toRefresh} players are still to be updated`
                  : 'new progressions could not be checked'}. Everything loaded so far is saved — reload in about{' '}
                {Math.max(1, Math.ceil(progress.rateLimitedSeconds / 60))} minute{Math.ceil(progress.rateLimitedSeconds / 60) > 1 ? 's' : ''} to continue.
              </p>
            )}

            {progress && !isRefreshing && progress.failedIds.length > 0 && (
              <p className="m-0 text-xs font-medium text-warn-ink">
                Couldn’t update {progress.failedIds.length} player{progress.failedIds.length !== 1 ? 's' : ''} from MFL, so their latest progressions may be missing.{' '}
                <button onClick={() => setReloadKey(key => key + 1)} className="underline cursor-pointer">Try again</button>
              </p>
            )}

            {/* While histories are still arriving the chart stays in place, dimmed */}
            <div className={isLoadingHistories ? 'opacity-50' : undefined}>
              {view === 'chart'
                ? <PlayerProgressionChart days={days} mode={mode} />
                : <PlayerProgressionDayTable days={days} mode={mode} />}
            </div>
          </Panel>

          {/* Players */}
          <Panel className="overflow-hidden">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 px-5 py-[18px]">
              <h2 className="m-0 font-display text-[22px] font-bold text-fg">Players</h2>
              <span className="text-[13px] font-medium text-muted">
                {rows.length}{rows.length !== players.length ? ` of ${players.length}` : ''} · stat points gained, last {periodDays} days
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className={tableClass}>
                <thead>
                  <tr className={theadRowClass}>
                    <th className={`${headerClass('name')} pl-5`} onClick={() => handleSort('name')}>Player{sortArrow('name')}</th>
                    <th className={headerClass('age', 'text-right')} onClick={() => handleSort('age')}>Age{sortArrow('age')}</th>
                    <th className={headerClass('position')} onClick={() => handleSort('position')}>Pos{sortArrow('position')}</th>
                    <th className={headerClass('squad')} onClick={() => handleSort('squad')}>Squad{sortArrow('squad')}</th>
                    <th className={headerClass('rating', 'text-right')} onClick={() => handleSort('rating')}>Rating{sortArrow('rating')}</th>
                    <th className={headerClass('total', 'text-right')} onClick={() => handleSort('total')} title="Stat points gained, excluding overall">Total{sortArrow('total')}</th>
                    <th className={headerClass('overallPoints', 'text-right')} onClick={() => handleSort('overallPoints')} title="Rise in exact overall (the 2-decimal overall on the player page) over the period">
                      +{STAT_LABELS.overallPoints}{sortArrow('overallPoints')}
                    </th>
                    {PROGRESSION_STATS.map(stat => (
                      <th key={stat} className={headerClass(stat, 'text-right')} onClick={() => handleSort(stat)} title={`${STAT_NAMES[stat]} progressions`}>
                        +{STAT_LABELS[stat]}{sortArrow(stat)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map(row => (
                    <tr key={row.player.id} className={`${rowClass} text-sm font-medium text-fg-2`}>
                      <td className={`${tdClass} pl-5`}>
                        <a href={`/players/${row.player.id}`} className="font-bold text-fg hover:text-accent-ink transition-colors">{row.name}</a>
                      </td>
                      <td className={`${tdClass} text-right tabular-nums`}>{row.player.metadata.age}</td>
                      <td className={`${tdClass} text-muted`}>{row.player.metadata.positions.join(', ')}</td>
                      <td className={`${tdClass} text-[13px] text-muted`}>{row.squad ?? blank}</td>
                      <td className={`${tdClass} text-right`}><TierText value={row.player.metadata.overall} /></td>
                      <td className={`${tdClass} text-right`}>
                        {row.total
                          ? <span className="inline-grid place-items-center min-w-9 h-[26px] px-1.5 rounded-lg bg-accent text-accent-fg font-display text-sm font-extrabold tabular-nums">{row.total}</span>
                          : blank}
                      </td>
                      <td className={`${tdClass} text-right font-mono text-[13px] text-pos-ink ${mode === 'overallPoints' ? highlightClass : ''}`}>
                        {row.overallPoints > 0 ? `+${row.overallPoints.toFixed(2)}` : blank}
                      </td>
                      {PROGRESSION_STATS.map(stat => (
                        <td
                          key={stat}
                          className={`${tdClass} text-right tabular-nums ${(row.totals[stat] ?? 0) >= 5 ? 'text-accent-ink' : ''} ${mode === stat ? highlightClass : ''}`}
                        >
                          {row.totals[stat] || blank}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={7 + PROGRESSION_STATS.length} className="px-3 py-8 text-center text-sm font-medium text-muted">
                        No players match these filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {sortedRows.length > visibleRows.length && (
              <div className="px-5 py-3 border-t border-line text-center">
                <button onClick={() => setShowAllRows(true)} className={`text-sm font-semibold cursor-pointer ${linkClass}`}>
                  Show all {sortedRows.length} players
                </button>
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
