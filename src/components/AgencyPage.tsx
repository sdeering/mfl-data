"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useRouter } from 'next/navigation';
import { supabaseDataService } from '../services/clientDataService';
import { MFLPlayer, MFLPosition } from '../types/mflApi';
import { useSupabaseSyncUI } from '../contexts/SupabaseSyncContext';
import { OverallRatingTooltip } from './OverallRatingTooltip';
// Removed market value sync UI on agency page
import * as XLSX from 'xlsx';
import { PlayerFilters, FilterState, applyFilters } from './PlayerFilters';
import { loadAppSettings, isRetiredPlayer, isRetiringThisSeason } from '../utils/appSettings';
import { currentSeason } from '../utils/playerSeasons';
import { calculateAllPositionOVRs } from '../utils/ruleBasedPositionCalculator';
import { rankPositionRatings } from '../utils/positionRatingOrder';
import RetirementIcon from './RetirementIcon';
import WalletGate from './WalletGate';
import {
  PageHeader,
  Panel,
  SearchField,
  TierBadge,
  PositionChip,
  InitialsAvatar,
  SortArrow,
  btnPrimary,
  btnSecondary,
  tableClass,
  theadRowClass,
  sortableThClass,
  rowClass,
  tdClass,
} from './ui';

const AgencyPage: React.FC = () => {
  const { isConnected, account, viewedAddress = null } = useWallet();
  const ownWallet = isConnected ? account : null;
  // The connected wallet, or one pasted in to look at read-only
  const walletAddress = ownWallet ?? viewedAddress;
  const isViewing = !ownWallet && !!viewedAddress;
  const { startSync, isSyncing, progress: syncProgress } = useSupabaseSyncUI();
  const [players, setPlayers] = useState<MFLPlayer[]>([]);
  // For the retirement icons to say which season a player retires at the end of
  const season = currentSeason(players);
  const [filteredPlayers, setFilteredPlayers] = useState<MFLPlayer[]>([]);
  const [displayedPlayers, setDisplayedPlayers] = useState<MFLPlayer[]>([]);
  // Removed market values state (no longer shown on agency table)
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<string>('overall');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);
  const [refreshingPlayers, setRefreshingPlayers] = useState<Set<number>>(new Set());
  const [syncJobId, setSyncJobId] = useState<string | null>(null);
  const playersPerPage = 50;
  const router = useRouter();
  const prevIsSyncingRef = useRef(false);
  const hasAutoSyncedRef = useRef(false);
  const [showFilters, setShowFilters] = useState(false);
  // Starts from the "hide retired players" setting (read once mounted, as it is saved in the browser)
  const [includeRetired, setIncludeRetired] = useState(false);
  useEffect(() => {
    setIncludeRetired(!loadAppSettings().hideRetiredPlayers);
  }, []);
  const [excludeRetiring, setExcludeRetiring] = useState(false);
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

  // Helper functions for formatting player data
  const formatPlayerName = (player: MFLPlayer): string => {
    return `${player.metadata.firstName} ${player.metadata.lastName}`;
  };

  const formatPositions = (player: MFLPlayer): string => {
    return player.metadata.positions.join(', ');
  };

  const getClubName = (player: MFLPlayer): string => {
    return player.activeContract?.club.name || 'No Club';
  };

  // Rating at every position, from the same rule-based calculator as the squad builder
  const getAllPositionRatings = (player: MFLPlayer) => {
    const m = player.metadata;
    return calculateAllPositionOVRs({
      id: player.id,
      name: `${m.firstName} ${m.lastName}`,
      attributes: { PAC: m.pace, SHO: m.shooting, PAS: m.passing, DRI: m.dribbling, DEF: m.defense, PHY: m.physical, GK: m.goalkeeping || 0 },
      positions: (m.positions || []) as MFLPosition[],
      overall: m.overall
    }).results;
  };

  // Helper function to check if player is a goalkeeper
  const isGoalkeeper = (player: MFLPlayer) => {
    return player.metadata.positions.some(pos => pos.toLowerCase().includes('gk') || pos.toLowerCase().includes('goalkeeper'));
  };

  // Helper function to render attribute value (blank for GK non-goalkeeping stats)
  const renderAttributeValue = (player: MFLPlayer, value: number, isGoalkeepingStat: boolean = false) => {
    if (isGoalkeeper(player) && !isGoalkeepingStat && value === 0) {
      return <span className="text-faint">–</span>;
    }
    return <TierBadge value={value} />;
  };

  // Helper function to get sort value for a player
  const getSortValue = (player: MFLPlayer, field: string): string | number => {
    switch (field) {
      case 'name':
        return formatPlayerName(player).toLowerCase();
      case 'positions':
        return formatPositions(player).toLowerCase();
      case 'overall':
        return player.metadata.overall;
      case 'age':
        return player.metadata.age;
      case 'pace':
        return player.metadata.pace;
      case 'shooting':
        return player.metadata.shooting;
      case 'passing':
        return player.metadata.passing;
      case 'dribbling':
        return player.metadata.dribbling;
      case 'defense':
        return player.metadata.defense;
      case 'physical':
        return player.metadata.physical;
      // Removed marketValue from sorting
      case 'marketValue':
        return 0;
      case 'club':
        return getClubName(player).toLowerCase();
      default:
        return 0;
    }
  };

  // Function to handle column sorting
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Function to export players to Excel
  const exportToExcel = () => {
    if (players.length === 0) {
      alert('No players to export');
      return;
    }

    // Prepare data for export
    const exportData = players.map(player => {
      // Market value removed from export
      
      // Get position ratings and primary position
      const positionRatings = getAllPositionRatings(player);
      const primaryPosition = player.metadata.positions?.[0] || 'N/A';
      
      // Define position order
      const positionOrder = ['GK', 'RWB', 'RB', 'CB', 'LWB', 'LB', 'CM', 'RM', 'LM', 'CDM', 'CAM', 'RW', 'LW', 'CF', 'ST'];
      
      // Create base export object
      const exportObj = {
        'Player ID': player.id,
        'First Name': player.metadata.firstName,
        'Last Name': player.metadata.lastName,
        'Full Name': formatPlayerName(player),
        'Primary Position': primaryPosition,
        'All Positions': formatPositions(player),
        'Overall Rating': player.metadata.overall,
        'Age': player.metadata.age,
        'Pace': player.metadata.pace,
        'Shooting': player.metadata.shooting,
        'Passing': player.metadata.passing,
        'Dribbling': player.metadata.dribbling,
        'Defense': player.metadata.defense,
        'Physical': player.metadata.physical,
        'Goalkeeping': player.metadata.goalkeeping || 0,
        // 'Market Value': 'Removed',
        // 'Market Value Confidence': 'Removed',
        'Club': getClubName(player),
        'Contract Status': player.activeContract ? 'Active' : 'No Contract',
        'Nationality': player.metadata.nationalities?.[0] || 'N/A',
        'Height': player.metadata.height || 'N/A',
        'Preferred Foot': player.metadata.preferredFoot || 'N/A',
        'Retirement Years': player.metadata.retirementYears || 'N/A'
      };
      
      // Add position rating columns at the end
      positionOrder.forEach(position => {
        const rating = positionRatings?.[position as MFLPosition];
        if (rating?.success) {
          (exportObj as any)[`${position} Rating`] = rating.ovr;
        } else {
          (exportObj as any)[`${position} Rating`] = 'N/A';
        }
      });
      
      return exportObj;
    });

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);

    // Set column widths
    const colWidths = [
      { wch: 10 }, // Player ID
      { wch: 15 }, // First Name
      { wch: 15 }, // Last Name
      { wch: 20 }, // Full Name
      { wch: 15 }, // Primary Position
      { wch: 20 }, // All Positions
      { wch: 15 }, // Overall Rating
      { wch: 8 },  // Age
      { wch: 8 },  // Pace
      { wch: 10 }, // Shooting
      { wch: 10 }, // Passing
      { wch: 12 }, // Dribbling
      { wch: 10 }, // Defense
      { wch: 10 }, // Physical
      { wch: 12 }, // Goalkeeping
      // { wch: 15 }, // Market Value (removed)
      // { wch: 20 }, // Market Value Confidence (removed)
      { wch: 20 }, // Club
      { wch: 15 }, // Contract Status
      { wch: 15 }, // Nationality
      { wch: 8 },  // Height
      { wch: 15 }, // Preferred Foot
      { wch: 15 }, // Retirement Years
      // Position rating columns (15 positions)
      { wch: 12 }, // GK Rating
      { wch: 12 }, // RWB Rating
      { wch: 12 }, // RB Rating
      { wch: 12 }, // CB Rating
      { wch: 12 }, // LWB Rating
      { wch: 12 }, // LB Rating
      { wch: 12 }, // CM Rating
      { wch: 12 }, // RM Rating
      { wch: 12 }, // LM Rating
      { wch: 12 }, // CDM Rating
      { wch: 12 }, // CAM Rating
      { wch: 12 }, // RW Rating
      { wch: 12 }, // LW Rating
      { wch: 12 }, // CF Rating
      { wch: 12 }  // ST Rating
    ];
    ws['!cols'] = colWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Agency Players');

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `agency-players-${timestamp}.xlsx`;

    // Save file
    XLSX.writeFile(wb, filename);
  };

  // Function to sort players
  const sortPlayers = (playersToSort: MFLPlayer[]) => {
    return [...playersToSort].sort((a, b) => {
      const aValue = getSortValue(a, sortField);
      const bValue = getSortValue(b, sortField);
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      } else {
        const aNum = Number(aValue);
        const bNum = Number(bValue);
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
      }
    });
  };

  // Pagination helper functions
  const totalPages = Math.ceil(filteredPlayers.length / playersPerPage);
  
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  // Removed: market values fetching on agency page

  const fetchMFLPlayers = async () => {
    if (!walletAddress) return;
    
    console.log('🔍 fetchMFLPlayers called for account:', walletAddress);
    setIsLoading(true);
    setError(null);
    setHasAttemptedLoad(true);
    
    try {
      // Use Supabase data service instead of MFL API
      console.log('🔍 Fetching agency players from database...');
      // Retired players are loaded too; the "Include retired players" filter decides whether they show.
      // A viewed wallet may not be stored yet, so it is loaded from MFL when it isn't.
      const playerData = await supabaseDataService.getAgencyPlayers(walletAddress, { includeRetired: true, loadFromMfl: isViewing });
      console.log('📊 Fetched players from database:', playerData.length, 'players');
      
      if (playerData.length === 0) {
        console.log('⚠️ No players found in database, this might be a cache issue');
      }
      
      setPlayers(playerData);
      setFilteredPlayers(playerData);
      
      // Market values removed from agency view
      
    } catch (error: any) {
      console.error('❌ Error fetching players from database:', error);
      // For a viewed wallet the server says why, such as how long to wait after too many lookups
      setError(isViewing && error instanceof Error ? error.message : 'Failed to load your player collection from database. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncPlayers = async () => {
    if (!account) return;
    
    try {
      await startSync(true); // Force refresh
    } catch (error) {
      console.error('Error starting sync:', error);
      setError('Failed to start sync. Please try again.');
    }
  };

  // Removed: bulk market value sync action

  // Removed: market value sync completion handler

  // Removed: close sync progress handler


  useEffect(() => {
    if (walletAddress) {
      hasAutoSyncedRef.current = false; // Reset auto-sync flag for new account
      fetchMFLPlayers();
    }
  }, [walletAddress]);

  // Auto-sync when no players are found (only if global sync is not already running)
  useEffect(() => {
    // Only your own wallet syncs; a viewed one shows what is already stored
    if (hasAttemptedLoad && !isLoading && !error && players.length === 0 && ownWallet && !isSyncing && !hasAutoSyncedRef.current) {
      console.log('No players found, auto-syncing...');
      hasAutoSyncedRef.current = true; // Prevent multiple auto-syncs
      handleSyncPlayers();
    }
  }, [hasAttemptedLoad, isLoading, error, players.length, ownWallet, isSyncing]);

  // Refetch players when sync completes
  useEffect(() => {
    // Check if sync just completed (was syncing, now not syncing)
    if (hasAttemptedLoad && !isSyncing && prevIsSyncingRef.current && account) {
      console.log('✅ Sync completed, clearing cache and refetching players...');
      // Clear the agency players cache to ensure we get fresh data
      supabaseDataService.clearCache(`agency_players_${account}`);
      // Also clear market values cache
      supabaseDataService.clearCache(`agency_market_values_${account}`);
      fetchMFLPlayers();
    }
    
    // Update previous sync state
    prevIsSyncingRef.current = isSyncing;
  }, [isSyncing, account, hasAttemptedLoad]);

  // Removed: Market values refresh during sync (market values no longer displayed on agency page)


  // Filter and sort players based on search term, filters, and sort settings
  useEffect(() => {
    let filtered = includeRetired ? players : players.filter(player => !isRetiredPlayer(player));
    if (excludeRetiring) {
      filtered = filtered.filter(player => !isRetiringThisSeason(player));
    }

    // Apply filters first
    filtered = applyFilters(filtered, filters);
    
    // Apply search term filter
    if (searchTerm.trim()) {
      filtered = filtered.filter(player => {
        const fullName = formatPlayerName(player).toLowerCase();
        const positions = formatPositions(player).toLowerCase();
        const club = getClubName(player).toLowerCase();
        const search = searchTerm.toLowerCase();
        
        return fullName.includes(search) || 
               positions.includes(search) || 
               club.includes(search) ||
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
    
    // Apply sorting to filtered results
    const sortedFiltered = sortPlayers(filtered);
    setFilteredPlayers(sortedFiltered);
    
    // Reset to first page when search term or filters change
    setCurrentPage(1);
  }, [searchTerm, players, sortField, sortDirection, filters, includeRetired, excludeRetiring]);

  // Update displayed players based on current page
  useEffect(() => {
    const startIndex = (currentPage - 1) * playersPerPage;
    const endIndex = startIndex + playersPerPage;
    const paginatedPlayers = filteredPlayers.slice(startIndex, endIndex);
    setDisplayedPlayers(paginatedPlayers);
  }, [filteredPlayers, currentPage, playersPerPage]);

  if (!walletAddress) {
    return <WalletGate title="My MFL Agency" description="every player you own" />;
  }

  const statColumns: { field: 'pace' | 'shooting' | 'passing' | 'dribbling' | 'defense' | 'physical'; label: string }[] = [
    { field: 'pace', label: 'Pace' },
    { field: 'shooting', label: 'Shooting' },
    { field: 'passing', label: 'Passing' },
    { field: 'dribbling', label: 'Dribbling' },
    { field: 'defense', label: 'Defense' },
    { field: 'physical', label: 'Physical' },
  ];

  const sortHeader = (field: string, label: string, align: 'left' | 'center' = 'left') => (
    <th
      key={field}
      className={`${sortableThClass} ${align === 'center' ? 'text-center' : ''} ${sortField === field ? '!text-accent-ink' : ''}`}
      onClick={() => handleSort(field)}
    >
      {label}
      <SortArrow active={sortField === field} direction={sortDirection} />
    </th>
  );

  const pageButtonClass = (active: boolean) =>
    `inline-flex items-center justify-center min-w-9 h-9 px-3 rounded-[10px] border text-sm font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
      active ? 'border-accent bg-accent text-accent-fg' : 'border-line-2 bg-btn text-fg-2 hover:border-line-hover'
    }`;

  const isFiltersActive =
    filters.filterPosition !== 'all' ||
    filters.selectedCardTypes.length > 0 ||
    filters.overallMin > 0 ||
    filters.overallMax < 100 ||
    filters.positionRatingMin > 0 ||
    filters.positionRatingMax < 100 ||
    Object.values(filters.attrFilters).some(v => v > 0) ||
    Object.values(filters.attrFiltersMax).some(v => v < 100);

  return (
    <div className="flex flex-col gap-[22px]">
      <PageHeader
        title={isViewing ? 'MFL Agency' : 'My MFL Agency'}
        count={`(${filteredPlayers.length}${filteredPlayers.length !== players.length ? ` of ${players.length}` : ''} players)`}
        subtitle={
          isViewing || totalPages > 1 ? (
            <>
              {isViewing && <>Viewing <span className="font-mono text-sm text-fg-2">{walletAddress}</span> read-only</>}
              {isViewing && totalPages > 1 && ' · '}
              {totalPages > 1 && `Showing ${((currentPage - 1) * playersPerPage) + 1}–${Math.min(currentPage * playersPerPage, filteredPlayers.length)} of ${filteredPlayers.length} players`}
            </>
          ) : undefined
        }
      />

      {isLoading && (
        <Panel className="flex items-center justify-center gap-3 py-12 text-muted">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-accent border-t-transparent"></div>
          <span>{isViewing ? "Loading this wallet's players..." : 'Loading your players from database...'}</span>
        </Panel>
      )}

      {error && (
        <div className="rounded-[22px] border border-red-500/40 bg-red-500/10 p-5">
          <p className="m-0 text-danger-ink">{error}</p>
          <button onClick={fetchMFLPlayers} className={`${btnSecondary} mt-3`}>
            Try Again
          </button>
        </div>
      )}

      {!isLoading && !error && hasAttemptedLoad && players.length === 0 && isViewing && (
        <Panel className="flex flex-col items-center gap-2 px-6 py-12 text-center">
          <h3 className="m-0 font-display text-xl font-bold text-fg">No players in this wallet</h3>
          <p className="m-0 text-muted">MFL lists no players owned by this wallet.</p>
        </Panel>
      )}

      {!isLoading && !error && hasAttemptedLoad && players.length === 0 && !isViewing && !isSyncing && (
        <Panel className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <svg className="w-14 h-14 text-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
          </svg>
          <h3 className="m-0 font-display text-xl font-bold text-fg">No Players Found</h3>
          <p className="m-0 text-muted">No players found in your agency. Try syncing your data.</p>
          <button onClick={handleSyncPlayers} className={btnPrimary}>
            Sync Players
          </button>
        </Panel>
      )}

      {!isLoading && !error && hasAttemptedLoad && players.length === 0 && !isViewing && isSyncing && (
        <Panel className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <div className="animate-spin rounded-full h-14 w-14 border-2 border-accent border-t-transparent"></div>
          <h3 className="m-0 font-display text-xl font-bold text-fg">Syncing Your Players</h3>

          {/* Show detailed sync progress */}
          {syncProgress.length > 0 ? (
            <div className="mt-2 space-y-3 w-full max-w-2xl">
              {syncProgress
                .filter(p => p.status === 'in_progress' || p.status === 'pending')
                .sort((a, b) => {
                  const statusOrder = { 'in_progress': 0, 'pending': 1 }
                  return (statusOrder[a.status as keyof typeof statusOrder] ?? 2) -
                         (statusOrder[b.status as keyof typeof statusOrder] ?? 2)
                })
                .map((item, index) => (
                  <div key={`${item.dataType}-${index}`} className="text-left">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-fg capitalize">
                        {item.dataType.split(':')[0].replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs text-muted">
                        {item.progress}%
                      </span>
                    </div>
                    <div className="w-full h-2 mb-1 rounded-full border border-line-3 bg-field overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent transition-all duration-300"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                    <p className="m-0 text-sm text-muted">
                      {item.message || 'Processing...'}
                    </p>
                  </div>
                ))}

              {syncProgress.filter(p => p.status === 'in_progress' || p.status === 'pending').length === 0 && (
                <p className="m-0 text-muted">
                  Preparing sync...
                </p>
              )}
            </div>
          ) : (
            <p className="m-0 text-muted">
              Initializing sync...
            </p>
          )}

          <div className="mt-2 px-4 py-3 rounded-xl border border-[var(--badge-line)] bg-[var(--badge-bg)]">
            <p className="m-0 text-sm text-accent-soft">
              💡 You can navigate to other pages while data syncs in the background
            </p>
          </div>
        </Panel>
      )}

      {!isLoading && !error && players.length > 0 && (
        <Panel className="overflow-hidden">
          <div className="px-[18px] py-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <SearchField
                placeholder="Search filter players..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />

              <div className="flex items-center gap-4 justify-end">
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
                    className="text-sm font-semibold text-accent-ink hover:text-accent-hover cursor-pointer"
                    title="Reset filters"
                  >
                    Reset Filters
                  </button>
                )}

                <button className={btnSecondary} onClick={() => setShowFilters(!showFilters)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path d="M4 6h16M7 12h10M10 18h4" />
                  </svg>
                  {showFilters ? 'Hide Filters' : 'Show Filters'}
                </button>
              </div>
            </div>

            {/* Filters Panel */}
            {showFilters && (
              <div className="mt-4 pt-4 border-t border-line">
                <PlayerFilters
                  filters={filters}
                  onFiltersChange={setFilters}
                  showSidebarFilters={true}
                  includeRetired={includeRetired}
                  onIncludeRetiredChange={setIncludeRetired}
                  excludeRetiring={excludeRetiring}
                  onExcludeRetiringChange={setExcludeRetiring}
                />
              </div>
            )}
          </div>
          {displayedPlayers.length === 0 && searchTerm ? (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center border-t border-line">
              <svg className="w-12 h-12 text-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <h3 className="m-0 font-display text-lg font-bold text-fg">
                No players found
              </h3>
              <p className="m-0 text-muted">
                No players match your search for &ldquo;{searchTerm}&rdquo;
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className={tableClass}>
                  <thead>
                    <tr className={theadRowClass}>
                      {sortHeader('name', 'Player')}
                      {sortHeader('overall', 'Overall')}
                      {sortHeader('positions', 'Positions')}
                      {sortHeader('age', 'Age')}
                      {statColumns.map(column => sortHeader(column.field, column.label, 'center'))}
                      {sortHeader('club', 'Club')}
                    </tr>
                  </thead>
                  <tbody>
                    {displayedPlayers.map((player) => (
                      <tr key={player.id} className={rowClass}>
                        <td className={`${tdClass} pl-[18px]`}>
                          <div className="flex items-center gap-3 min-w-0">
                            <InitialsAvatar name={formatPlayerName(player)} />
                            <div className="flex flex-col gap-0.5 min-w-0">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={(e) => {
                                    if (e.ctrlKey || e.metaKey) {
                                      // Open in new window/tab when Ctrl/Cmd is held
                                      window.open(`/players/${player.id}`, '_blank');
                                    } else {
                                      // Normal navigation
                                      router.push(`/players/${player.id}`);
                                    }
                                  }}
                                  className="p-0 border-0 bg-transparent text-[15px] font-bold text-fg hover:text-accent-ink transition-colors cursor-pointer whitespace-nowrap"
                                >
                                  {formatPlayerName(player)}
                                </button>
                                <RetirementIcon retirementYears={player.metadata.retirementYears} currentSeason={season} />
                              </div>
                              <div className="font-mono text-xs text-muted-3">
                                ID {player.id}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className={tdClass}>
                          <OverallRatingTooltip player={player} className="inline-block">
                            <TierBadge value={player.metadata.overall} size="lg" />
                          </OverallRatingTooltip>
                        </td>
                        <td className={tdClass}>
                          {(() => {
                            const positionRatings = getAllPositionRatings(player);
                            return (
                              <div className="flex flex-wrap items-center gap-1.5">
                                {rankPositionRatings(
                                  player.metadata.positions,
                                  position => positionRatings[position as MFLPosition]?.ovr ?? 0
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
                            );
                          })()}
                        </td>
                        <td className={`${tdClass} text-sm font-semibold text-fg-3`}>
                          {player.metadata.age}
                        </td>
                        {statColumns.map(column => (
                          <td key={column.field} className={`${tdClass} text-center`}>
                            {renderAttributeValue(player, player.metadata[column.field])}
                          </td>
                        ))}
                        <td className={`${tdClass} pr-[18px] text-sm text-fg-2 max-w-[220px] truncate`}>
                          {getClubName(player)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between gap-3 px-[18px] py-3 border-t border-line">
                  <p className="hidden sm:block m-0 text-sm text-muted">
                    Showing{' '}
                    <span className="font-semibold text-fg">{((currentPage - 1) * playersPerPage) + 1}</span>
                    {' '}to{' '}
                    <span className="font-semibold text-fg">{Math.min(currentPage * playersPerPage, filteredPlayers.length)}</span>
                    {' '}of{' '}
                    <span className="font-semibold text-fg">{filteredPlayers.length}</span>
                    {' '}results
                  </p>
                  <nav className="flex items-center gap-1.5 ml-auto" aria-label="Pagination">
                    <button onClick={goToPreviousPage} disabled={currentPage === 1} className={pageButtonClass(false)}>
                      <span className="sr-only">Previous</span>
                      <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>

                    {/* Page numbers */}
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }

                      return (
                        <button
                          key={pageNum}
                          onClick={() => goToPage(pageNum)}
                          className={pageButtonClass(currentPage === pageNum)}
                        >
                          {pageNum}
                        </button>
                      );
                    })}

                    <button onClick={goToNextPage} disabled={currentPage === totalPages} className={pageButtonClass(false)}>
                      <span className="sr-only">Next</span>
                      <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </nav>
                </div>
              )}

              {/* Export to Excel Button */}
              <div className="flex justify-end px-[18px] py-3.5 border-t border-line">
                <button
                  onClick={exportToExcel}
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-full border border-pos-line bg-btn-pos text-pos-ink text-[13px] font-bold cursor-pointer transition-colors hover:border-line-hover"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export to Excel
                </button>
              </div>
            </>
          )}
        </Panel>
      )}
    </div>
  );
};

export default AgencyPage;
