'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { clubPlayersService, ClubPlayer } from '@/src/services/clubPlayersService';
import { clubsService } from '@/src/services/clubsService';
import { OverallRatingTooltip } from './OverallRatingTooltip';
import { PlayerFilters, FilterState, applyFilters } from './PlayerFilters';
import { MFLPlayer, MFLPosition } from '../types/mflApi';
import { calculatePositionOVR } from '../utils/ruleBasedPositionCalculator';
import { rankPositionRatings } from '../utils/positionRatingOrder';
import ClubTrainingTab from './ClubTrainingTab';
import {
  PageHeader,
  Panel,
  KpiTile,
  TierBadge,
  PositionChip,
  SearchField,
  InitialsAvatar,
  SortArrow,
  btnPrimary,
  btnSecondary,
  linkClass,
  tableClass,
  theadRowClass,
  thClass,
  sortableThClass,
  rowClass,
  tdClass,
} from './ui';

const ATTRIBUTE_COLUMNS = [
  { key: 'pace', label: 'Pace', short: 'PAC' },
  { key: 'shooting', label: 'Shooting', short: 'SHO' },
  { key: 'passing', label: 'Passing', short: 'PAS' },
  { key: 'dribbling', label: 'Dribbling', short: 'DRI' },
  { key: 'defense', label: 'Defense', short: 'DEF' },
  { key: 'physical', label: 'Physical', short: 'PHY' },
] as const;

interface ClubPlayersPageProps {
  clubId: string;
}

export default function ClubPlayersPage({ clubId }: ClubPlayersPageProps) {
  const router = useRouter();
  const [players, setPlayers] = useState<ClubPlayer[]>([]);
  const [clubInfo, setClubInfo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<string>('overall');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    filterPosition: 'all',
    selectedCardTypes: [],
    overallMin: 0,
    overallMax: 100,
    positionRatingMin: 0,
    positionRatingMax: 100,
    attrFilters: {
      pace: 0,
      shooting: 0,
      passing: 0,
      dribbling: 0,
      defense: 0,
      physical: 0,
    },
    attrFiltersMax: {
      pace: 100,
      shooting: 100,
      passing: 100,
      dribbling: 100,
      defense: 100,
      physical: 100,
    },
  });
  const [filteredPlayers, setFilteredPlayers] = useState<ClubPlayer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'players' | 'training'>('players');

  // A club's players are public, so the page works with or without a wallet
  useEffect(() => {
    fetchClubPlayers();
  }, [clubId]);

  const fetchClubPlayers = async () => {
    try {
      setIsLoadingPlayers(true);
      setError(null);

      const playersData = await clubPlayersService.fetchPlayersForClub(clubId);
      setPlayers(playersData);
      
      // Extract club info from the first player's contract
      if (playersData.length > 0 && playersData[0].activeContract?.club) {
        setClubInfo(playersData[0].activeContract.club);
      }
    } catch (err) {
      console.error('Error fetching club players:', err);
      setError('Failed to load club players');
    } finally {
      setIsLoadingPlayers(false);
    }
  };

  // Apply filters, search, and sort players
  useEffect(() => {
    // Convert ClubPlayer to MFLPlayer format for filtering
    const mflPlayers: MFLPlayer[] = players.map(p => ({
      id: p.id,
      metadata: p.metadata,
      activeContract: p.activeContract,
    } as MFLPlayer));
    
    // Apply filters
    let filtered = applyFilters(mflPlayers, filters);
    
    // Apply search term filter
    if (searchTerm.trim()) {
      filtered = filtered.filter(player => {
        const fullName = `${player.metadata.firstName} ${player.metadata.lastName}`.toLowerCase();
        const positions = player.metadata.positions?.join(', ').toLowerCase() || '';
        const search = searchTerm.toLowerCase();
        
        return fullName.includes(search) || 
               positions.includes(search) ||
               player.metadata.overall.toString().includes(search) ||
               player.metadata.age.toString().includes(search) ||
               player.metadata.pace.toString().includes(search) ||
               player.metadata.shooting.toString().includes(search) ||
               player.metadata.passing.toString().includes(search) ||
               player.metadata.dribbling.toString().includes(search) ||
               player.metadata.defense.toString().includes(search) ||
               player.metadata.physical.toString().includes(search);
      });
    }
    
    // Convert back to ClubPlayer format
    const filteredClubPlayers = filtered.map(mflPlayer => {
      const originalPlayer = players.find(p => p.id === mflPlayer.id);
      return originalPlayer || mflPlayer as ClubPlayer;
    });
    
    // Sort filtered players
    const sorted = [...filteredClubPlayers].sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortField) {
        case 'name':
          aValue = `${a.metadata.firstName} ${a.metadata.lastName}`;
          bValue = `${b.metadata.firstName} ${b.metadata.lastName}`;
          break;
        case 'overall':
          aValue = a.metadata.overall;
          bValue = b.metadata.overall;
          break;
        case 'age':
          aValue = a.metadata.age;
          bValue = b.metadata.age;
          break;
        case 'pace':
          aValue = a.metadata.pace;
          bValue = b.metadata.pace;
          break;
        case 'shooting':
          aValue = a.metadata.shooting;
          bValue = b.metadata.shooting;
          break;
        case 'passing':
          aValue = a.metadata.passing;
          bValue = b.metadata.passing;
          break;
        case 'dribbling':
          aValue = a.metadata.dribbling;
          bValue = b.metadata.dribbling;
          break;
        case 'defense':
          aValue = a.metadata.defense;
          bValue = b.metadata.defense;
          break;
        case 'physical':
          aValue = a.metadata.physical;
          bValue = b.metadata.physical;
          break;
        default:
          aValue = a.metadata.overall;
          bValue = b.metadata.overall;
      }

      if (typeof aValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    });
    
    setFilteredPlayers(sorted);
  }, [players, filters, sortField, sortDirection, searchTerm]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Rating at one of the player's playable positions (primary = overall)
  const getPositionRating = (player: ClubPlayer, position: MFLPosition) => {
    const m = player.metadata;
    const result = calculatePositionOVR({
      id: player.id,
      name: `${m.firstName} ${m.lastName}`,
      attributes: {
        PAC: m.pace,
        SHO: m.shooting,
        PAS: m.passing,
        DRI: m.dribbling,
        DEF: m.defense,
        PHY: m.physical,
        GK: m.goalkeeping || 0
      },
      positions: (m.positions || []) as MFLPosition[],
      overall: m.overall
    }, position);
    return result.success ? result.ovr : 0;
  };

  const isGoalkeeper = (player: ClubPlayer) => {
    return player.metadata.positions?.includes('GK') || player.metadata.positions?.[0] === 'GK';
  };

  // Attribute badge (show dash for GK non-goalkeeping stats)
  const renderAttributeValue = (player: ClubPlayer, value: number) => (
    <TierBadge value={isGoalkeeper(player) && value === 0 ? null : value} />
  );

  // Squad averages: whole squad, best 11 and best 16 by overall
  const overallsDesc = players.map(p => p.metadata.overall).sort((a, b) => b - a);
  const averageOverall = (count: number) => {
    const top = overallsDesc.slice(0, count);
    return top.length > 0 ? (top.reduce((sum, o) => sum + o, 0) / top.length).toFixed(2) : '—';
  };
  const squadAverages = [
    { label: 'Avg Overall', value: averageOverall(overallsDesc.length) },
    { label: 'AVG (TOP11)', value: averageOverall(11) },
    { label: 'AVG (TOP16)', value: averageOverall(16) },
  ];

  // Average of each attribute over the squad, leaving out goalkeepers' blank outfield stats
  const attributeAverages = ATTRIBUTE_COLUMNS.map(({ key, short }) => {
    const values = players
      .filter(p => !(isGoalkeeper(p) && p.metadata[key] === 0))
      .map(p => p.metadata[key]);
    const value = values.length > 0 ? Math.round(values.reduce((sum, v) => sum + v, 0) / values.length) : null;
    return { short, value };
  });

  // Helper function to get division name
  const getDivisionName = (division: number) => {
    return clubsService.getDivisionName(division);
  };

  const isFiltersActive =
    filters.filterPosition !== 'all' ||
    filters.selectedCardTypes.length > 0 ||
    filters.overallMin > 0 ||
    filters.overallMax < 100 ||
    filters.positionRatingMin > 0 ||
    filters.positionRatingMax < 100 ||
    Object.values(filters.attrFilters).some(v => v > 0) ||
    Object.values(filters.attrFiltersMax).some(v => v < 100);

  const renderSortHeader = (field: string, label: string, centered = false) => (
    <th
      key={field}
      className={`${sortableThClass} ${centered ? 'w-20' : ''}`}
      onClick={() => handleSort(field)}
    >
      <div className={`flex items-center ${centered ? 'justify-center' : ''}`}>
        <span className={sortField === field ? 'text-accent-ink' : undefined}>{label}</span>
        <SortArrow active={sortField === field} direction={sortDirection} />
      </div>
    </th>
  );

  if (error) {
    return (
      <Panel className="flex flex-col items-center gap-2 px-6 py-16 text-center">
        <h2 className="m-0 font-display text-2xl font-bold text-fg">
          Error Loading Club Players
        </h2>
        <p className="m-0 mb-2 text-[15px] font-medium text-muted">{error}</p>
        <button
          onClick={() => {
            clubPlayersService.clearCache(clubId);
            fetchClubPlayers();
          }}
          className={btnPrimary}
        >
          Try Again
        </button>
      </Panel>
    );
  }

  const playerCount = `(${filteredPlayers.length}${filteredPlayers.length !== players.length ? ` of ${players.length}` : ''} Players)`;

  return (
    <div className="flex flex-col gap-[22px]">
      <PageHeader
        title={clubInfo ? clubInfo.name : `Club ${clubId}`}
        count={playerCount}
        subtitle={clubInfo && `${clubInfo.city}, ${clubInfo.country} • ${getDivisionName(clubInfo.division)}`}
      />

      {/* Squad Averages */}
      {players.length > 0 && (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.5">
            {squadAverages.map(({ label, value }) => (
              <KpiTile key={label} label={label} value={value} />
            ))}
          </div>

          <Panel className="flex flex-wrap items-center justify-between gap-4 px-5 py-[18px]">
            <h2 className="m-0 font-display text-xl font-bold text-fg">Squad averages</h2>
            <div className="flex flex-wrap gap-2.5">
              {attributeAverages.map(({ short, value }) => (
                <div key={short} className="flex flex-col items-center gap-1.5">
                  <span className="text-[11px] font-bold tracking-[0.08em] text-muted">{short}</span>
                  <TierBadge value={value} size="lg" />
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}

      {/* Tabs */}
      <div className="flex">
        <div className="inline-flex p-[3px] rounded-full bg-field border border-line-3">
          {(['players', 'training'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`h-[30px] px-3.5 rounded-full text-[13px] font-semibold capitalize cursor-pointer transition-colors ${
                activeTab === tab ? 'bg-fg text-canvas' : 'text-fg-3 hover:text-fg'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'training' && <ClubTrainingTab clubId={clubId} />}

      {/* Loading State */}
      {activeTab === 'players' && isLoadingPlayers && (
        <Panel className="flex items-center justify-center gap-3 px-6 py-16">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent"></div>
          <span className="text-[15px] font-medium text-muted">Loading club players...</span>
        </Panel>
      )}

      {activeTab === 'players' && !isLoadingPlayers && players.length === 0 && (
        <Panel className="px-6 py-16 text-center">
          <p className="m-0 text-[15px] font-medium text-muted">No players found for this club.</p>
        </Panel>
      )}

      {/* Players Table */}
      {activeTab === 'players' && !isLoadingPlayers && players.length > 0 && (
        <Panel className="overflow-hidden">
          {/* Filters Section */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-[18px] py-4">
            <SearchField
              placeholder="Search players..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClear={() => setSearchTerm('')}
            />

            <div className="flex items-center gap-4">
              <button
                className={btnSecondary}
                onClick={() => setShowFilters(!showFilters)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path d="M4 6h16M7 12h10M10 18h4" />
                </svg>
                {showFilters ? 'Hide Filters' : 'Show Filters'}
              </button>

              {isFiltersActive && (
                <button
                  type="button"
                  onClick={() => {
                    setFilters({
                      filterPosition: 'all',
                      selectedCardTypes: [],
                      overallMin: 0,
                      overallMax: 100,
                      positionRatingMin: 0,
                      positionRatingMax: 100,
                      attrFilters: {
                        pace: 0,
                        shooting: 0,
                        passing: 0,
                        dribbling: 0,
                        defense: 0,
                        physical: 0,
                      },
                      attrFiltersMax: {
                        pace: 100,
                        shooting: 100,
                        passing: 100,
                        dribbling: 100,
                        defense: 100,
                        physical: 100,
                      },
                    });
                  }}
                  className={`text-[13px] font-semibold cursor-pointer ${linkClass}`}
                  title="Reset filters"
                >
                  Reset Filters
                </button>
              )}
            </div>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="px-[18px] py-4 border-t border-line">
              <PlayerFilters
                filters={filters}
                onFiltersChange={setFilters}
                showSidebarFilters={true}
              />
            </div>
          )}

          {filteredPlayers.length === 0 ? (
            <div className="px-6 py-14 text-center border-t border-line">
              <p className="m-0 text-[15px] font-medium text-muted">No players match the current filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className={tableClass}>
                <thead>
                  <tr className={theadRowClass}>
                    {renderSortHeader('name', 'Player')}
                    {renderSortHeader('overall', 'Overall', true)}
                    {renderSortHeader('age', 'Age')}
                    <th className={thClass}>Positions</th>
                    {ATTRIBUTE_COLUMNS.map(({ key, label }) => renderSortHeader(key, label, true))}
                  </tr>
                </thead>
                <tbody>
                  {filteredPlayers.map((player) => {
                    const fullName = `${player.metadata.firstName} ${player.metadata.lastName}`;
                    return (
                      <tr key={player.id} className={rowClass}>
                        <td className={tdClass}>
                          <div className="flex items-center gap-3">
                            <InitialsAvatar name={fullName} />
                            <div className="flex flex-col gap-0.5 min-w-0">
                              <button
                                type="button"
                                className="p-0 border-0 bg-transparent text-left text-[15px] font-bold text-fg cursor-pointer transition-colors hover:text-accent-ink"
                                onClick={(e) => {
                                  if (e.ctrlKey || e.metaKey) {
                                    window.open(`/players/${player.id}`, '_blank');
                                  } else {
                                    router.push(`/players/${player.id}`);
                                  }
                                }}
                              >
                                {fullName}
                              </button>
                              <span className="font-mono text-xs text-muted-3">
                                ID {player.id}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className={`${tdClass} text-center`}>
                          <OverallRatingTooltip player={player}>
                            <TierBadge value={player.metadata.overall} size="lg" />
                          </OverallRatingTooltip>
                        </td>
                        <td className={`${tdClass} text-sm font-semibold text-fg-3`}>
                          {player.metadata.age}
                        </td>
                        <td className={`${tdClass} text-sm text-muted`}>
                          {player.metadata.positions?.length ? (
                            <div className="flex gap-[5px]">
                              {rankPositionRatings(
                                player.metadata.positions,
                                pos => getPositionRating(player, pos as MFLPosition)
                              ).map(({ position, rating, isPrimary, diff }) => (
                                <PositionChip
                                  key={position}
                                  position={position}
                                  rating={rating}
                                  gain={diff}
                                  title={isPrimary ? 'Primary position' : diff > 0 ? `+${diff} vs primary position` : undefined}
                                />
                              ))}
                            </div>
                          ) : 'N/A'}
                        </td>
                        {ATTRIBUTE_COLUMNS.map(({ key }) => (
                          <td key={key} className={`${tdClass} w-20 text-center`}>
                            {renderAttributeValue(player, player.metadata[key])}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}
