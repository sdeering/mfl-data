'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/src/contexts/WalletContext';
import { clubPlayersService, ClubPlayer } from '@/src/services/clubPlayersService';
import { clubsService } from '@/src/services/clubsService';
import { OverallRatingTooltip } from './OverallRatingTooltip';
import { PlayerFilters, FilterState, applyFilters } from './PlayerFilters';
import { MFLPlayer } from '../types/mflApi';

interface ClubPlayersPageProps {
  clubId: string;
}

export default function ClubPlayersPage({ clubId }: ClubPlayersPageProps) {
  const router = useRouter();
  const { isConnected, account } = useWallet();
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

  useEffect(() => {
    if (!isConnected || !account) {
      router.push('/');
      return;
    }

    fetchClubPlayers();
  }, [clubId, isConnected, account]);

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

  const getSortIndicator = (field: string) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  // Tier color function (same as AgencyPage)
  const getTierColor = (rating: number) => {
    if (rating >= 95) {
      return {
        bg: 'bg-[#87f6f8]',
        text: 'text-black',
        border: 'border-[var(--tier-common-foreground)]/15'
      };
    } else if (rating >= 85) {
      return {
        bg: 'bg-[#fa53ff]',
        text: 'text-white',
        border: 'border-[var(--tier-common-foreground)]/15'
      };
    } else if (rating >= 75) {
      return {
        bg: 'bg-[#0047ff]',
        text: 'text-white',
        border: 'border-[var(--tier-common-foreground)]/15'
      };
    } else if (rating >= 65) {
      return {
        bg: 'bg-[#71ff30]',
        text: 'text-black',
        border: 'border-[var(--tier-common-foreground)]/15'
      };
    } else if (rating >= 55) {
      return {
        bg: 'bg-[#ecd17f]',
        text: 'text-black',
        border: 'border-[var(--tier-common-foreground)]/15'
      };
    } else {
      return {
        bg: 'bg-[#9f9f9f]',
        text: 'text-white',
        border: 'border-[var(--tier-common-foreground)]/15'
      };
    }
  };

  // Helper function to check if player is goalkeeper
  const isGoalkeeper = (player: ClubPlayer) => {
    return player.metadata.positions?.includes('GK') || player.metadata.positions?.[0] === 'GK';
  };

  // Helper function to render attribute values (show dash for GK non-goalkeeping stats)
  const renderAttributeValue = (player: ClubPlayer, value: number) => {
    if (isGoalkeeper(player) && value === 0) {
      return (
        <div className="flex items-center justify-center rounded-lg shadow-sm px-2 py-1 text-center font-bold w-12 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
          -
        </div>
      );
    }
    
    const tierColors = getTierColor(value);
    return (
      <div className={`flex items-center justify-center rounded-lg shadow-sm px-2 py-1 text-center font-bold w-12 ${tierColors.bg} ${tierColors.text} ${tierColors.border}`}>
        {value}
      </div>
    );
  };

  // Helper function to get division name
  const getDivisionName = (division: number) => {
    return clubsService.getDivisionName(division);
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Wallet Not Connected
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Please connect your wallet to view club players.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Error Loading Club Players
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={() => {
              clubPlayersService.clearCache(clubId);
              fetchClubPlayers();
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <div className="mb-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {clubInfo ? `${clubInfo.name} (${filteredPlayers.length}${filteredPlayers.length !== players.length ? ` of ${players.length}` : ''} Players)` : `Club ${clubId} (${filteredPlayers.length}${filteredPlayers.length !== players.length ? ` of ${players.length}` : ''} Players)`}
          </h1>
          {clubInfo && (
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {clubInfo.city}, {clubInfo.country} • {getDivisionName(clubInfo.division)}
            </p>
          )}
        </div>

      </div>

      {/* Loading State */}
      {isLoadingPlayers && (
        <div className="text-center py-12">
          <div className="text-gray-400 dark:text-gray-500 text-lg">
            Loading club players...
          </div>
        </div>
      )}

      {/* Players Table */}
      {!isLoadingPlayers && filteredPlayers.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 dark:text-gray-500 text-lg">
            {players.length === 0 ? 'No players found for this club.' : 'No players match the current filters.'}
          </div>
        </div>
      )}

      {!isLoadingPlayers && filteredPlayers.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {/* Filters Section */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              {/* Search Input - moved to left */}
              <div className="relative flex-shrink-0">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search players..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-64 pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              
              {/* Filters Button and Reset Button Row */}
              <div className="flex items-center gap-4 flex-1 justify-end">
                {/* Filters Button */}
                <button
                  className="text-left px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer whitespace-nowrap"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  {showFilters ? 'Hide Filters' : 'Show Filters'}
                </button>
                
                {/* Reset Filters Button - on the right of filters button */}
                {(() => {
                  const isFiltersActive = 
                    filters.filterPosition !== 'all' ||
                    filters.selectedCardTypes.length > 0 ||
                    filters.overallMin > 0 ||
                    filters.overallMax < 100 ||
                    filters.positionRatingMin > 0 ||
                    filters.positionRatingMax < 100 ||
                    Object.values(filters.attrFilters).some(v => v > 0) ||
                    Object.values(filters.attrFiltersMax).some(v => v < 100);
                  
                  if (!isFiltersActive) return null;
                  
                  return (
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
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                      title="Reset filters"
                    >
                      Reset Filters
                    </button>
                  );
                })()}
              </div>
            </div>
            
            {/* Filters Panel */}
            {showFilters && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <PlayerFilters
                  filters={filters}
                  onFiltersChange={setFilters}
                  showSidebarFilters={true}
                />
              </div>
            )}
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th
                    className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Player</span>
                      {getSortIndicator('name') && (
                        <span className="text-blue-600 dark:text-blue-400">
                          {getSortIndicator('name')}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none"
                    onClick={() => handleSort('overall')}
                  >
                    <div className="flex items-center justify-center space-x-1">
                      <span>Overall</span>
                      {getSortIndicator('overall') && (
                        <span className="text-blue-600 dark:text-blue-400">
                          {getSortIndicator('overall')}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none"
                    onClick={() => handleSort('age')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Age</span>
                      {getSortIndicator('age') && (
                        <span className="text-blue-600 dark:text-blue-400">
                          {getSortIndicator('age')}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none"
                  >
                    Positions
                  </th>
                  <th
                    className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none w-20"
                    onClick={() => handleSort('pace')}
                  >
                    <div className="flex items-center justify-center space-x-1">
                      <span>Pace</span>
                      {getSortIndicator('pace') && (
                        <span className="text-blue-600 dark:text-blue-400">
                          {getSortIndicator('pace')}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none w-20"
                    onClick={() => handleSort('shooting')}
                  >
                    <div className="flex items-center justify-center space-x-1">
                      <span>Shooting</span>
                      {getSortIndicator('shooting') && (
                        <span className="text-blue-600 dark:text-blue-400">
                          {getSortIndicator('shooting')}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none w-20"
                    onClick={() => handleSort('passing')}
                  >
                    <div className="flex items-center justify-center space-x-1">
                      <span>Passing</span>
                      {getSortIndicator('passing') && (
                        <span className="text-blue-600 dark:text-blue-400">
                          {getSortIndicator('passing')}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none w-20"
                    onClick={() => handleSort('dribbling')}
                  >
                    <div className="flex items-center justify-center space-x-1">
                      <span>Dribbling</span>
                      {getSortIndicator('dribbling') && (
                        <span className="text-blue-600 dark:text-blue-400">
                          {getSortIndicator('dribbling')}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none w-20"
                    onClick={() => handleSort('defense')}
                  >
                    <div className="flex items-center justify-center space-x-1">
                      <span>Defense</span>
                      {getSortIndicator('defense') && (
                        <span className="text-blue-600 dark:text-blue-400">
                          {getSortIndicator('defense')}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none w-20"
                    onClick={() => handleSort('physical')}
                  >
                    <div className="flex items-center justify-center space-x-1">
                      <span>Physical</span>
                      {getSortIndicator('physical') && (
                        <span className="text-blue-600 dark:text-blue-400">
                          {getSortIndicator('physical')}
                        </span>
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredPlayers.map((player) => {
                  const tierColors = getTierColor(player.metadata.overall);
                  return (
                    <tr key={player.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div
                          className="text-lg font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 cursor-pointer"
                          onClick={(e) => {
                            if (e.ctrlKey || e.metaKey) {
                              window.open(`/players/${player.id}`, '_blank');
                            } else {
                              router.push(`/players/${player.id}`);
                            }
                          }}
                        >
                          {player.metadata.firstName} {player.metadata.lastName}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          ID: {player.id}
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-center">
                        <OverallRatingTooltip player={player}>
                          <div className={`flex items-center justify-center rounded-lg shadow-sm px-2 py-1 text-center font-bold w-12 ${tierColors.bg} ${tierColors.text} ${tierColors.border}`}>
                            {player.metadata.overall}
                          </div>
                        </OverallRatingTooltip>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {player.metadata.age}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {player.metadata.positions?.join(', ') || 'N/A'}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap w-20 text-center">
                        {renderAttributeValue(player, player.metadata.pace)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap w-20 text-center">
                        {renderAttributeValue(player, player.metadata.shooting)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap w-20 text-center">
                        {renderAttributeValue(player, player.metadata.passing)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap w-20 text-center">
                        {renderAttributeValue(player, player.metadata.dribbling)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap w-20 text-center">
                        {renderAttributeValue(player, player.metadata.defense)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap w-20 text-center">
                        {renderAttributeValue(player, player.metadata.physical)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
