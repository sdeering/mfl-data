'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseDataService } from '../../../src/services/clientDataService';
import { MFLPlayer } from '../../../src/types/mflApi';
import { OverallRatingTooltip } from '../../../src/components/OverallRatingTooltip';
import {
  PageHeader,
  Panel,
  SearchField,
  TierBadge,
  PositionChip,
  InitialsAvatar,
  SortArrow,
  tableClass,
  theadRowClass,
  sortableThClass,
  rowClass,
  tdClass,
} from '../../../src/components/ui';
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
      <Panel className="flex items-center justify-center gap-3 py-12 text-muted">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-accent border-t-transparent"></div>
        <span>Loading players...</span>
      </Panel>
    );
  }

  if (error) {
    return (
      <div className="rounded-[22px] border border-red-500/40 bg-red-500/10 px-5 py-4 text-danger-ink">
        <strong>Error:</strong> {error}
      </div>
    );
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

  return (
    <div className="flex flex-col gap-[22px]">
      <PageHeader
        title="Agency Players"
        count={`(${filteredPlayers.length}${filteredPlayers.length !== players.length ? ` of ${players.length}` : ''} players)`}
        subtitle={
          <>
            Wallet: <span className="font-mono text-sm text-fg-2">{walletAddress}</span>
            {totalPages > 1 && (
              <>
                {' · '}Showing {((currentPage - 1) * playersPerPage) + 1}–{Math.min(currentPage * playersPerPage, filteredPlayers.length)} of {filteredPlayers.length} players
              </>
            )}
          </>
        }
      />

      {!isLoading && !error && players.length > 0 && (
        <Panel className="overflow-hidden">
          <div className="px-[18px] py-4">
            <SearchField
              placeholder="Search filter players..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
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
                      {sortHeader('marketValue', 'Value')}
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
                                className="p-0 border-0 bg-transparent text-left text-[15px] font-bold text-fg hover:text-accent-ink transition-colors cursor-pointer whitespace-nowrap"
                              >
                                {formatPlayerName(player)}
                              </button>
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
                          <div className="flex flex-wrap items-center gap-1.5">
                            {player.metadata.positions.map(position => (
                              <PositionChip key={position} position={position} />
                            ))}
                          </div>
                        </td>
                        <td className={`${tdClass} text-sm font-semibold text-fg-3`}>
                          {player.metadata.age}
                        </td>
                        {statColumns.map(column => (
                          <td key={column.field} className={`${tdClass} text-center`}>
                            {renderAttributeValue(player, player.metadata[column.field])}
                          </td>
                        ))}
                        <td className={`${tdClass} text-sm`}>
                          {(() => {
                            const marketValue = marketValues.get(player.id);
                            console.log(`🔍 Looking up market value for player ${player.id}:`, marketValue);
                            console.log(`🔍 Market values map has ${marketValues.size} entries`);

                            if (marketValue) {
                              if (marketValue === 0) {
                                return (
                                  <span className="font-semibold text-muted">
                                    No Data
                                  </span>
                                );
                              }
                              return (
                                <span className="font-semibold text-pos-ink">
                                  ${marketValue.toLocaleString()}
                                </span>
                              );
                            }

                            return (
                              <span className="text-faint text-xs">?</span>
                            );
                          })()}
                        </td>
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
}
