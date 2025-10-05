'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseDataService } from '../../../src/services/supabaseDataService';
import { MFLPlayer } from '../../../src/types/mflApi';
import { OverallRatingTooltip } from '../../../src/components/OverallRatingTooltip';
import * as XLSX from 'xlsx';

export default function DynamicAgencyPage() {
  const params = useParams();
  const router = useRouter();
  const walletAddress = params.walletAddress as string;
  
  const [players, setPlayers] = useState<MFLPlayer[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<MFLPlayer[]>([]);
  const [displayedPlayers, setDisplayedPlayers] = useState<MFLPlayer[]>([]);
  const [marketValues, setMarketValues] = useState<Map<number, number>>(new Map());
  const [marketValueDetails, setMarketValueDetails] = useState<Map<number, any>>(new Map());
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<string>('overall');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [playerCount, setPlayerCount] = useState(0);
  const playersPerPage = 50;

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

  // Helper function to get tier color based on rating value (same as PlayerStatsGrid)
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

  // Helper function to check if player is a goalkeeper
  const isGoalkeeper = (player: MFLPlayer) => {
    return player.metadata.positions.some(pos => pos.toLowerCase().includes('gk') || pos.toLowerCase().includes('goalkeeper'));
  };

  // Helper function to render attribute value (blank for GK non-goalkeeping stats)
  const renderAttributeValue = (player: MFLPlayer, value: number, isGoalkeepingStat: boolean = false) => {
    if (isGoalkeeper(player) && !isGoalkeepingStat && value === 0) {
      return <span className="text-gray-400 dark:text-gray-600">-</span>;
    }
    const tierColors = getTierColor(value);
    return (
      <div className={`flex items-center justify-center rounded-lg shadow-sm px-2 py-1 text-center font-bold w-12 ${tierColors.text} ${tierColors.bg} ${tierColors.border}`} style={{ fontSize: '16px' }}>
        {value}
      </div>
    );
  };

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
      case 'marketValue':
        return marketValues.get(player.id) || 0;
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
      const marketValue = marketValues.get(player.id);
      const playerMarketValueDetails = marketValueDetails.get(player.id);
      
      // Get position ratings and primary position
      const positionRatings = playerMarketValueDetails?.position_ratings || {};
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
        'Market Value': marketValue ? (marketValue === 0 ? 'No Data' : `$${marketValue.toLocaleString()}`) : 'Not Calculated',
        'Market Value Confidence': playerMarketValueDetails?.confidence === 'medium' ? 'N/A (Cached)' : (playerMarketValueDetails?.confidence || 'N/A'),
        'Club': getClubName(player),
        'Contract Status': player.activeContract ? 'Active' : 'No Contract',
        'Nationality': player.metadata.nationalities?.[0] || 'N/A',
        'Height': player.metadata.height || 'N/A',
        'Preferred Foot': player.metadata.preferredFoot || 'N/A',
        'Retirement Years': player.metadata.retirementYears || 'N/A'
      };
      
      // Add position rating columns at the end
      positionOrder.forEach(position => {
        const rating = positionRatings[position];
        if (rating && typeof rating === 'object' && rating.rating !== undefined) {
          (exportObj as any)[`${position} Rating`] = rating.rating;
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
      { wch: 15 }, // Market Value
      { wch: 20 }, // Market Value Confidence
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
    const filename = `agency-players-${walletAddress}-${timestamp}.xlsx`;

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

  // Fetch players for the specified wallet
  const fetchPlayers = async () => {
    if (!walletAddress) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`🔍 Fetching players for wallet: ${walletAddress}`);
      const playerData = await supabaseDataService.getAgencyPlayers(walletAddress);
      console.log(`📊 Fetched ${playerData.length} players for wallet: ${walletAddress}`);
      console.log('📊 Sample player data:', playerData[0]);
      
      setPlayers(playerData);
      setFilteredPlayers(playerData);
      setPlayerCount(playerData.length);
      
      // Fetch market values
      const marketValuesData = await supabaseDataService.getAgencyPlayerMarketValues(walletAddress);
      console.log('📊 Market values data:', marketValuesData);
      if (marketValuesData && marketValuesData.length > 0) {
        const marketValuesMap = new Map<number, number>();
        const marketValueDetailsMap = new Map<number, any>();
        
        marketValuesData.forEach((item: any) => {
          marketValuesMap.set(item.player_id, item.market_value);
          
          // Store detailed breakdown information for popup
          if (item.position_ratings) {
            marketValueDetailsMap.set(item.player_id, {
              market_value: item.market_value,
              position_ratings: item.position_ratings,
              confidence: item.confidence || 'medium',
              breakdown: {
                positionPremium: 0, // We don't store this in DB yet
                progressionPremium: 0,
                retirementPenalty: 0,
                newlyMintPremium: 0,
                pacePenalty: 0,
                pacePremium: 0,
                heightAdjustment: 0,
                comparableListings: 0,
                recentSales: 0
              },
              details: {
                baseValue: item.market_value,
                comparableListings: [],
                recentSales: [],
                comparableAverage: 0,
                recentSalesAverage: 0
              }
            });
          }
        });
        
        console.log('📊 Market values map:', marketValuesMap);
        console.log('📊 Market values map size:', marketValuesMap.size);
        console.log('📊 Sample market value entry:', Array.from(marketValuesMap.entries())[0]);
        setMarketValues(marketValuesMap);
        setMarketValueDetails(marketValueDetailsMap);
      } else {
        setMarketValues(new Map());
        setMarketValueDetails(new Map());
      }
      
    } catch (error: any) {
      console.error('❌ Error fetching players:', error);
      setError(`Failed to load players for wallet ${walletAddress}. ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Load players on component mount
  useEffect(() => {
    fetchPlayers();
  }, [walletAddress]);

  // Filter and sort players based on search term and sort settings
  useEffect(() => {
    let filtered = players;
    
    if (searchTerm.trim()) {
      filtered = players.filter(player => {
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
    
    // Reset to first page when search term changes
    setCurrentPage(1);
  }, [searchTerm, players, sortField, sortDirection, marketValues]);

  // Update displayed players based on current page
  useEffect(() => {
    const startIndex = (currentPage - 1) * playersPerPage;
    const endIndex = startIndex + playersPerPage;
    const paginatedPlayers = filteredPlayers.slice(startIndex, endIndex);
    setDisplayedPlayers(paginatedPlayers);
  }, [filteredPlayers, currentPage, playersPerPage]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600 dark:text-gray-400">Loading players...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            <strong>Error:</strong> {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Agency Players ({filteredPlayers.length}{filteredPlayers.length !== players.length ? ` of ${players.length}` : ''} players)
            </h1>
          </div>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Wallet: <span className="font-mono text-sm">{walletAddress}</span>
        </p>
        {totalPages > 1 && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Showing {((currentPage - 1) * playersPerPage) + 1}-{Math.min(currentPage * playersPerPage, filteredPlayers.length)} of {filteredPlayers.length} players
          </p>
        )}
      </div>

      {!isLoading && !error && players.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="relative flex-shrink-0">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      placeholder="Search filter players..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="block w-64 pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                </div>
              </div>

          {displayedPlayers.length === 0 && searchTerm ? (
            <div className="text-center py-8">
              <div className="text-gray-400 dark:text-gray-600 mb-4">
                <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No players found
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                No players match your search for "{searchTerm}"
              </p>
            </div>
          ) : (
            <>
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
                      {sortField === 'name' && (
                        <span className="text-blue-600 dark:text-blue-400">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none"
                    onClick={() => handleSort('overall')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Overall</span>
                      {sortField === 'overall' && (
                        <span className="text-blue-600 dark:text-blue-400">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none"
                    onClick={() => handleSort('positions')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Positions</span>
                      {sortField === 'positions' && (
                        <span className="text-blue-600 dark:text-blue-400">
                          {sortDirection === 'asc' ? '↑' : '↓'}
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
                      {sortField === 'age' && (
                        <span className="text-blue-600 dark:text-blue-400">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none w-20"
                    onClick={() => handleSort('pace')}
                  >
                    <div className="flex items-center justify-center space-x-1">
                      <span>Pace</span>
                      {sortField === 'pace' && (
                        <span className="text-blue-600 dark:text-blue-400">
                          {sortDirection === 'asc' ? '↑' : '↓'}
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
                      {sortField === 'shooting' && (
                        <span className="text-blue-600 dark:text-blue-400">
                          {sortDirection === 'asc' ? '↑' : '↓'}
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
                      {sortField === 'passing' && (
                        <span className="text-blue-600 dark:text-blue-400">
                          {sortDirection === 'asc' ? '↑' : '↓'}
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
                      {sortField === 'dribbling' && (
                        <span className="text-blue-600 dark:text-blue-400">
                          {sortDirection === 'asc' ? '↑' : '↓'}
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
                      {sortField === 'defense' && (
                        <span className="text-blue-600 dark:text-blue-400">
                          {sortDirection === 'asc' ? '↑' : '↓'}
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
                      {sortField === 'physical' && (
                        <span className="text-blue-600 dark:text-blue-400">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none"
                    onClick={() => handleSort('marketValue')}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1">
                        <span>Value</span>
                        {sortField === 'marketValue' && (
                          <span className="text-blue-600 dark:text-blue-400">
                            {sortDirection === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </div>
                  </th>
                  <th 
                    className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none"
                    onClick={() => handleSort('club')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Club</span>
                      {sortField === 'club' && (
                        <span className="text-blue-600 dark:text-blue-400">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {displayedPlayers.map((player) => (
                  <tr key={player.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div>
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
                          className="text-lg font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors cursor-pointer"
                        >
                          {formatPlayerName(player)}
                        </button>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          ID: {player.id}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {(() => {
                        const tierColors = getTierColor(player.metadata.overall);
                        return (
                          <OverallRatingTooltip player={player}>
                            <div className={`flex items-center justify-center rounded-lg shadow-sm px-2 py-1 text-center font-bold w-12 ${tierColors.text} ${tierColors.bg} ${tierColors.border}`} style={{ fontSize: '16px' }}>
                              {player.metadata.overall}
                            </div>
                          </OverallRatingTooltip>
                        );
                      })()}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        {formatPositions(player)}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {player.metadata.age}
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
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {(() => {
                        const marketValue = marketValues.get(player.id);
                        console.log(`🔍 Looking up market value for player ${player.id}:`, marketValue);
                        console.log(`🔍 Market values map has ${marketValues.size} entries`);
                        
                        if (marketValue) {
                          if (marketValue === 0) {
                            return (
                              <span className="font-semibold text-gray-500 dark:text-gray-400">
                                No Data
                              </span>
                            );
                          }
                          return (
                            <span className="font-semibold text-green-600 dark:text-green-400">
                              ${marketValue.toLocaleString()}
                            </span>
                          );
                        }
                        
                        return (
                          <span className="text-gray-400 dark:text-gray-500 text-xs">?</span>
                        );
                      })()}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {getClubName(player)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>

            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="bg-white dark:bg-gray-800 px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 sm:px-6">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={goToPreviousPage}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={goToNextPage}
                    disabled={currentPage === totalPages}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      Showing{' '}
                      <span className="font-medium">{((currentPage - 1) * playersPerPage) + 1}</span>
                      {' '}to{' '}
                      <span className="font-medium">{Math.min(currentPage * playersPerPage, filteredPlayers.length)}</span>
                      {' '}of{' '}
                      <span className="font-medium">{filteredPlayers.length}</span>
                      {' '}results
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                      <button
                        onClick={goToPreviousPage}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="sr-only">Previous</span>
                        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
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
                            className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                              currentPage === pageNum
                                ? 'z-10 bg-blue-50 dark:bg-blue-900 border-blue-500 dark:border-blue-400 text-blue-600 dark:text-blue-300'
                                : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                      
                      <button
                        onClick={goToNextPage}
                        disabled={currentPage === totalPages}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="sr-only">Next</span>
                        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
            
            {/* Export to Excel Button */}
            {players.length > 0 && (
              <div className="mt-6 mb-6 ml-6 flex justify-start">
                <button
                  onClick={exportToExcel}
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors duration-200"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export to Excel
                </button>
              </div>
            )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
