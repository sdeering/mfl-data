"use client";

import React, { useState, useEffect } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useRouter } from 'next/navigation';
import { supabaseDataService } from '../services/supabaseDataService';
import { MFLMatch } from '../services/matchesService';

const MatchesTacticsPageSupabase: React.FC = () => {
  const { isConnected, account } = useWallet();
  const [clubs, setClubs] = useState<any[]>([]);
  const [allUpcomingMatches, setAllUpcomingMatches] = useState<MFLMatch[]>([]);
  const [filteredMatches, setFilteredMatches] = useState<MFLMatch[]>([]);
  const [selectedClub, setSelectedClub] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opponentFormations, setOpponentFormations] = useState<{[key: string]: string[]}>({});
  const [opponentMatchResults, setOpponentMatchResults] = useState<{[key: string]: MFLMatch[]}>({});
  const [loadingOpponents, setLoadingOpponents] = useState({ current: 0, total: 0 });
  const router = useRouter();

  // Add a state to track if we've given enough time for wallet initialization
  const [hasCheckedWallet, setHasCheckedWallet] = useState(false);

  // Check wallet connection with delay to allow initialization
  useEffect(() => {
    const timer = setTimeout(() => {
      setHasCheckedWallet(true);
    }, 1500); // Give 1.5 seconds for wallet to initialize
    
    return () => clearTimeout(timer);
  }, []);

  // Redirect if wallet not connected
  useEffect(() => {
    if (hasCheckedWallet && !isConnected) {
      router.push('/');
    }
  }, [isConnected, hasCheckedWallet, router]);

  const fetchClubs = async () => {
    if (!account) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('🔍 SUPABASE: Fetching clubs for wallet:', account);
      const clubsData = await supabaseDataService.getClubsForWallet(account);
      console.log('🔍 SUPABASE: Retrieved clubs:', clubsData);
      
      setClubs(clubsData);
      
      if (clubsData.length > 0) {
        setSelectedClub(clubsData[0].club.id.toString());
      }
    } catch (err) {
      console.error('Error fetching clubs:', err);
      setError('Failed to load clubs');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUpcomingMatches = async (clubId: string) => {
    if (!clubId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('🔍 SUPABASE: Fetching upcoming matches for club:', clubId);
      const matches = await supabaseDataService.getUpcomingMatches(account!);
      console.log('🔍 SUPABASE: Retrieved upcoming matches:', matches);
      
      // Filter matches for next 48 hours
      const now = new Date();
      const twoDaysFromNow = new Date(now.getTime() + 48 * 60 * 60 * 1000);
      
      const filteredMatches = matches.filter(match => {
        if (!match.startDate) return false;
        const matchDate = new Date(match.startDate);
        return matchDate >= now && matchDate <= twoDaysFromNow;
      });
      
      // Sort by date
      filteredMatches.sort((a, b) => {
        if (!a.startDate || !b.startDate) return 0;
        return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
      });
      
      setAllUpcomingMatches(matches);
      setFilteredMatches(filteredMatches);
      
      // Fetch opponent formations for filtered matches
      await fetchOpponentFormations(filteredMatches);
    } catch (err) {
      console.error('Error fetching upcoming matches:', err);
      setError('Failed to load upcoming matches');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchOpponentFormations = async (matches: MFLMatch[]) => {
    if (matches.length === 0) return;

    const formations: { [key: string]: string[] } = {};
    const matchResults: { [key: string]: MFLMatch[] } = {};
    
    // Get unique opponents
    const uniqueOpponents = new Set<string>();
    const opponentSquadIds = new Map<string, number>();
    
    matches.forEach(match => {
      const opponentName = match.homeTeamName === match.clubName ? match.awayTeamName : match.homeTeamName;
      const opponentSquadId = match.homeTeamName === match.clubName ? match.awaySquad.id : match.homeSquad.id;
      uniqueOpponents.add(opponentName);
      opponentSquadIds.set(opponentName, opponentSquadId);
    });

    const totalOpponents = uniqueOpponents.size;
    const totalMatchesToLoad = totalOpponents * 5; // 5 matches per opponent

    setLoadingOpponents({ current: 0, total: totalMatchesToLoad });
    
    console.log('🔍 SUPABASE: Starting to fetch opponent data for', matches.length, 'matches');
    console.log('🔍 SUPABASE: Found', totalOpponents, 'unique opponents');
    
    let currentMatchesLoaded = 0;
    
    for (const match of matches) {
      const opponentName = match.homeTeamName === match.clubName ? match.awayTeamName : match.homeTeamName;
      const opponentSquadId = match.homeTeamName === match.clubName ? match.awaySquad.id : match.homeSquad.id;
      
      console.log(`🔍 SUPABASE: Processing opponent "${opponentName}" with squad ID ${opponentSquadId}`);
      
      if (!formations[opponentName]) {
        
        try {
          // Fetch opponent's last 5 matches using Supabase
          console.log(`🔍 SUPABASE: Fetching past matches for squad ${opponentSquadId}...`);
          const opponentMatches = await supabaseDataService.getMatchesData(opponentSquadId.toString(), 'previous');
          const last5Matches = opponentMatches.slice(0, 5);
          
          console.log(`🔍 SUPABASE: Found ${last5Matches.length} past matches for ${opponentName}:`, last5Matches);
          matchResults[opponentName] = last5Matches;
          
          const opponentFormations: string[] = [];
          for (const opponentMatch of last5Matches) {
            console.log(`🔍 SUPABASE: Fetching formation for match ${opponentMatch.id}...`);
            const formation = await supabaseDataService.getMatchFormation(opponentMatch.id.toString());
            if (formation) {
              console.log(`🔍 SUPABASE: Found formation "${formation}" for match ${opponentMatch.id}`);
              opponentFormations.push(formation);
            } else {
              console.log(`🔍 SUPABASE: No formation found for match ${opponentMatch.id}`);
            }
            
            currentMatchesLoaded++;
            setLoadingOpponents({ current: currentMatchesLoaded, total: totalMatchesToLoad });
          }
          
          formations[opponentName] = opponentFormations;
          console.log(`🔍 SUPABASE: Final formations for ${opponentName}:`, opponentFormations);
        } catch (error) {
          console.error(`Error fetching data for ${opponentName}:`, error);
          formations[opponentName] = [];
          matchResults[opponentName] = [];
        }
      }
    }
    
    console.log('🔍 SUPABASE: Final formations data:', formations);
    console.log('🔍 SUPABASE: Final match results data:', matchResults);
    
    setOpponentFormations(formations);
    setOpponentMatchResults(matchResults);
    setLoadingOpponents({ current: 0, total: 0 });
  };

  useEffect(() => {
    if (isConnected && account) {
      fetchClubs();
    }
  }, [isConnected, account]);

  useEffect(() => {
    if (selectedClub) {
      fetchUpcomingMatches(selectedClub);
    }
  }, [selectedClub]);

  if (!hasCheckedWallet) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Initializing wallet connection...</p>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Wallet Not Connected</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">Please connect your wallet to view match tactics.</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  if (isLoading && clubs.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading your clubs...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">Error</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Match Tactics</h1>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Powered by Database
        </div>
      </div>

      {/* Club Selection */}
      {clubs.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Select Club</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clubs.map((clubData) => (
              <button
                key={clubData.club.id}
                onClick={() => setSelectedClub(clubData.club.id.toString())}
                className={`p-4 rounded-lg border-2 transition-all ${
                  selectedClub === clubData.club.id.toString()
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="text-center">
                  <h3 className="font-semibold text-gray-900 dark:text-white">{clubData.club.name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">ID: {clubData.club.id}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Matches */}
      {selectedClub && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Upcoming Matches (Next 48 Hours)</h2>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
              <span className="text-gray-600 dark:text-gray-400">Loading matches...</span>
            </div>
          ) : filteredMatches.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400 text-center py-8">No upcoming matches in the next 48 hours.</p>
          ) : (
            <div className="space-y-4">
              {filteredMatches.map((match, index) => {
                const clubName = clubs.find(c => c.club.id.toString() === selectedClub)?.club.name || 'Unknown Club';
                const opponentName = match.homeTeamName === clubName ? match.awayTeamName : match.homeTeamName;
                const opponentSquadId = match.homeTeamName === clubName ? match.awaySquad.id : match.homeSquad.id;
                
                return (
                  <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        <span className={match.homeTeamName === clubName ? 'font-bold' : ''} style={{ fontSize: match.homeTeamName === clubName ? '100%' : '90%' }}>
                          {match.homeTeamName}
                        </span>
                        {' vs '}
                        <span className={match.awayTeamName === clubName ? 'font-bold' : ''} style={{ fontSize: match.awayTeamName === clubName ? '100%' : '90%' }}>
                          {match.awayTeamName}
                        </span>
                      </h3>
                    </div>
                    
                    <div className="flex items-center space-x-4 mt-1">
                      {match.startDate && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                          {(() => {
                            const now = new Date();
                            const kickoff = new Date(match.startDate);
                            const diffMs = kickoff.getTime() - now.getTime();
                            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                            const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                            const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                            
                            if (diffMs < 0) {
                              return 'Started';
                            } else if (diffDays > 0) {
                              return (
                                <>
                                  Kickoff <span className="font-bold">{diffDays}d {diffHours}h</span>
                                </>
                              );
                            } else if (diffHours > 0) {
                              return (
                                <>
                                  Kickoff <span className="font-bold">{diffHours}h {diffMinutes}m</span>
                                </>
                              );
                            } else if (diffMinutes > 0) {
                              return (
                                <>
                                  Kickoff <span className="font-bold">{diffMinutes}m</span>
                                </>
                              );
                            } else {
                              return 'Starting now';
                            }
                          })()}
                        </span>
                      )}
                      {match.type && (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${
                          match.type === 'LEAGUE' 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                        }`}>
                          {match.type}
                        </span>
                      )}
                    </div>

                    {/* Opponent Performance Section */}
                    {loadingOpponents.total > 0 && (
                      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                            Loading opponents matches ({loadingOpponents.current}/{loadingOpponents.total})...
                          </span>
                          <span className="text-xs text-blue-600 dark:text-blue-300">
                            {Math.round((loadingOpponents.current / loadingOpponents.total) * 100)}%
                          </span>
                        </div>
                        <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${(loadingOpponents.current / loadingOpponents.total) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Opponent Recent Performance */}
                    {opponentFormations[opponentName] && opponentMatchResults[opponentName] && (
                      <div className="mt-4">
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                          {opponentName} (Last 5 matches):
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {opponentFormations[opponentName].map((formation, formationIndex) => {
                            const opponentMatch = opponentMatchResults[opponentName][formationIndex];
                            if (!opponentMatch) return null;

                            // Calculate match result
                            const isHome = opponentMatch.homeTeamName === opponentName;
                            const homeScore = opponentMatch.homeScore || 0;
                            const awayScore = opponentMatch.awayScore || 0;
                            let result = 'D';
                            if (opponentMatch.status === 'ENDED') {
                              if (homeScore > awayScore) {
                                result = isHome ? 'W' : 'L';
                              } else if (awayScore > homeScore) {
                                result = isHome ? 'L' : 'W';
                              }
                            }

                            // Format date (most recent first)
                            const matchDate = new Date(opponentMatch.startDate);
                            const dateStr = matchDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                            
                            // Determine if it was a home or away match
                            const isHomeMatch = opponentMatch.homeTeamName === opponentName;
                            const venue = isHomeMatch ? 'Home' : 'Away';
                            const venueBgColor = 'bg-gray-100 text-gray-700 dark:bg-gray-600 dark:text-gray-200';
                            
                            // Determine competition type
                            const competitionType = opponentMatch.competition?.name?.toLowerCase().includes('cup') ? 'Cup' : 'League';
                            
                            // Result background color
                            const resultBgColor = result === 'W' ? '!bg-[lab(60_-54.51_41.79)]' :
                                               result === 'L' ? '!bg-[#ec4b4b]' :
                                               '!bg-[#6e6b6b] dark:!bg-gray-500 dark:!text-[#f0f0f0]';
                            
                            return (
                              <div 
                                key={formationIndex} 
                                className={`flex flex-col items-center space-y-2 p-2 border border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer hover:opacity-80 transition-opacity duration-200 ${resultBgColor}`}
                                style={{ minWidth: '140px' }}
                                onClick={() => window.open(`https://app.playmfl.com/matches/${opponentMatch.id}`, '_blank')}
                                title={`View match details - ${dateStr}`}
                              >
                                <span className="text-sm text-white font-medium">
                                  {dateStr}
                                </span>
                                <span className="inline-flex items-center px-2 py-1 rounded text-base font-bold text-white">
                                  {result}
                                </span>
                                <div className="flex items-center space-x-1">
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-sm font-medium bg-gray-100 text-gray-700 dark:bg-gray-600 dark:text-gray-200">
                                    {competitionType}
                                  </span>
                                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-sm font-medium ${venueBgColor}`}>
                                    {venue}
                                  </span>
                                </div>
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-sm font-medium bg-gray-100 text-gray-700 dark:bg-gray-600 dark:text-gray-200">
                                  {formation}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MatchesTacticsPageSupabase;
