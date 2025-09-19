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
  // Per-club state for parallel loading across all clubs
  const [clubFilteredMatches, setClubFilteredMatches] = useState<{[clubId: string]: MFLMatch[]}>({});
  const [clubOpponentFormations, setClubOpponentFormations] = useState<{[clubId: string]: {[key: string]: string[]}}>({});
  const [clubOpponentMatchResults, setClubOpponentMatchResults] = useState<{[clubId: string]: {[key: string]: MFLMatch[]}}>({});
  const [clubLoadingOpponents, setClubLoadingOpponents] = useState<{[clubId: string]: { current: number, total: number }}>({});
  const [syncStatus, setSyncStatus] = useState<{ message: string; progress?: number } | null>(null);
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
    setSyncStatus({ message: 'Loading clubs…' });
    
    try {
      console.log('🔍 SUPABASE: Fetching clubs for wallet:', account);
      const clubsData = await supabaseDataService.getClubsForWallet(account);
      console.log('🔍 SUPABASE: Retrieved clubs:', clubsData);
      
      setClubs(clubsData);
      
      if (clubsData.length > 0) {
        // Also kick off per-club opponent syncs in parallel
        startAllClubsFetch(clubsData);
      }
    } catch (err) {
      console.error('Error fetching clubs:', err);
      setError('Failed to load clubs');
    } finally {
      setIsLoading(false);
      // Keep status until next step sets it
    }
  };

  // Trigger fetch for upcoming matches and opponents for a single club
  const fetchForClub = async (clubId: string, clubName: string) => {
    try {
      // Load upcoming matches (same source; filter for this club and next 48h)
      const matches = await supabaseDataService.getUpcomingMatches(account!);
      const now = new Date();
      const twoDaysFromNow = new Date(now.getTime() + 48 * 60 * 60 * 1000);
      const filtered = matches.filter(m => {
        if (!m.startDate) return false;
        const matchDate = new Date(m.startDate);
        const involvesClub = m.homeTeamName === clubName || m.awayTeamName === clubName;
        return involvesClub && matchDate >= now && matchDate <= twoDaysFromNow;
      }).sort((a, b) => new Date(a.startDate!).getTime() - new Date(b.startDate!).getTime());

      setClubFilteredMatches(prev => ({ ...prev, [clubId]: filtered }));

      // Now fetch opponent formations/results for this club's filtered matches
      if (filtered.length === 0) return;

      const formations: { [key: string]: string[] } = {};
      const matchResults: { [key: string]: MFLMatch[] } = {};

      const uniqueOpponents = new Set<string>();
      const opponentSquadIds = new Map<string, number>();
      filtered.forEach(match => {
        const opponentName = match.homeTeamName === clubName ? match.awayTeamName : match.homeTeamName;
        const opponentSquadId = match.homeTeamName === clubName ? match.awaySquad.id : match.homeSquad.id;
        uniqueOpponents.add(opponentName);
        opponentSquadIds.set(opponentName, opponentSquadId);
      });

      const totalOpponents = uniqueOpponents.size;
      const totalMatchesToLoad = totalOpponents * 5;
      setClubLoadingOpponents(prev => ({ ...prev, [clubId]: { current: 0, total: totalMatchesToLoad } }));

      let currentMatchesLoaded = 0;
      for (const opponentName of uniqueOpponents) {
        const squadId = opponentSquadIds.get(opponentName)!;
        try {
          const opponentMatches = await supabaseDataService.getMatchesData(squadId.toString(), 'previous');
          const last5Matches = opponentMatches.slice(0, 5);
          matchResults[opponentName] = last5Matches;
          const oppForms: string[] = [];
          for (const om of last5Matches) {
            const formation = await supabaseDataService.getMatchFormation(om.id.toString());
            if (formation) oppForms.push(formation);
            currentMatchesLoaded++;
            setClubLoadingOpponents(prev => ({ ...prev, [clubId]: { current: currentMatchesLoaded, total: totalMatchesToLoad } }));
          }
          formations[opponentName] = oppForms;
        } catch (e) {
          formations[opponentName] = [];
          matchResults[opponentName] = [];
        }
      }

      setClubOpponentFormations(prev => ({ ...prev, [clubId]: formations }));
      setClubOpponentMatchResults(prev => ({ ...prev, [clubId]: matchResults }));
      setClubLoadingOpponents(prev => ({ ...prev, [clubId]: { current: 0, total: 0 } }));
    } catch (e) {
      // ignore per-club errors
    }
  };

  const startAllClubsFetch = (clubsData: any[]) => {
    // Fire and forget per-club to allow progressive rendering
    for (const c of clubsData) {
      const id = c.club.id.toString();
      const name = c.club.name as string;
      fetchForClub(id, name);
    }
  };

  const fetchUpcomingMatches = async (_clubId: string) => {};

  const fetchOpponentFormations = async (_matches: MFLMatch[]) => {};

  useEffect(() => {
    if (isConnected && account) {
      fetchClubs();
    }
  }, [isConnected, account]);

  // Keep existing selectedClub logic if needed, but not required for per-club rendering

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
      {syncStatus && (
        <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{syncStatus.message}</span>
            {typeof syncStatus.progress === 'number' && (
              <span className="text-xs">{Math.round(syncStatus.progress * 100)}%</span>
            )}
          </div>
          {typeof syncStatus.progress === 'number' && (
            <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2 mt-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.round(syncStatus.progress * 100)}%` }}
              />
            </div>
          )}
        </div>
      )}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Match Tactics</h1>
        <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-3">
          <a
            href="https://mfl-coach.com/formation-meta"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-blue-600 dark:hover:text-blue-300"
            title="Formation meta"
          >
            Formation meta
          </a>
          <span>Powered by Database</span>
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

      {/* Upcoming Matches for all clubs (progressive rendering) */}
      {clubs.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Upcoming Matches (Next 48 Hours)</h2>
          </div>
          {clubs.map((clubData) => {
            const clubId = clubData.club.id.toString();
            const thisClubName = clubData.club.name as string;
            const list = clubFilteredMatches[clubId] || [];
            return (
              <div key={clubId} className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{thisClubName}</h3>
                {list.length === 0 ? (
                  <p className="text-gray-600 dark:text-gray-400">No upcoming matches in the next 48 hours.</p>
                ) : (
                  <div className="space-y-4">
                    {list.map((match, index) => {
                      const clubName = thisClubName;
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
                    {clubLoadingOpponents[clubId] && clubLoadingOpponents[clubId].total > 0 && (
                      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                            Loading opponents matches ({clubLoadingOpponents[clubId].current}/{clubLoadingOpponents[clubId].total})...
                          </span>
                          <span className="text-xs text-blue-600 dark:text-blue-300">
                            {Math.round((clubLoadingOpponents[clubId].current / clubLoadingOpponents[clubId].total) * 100)}%
                          </span>
                        </div>
                        <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${(clubLoadingOpponents[clubId].current / clubLoadingOpponents[clubId].total) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Opponent Recent Performance */}
                    {clubOpponentFormations[clubId] && clubOpponentFormations[clubId][opponentName] && clubOpponentMatchResults[clubId] && clubOpponentMatchResults[clubId][opponentName] && (
                      <div className="mt-4">
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                          {opponentName} (Last 5 matches):
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {clubOpponentFormations[clubId][opponentName].map((formation, formationIndex) => {
                            const opponentMatch = clubOpponentMatchResults[clubId][opponentName][formationIndex];
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
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MatchesTacticsPageSupabase;
