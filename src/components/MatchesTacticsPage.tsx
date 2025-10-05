"use client";

import React, { useState, useEffect } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useRouter } from 'next/navigation';
import { matchesService, MFLMatch } from '../services/matchesService';
import { clubsService } from '../services/clubsService';
import { preloadService } from '../services/preloadService';
import { opponentMatchesService } from '../services/opponentMatchesService';

const MatchesTacticsPage: React.FC = () => {
  const { isConnected, account } = useWallet();
  const [clubs, setClubs] = useState<any[]>([]);
  const [allUpcomingMatches, setAllUpcomingMatches] = useState<MFLMatch[]>([]);
  const [filteredMatches, setFilteredMatches] = useState<MFLMatch[]>([]);
  const [selectedClub, setSelectedClub] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [opponentFormations, setOpponentFormations] = useState<{[key: string]: string[]}>({});
  const [opponentMatchResults, setOpponentMatchResults] = useState<{[key: string]: MFLMatch[]}>({});
  const [loadingOpponents, setLoadingOpponents] = useState({ current: 0, total: 0 });
  const [preloadProgress, setPreloadProgress] = useState(preloadService.getProgress());
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

  // Subscribe to preload progress updates and start preloading
  useEffect(() => {
    const unsubscribe = preloadService.subscribe((progress) => {
      setPreloadProgress(progress);
    });

    // Start background preloading when component mounts and wallet is connected
    if (isConnected && hasCheckedWallet && account) {
      preloadService.startBackgroundPreload(account);
    }

    return unsubscribe;
  }, [isConnected, hasCheckedWallet, account]);

  // Only redirect if we've checked and wallet is still not connected
  useEffect(() => {
    if (hasCheckedWallet && !isConnected) {
      router.push('/');
    }
  }, [hasCheckedWallet, isConnected, router]);

  const fetchClubs = async () => {
    if (!account) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Use database data instead of API calls for instant loading
      console.log('🔍 Fetching clubs from database for wallet:', account);
      const { supabaseDataService } = await import('../services/supabaseDataService');
      
      // Clear cache to ensure we get fresh data
      supabaseDataService.clearCache(`clubs_${account}`);
      
      const clubsData = await supabaseDataService.getClubsForWallet(account);
      setClubs(clubsData);
      console.log('📊 Found', clubsData.length, 'clubs in database');
      
      if (clubsData.length === 0) {
        console.log('⚠️ No clubs found in database, this might be a cache issue or sync problem');
      }
    } catch (err) {
      console.error('Error fetching clubs:', err);
      setError('Failed to load clubs data');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAllUpcomingMatches = async () => {
    if (clubs.length === 0 || !selectedClub) return;
    
    setIsLoading(true);
    setError(null);
    setLoadingProgress({ current: 1, total: 1 });
    
    try {
      const allMatches: MFLMatch[] = [];
      
      // Find the selected club
      const selectedClubData = clubs.find(club => club.data?.club?.name === selectedClub);
      if (!selectedClubData) {
        console.log('Selected club not found:', selectedClub);
        return;
      }
      
      // Get all upcoming matches from database (already synced)
      console.log('🔍 Fetching upcoming matches from database for wallet:', account);
      const { supabaseDataService } = await import('../services/supabaseDataService');
      
      // Clear cache to ensure we get fresh data
      supabaseDataService.clearCache(`matches_${account}_all`);
      
      const allUpcomingMatches = await supabaseDataService.getUpcomingMatches(account);
      
      console.log('📊 Found', allUpcomingMatches.length, 'upcoming matches in database');
      
      if (allUpcomingMatches.length === 0) {
        console.log('⚠️ No upcoming matches found in database, this might be a cache issue or sync problem');
      }
      
      // Filter matches for the selected club
      const clubMatches = allUpcomingMatches.filter(match => {
        // Check if match involves the selected club
        const clubName = selectedClubData.data?.club?.name;
        const isClubMatch = match.homeTeamName === clubName || match.awayTeamName === clubName;
        
        if (isClubMatch) {
          console.log('🎯 Found club match:', {
            homeTeam: match.homeTeamName,
            awayTeam: match.awayTeamName,
            startDate: match.startDate,
            clubName
          });
        }
        
        return isClubMatch;
      });
      
      console.log('📊 Club matches found:', clubMatches.length, 'for club:', selectedClub);
      
      console.log('📊 Found', clubMatches.length, 'matches for club:', selectedClubData.data?.club?.name);
      
      // Add club information to each match
      const matchesWithClub = clubMatches.map(match => ({
        ...match,
        clubName: selectedClubData.data?.club?.name,
        clubId: selectedClubData.data?.club?.id
      }));
      
      allMatches.push(...matchesWithClub);
      
      // Filter matches to only include those in the next 48 hours (for tactics planning)
      const now = new Date();
      const fortyEightHoursFromNow = new Date(now.getTime() + (48 * 60 * 60 * 1000));
      
      console.log('Total matches fetched:', allMatches.length);
      console.log('Filtering from:', now.toISOString(), 'to:', fortyEightHoursFromNow.toISOString());
      
      const filteredMatches = allMatches.filter(match => {
        if (!match.startDate) {
          console.log('Match has no startDate:', match);
          return false;
        }
        const matchDate = new Date(match.startDate);
        const isInRange = matchDate >= now && matchDate <= fortyEightHoursFromNow;
        console.log(`Match ${match.homeTeamName} vs ${match.awayTeamName} on ${matchDate.toISOString()} - in range: ${isInRange}`);
        return isInRange;
      });
      
      console.log('Filtered matches count:', filteredMatches.length);
      
      // Sort by date (earliest first)
      filteredMatches.sort((a, b) => {
        if (!a.startDate || !b.startDate) return 0;
        return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
      });
      
      setAllUpcomingMatches(filteredMatches);
      setFilteredMatches(filteredMatches);
      
      // Load opponent data in background - don't block page loading
      console.log('🚀 INSTANT LOAD: Loading matches instantly, opponent data will load in background...');
      
      // Set empty opponent data initially for instant page load
      setOpponentFormations({});
      setOpponentMatchResults({});
      setLoadingOpponents({ current: 0, total: 0 });
      
      // Load opponent data in background without blocking
      setTimeout(() => {
        loadOpponentDataInBackground(filteredMatches);
      }, 100);
    } catch (err) {
      console.error('Error fetching upcoming matches:', err);
      setError('Failed to load upcoming matches');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected && account) {
      console.log('🔍 Tactics page: Wallet connected, fetching clubs...');
      fetchClubs();
    }
  }, [isConnected, account]);

  useEffect(() => {
    if (clubs.length > 0 && !selectedClub) {
      // Automatically select the first club to reduce loading time
      console.log('🔍 Tactics page: Auto-selecting first club:', clubs[0].data?.club?.name);
      setSelectedClub(clubs[0].data?.club?.name);
    }
  }, [clubs, selectedClub]);

  useEffect(() => {
    if (selectedClub && clubs.length > 0) {
      console.log('🔍 Tactics page: Club selected, fetching matches for:', selectedClub);
      fetchAllUpcomingMatches();
    }
  }, [selectedClub]);

  // Since we're only fetching matches for the selected club, no additional filtering needed
  useEffect(() => {
    setFilteredMatches(allUpcomingMatches);
  }, [allUpcomingMatches]);

  const handleClubFilter = (clubName: string | null) => {
    setSelectedClub(clubName);
  };

  const loadOpponentDataInBackground = async (matches: MFLMatch[]) => {
    console.log('🔄 BACKGROUND: Loading opponent data in background...');
    
    try {
      // Check database for opponent data first
      const opponentSquadIds: number[] = [];
      for (const match of matches) {
        const opponentSquadId = match.homeTeamName === match.clubName ? match.awaySquad.id : match.homeSquad.id;
        if (!opponentSquadIds.includes(opponentSquadId)) {
          opponentSquadIds.push(opponentSquadId);
        }
      }
      
      // Check if all opponent data is available in database
      const allOpponentData = await opponentMatchesService.getAllOpponentData(opponentSquadIds, 7);
      
      // Check if we have recent data for all opponents
      let allDataAvailable = true;
      for (const squadId of opponentSquadIds) {
        if (!allOpponentData[squadId]) {
          allDataAvailable = false;
          break;
        }
        
        // Check if data is recent (within 12 hours)
        const lastSynced = new Date(allOpponentData[squadId].last_synced);
        const now = new Date();
        const twelveHoursAgo = new Date(now.getTime() - (12 * 60 * 60 * 1000));
        
        if (lastSynced <= twelveHoursAgo) {
          allDataAvailable = false;
          break;
        }
      }
      
      if (allDataAvailable) {
        console.log('🚀 BACKGROUND: All opponent data available in database, loading instantly...');
        
        // Load data from database
        const formations: { [key: string]: string[] } = {};
        const matchResults: { [key: string]: MFLMatch[] } = {};
        
        for (const match of matches) {
          const opponentName = match.homeTeamName === match.clubName ? match.awayTeamName : match.homeTeamName;
          const opponentSquadId = match.homeTeamName === match.clubName ? match.awaySquad.id : match.homeSquad.id;
          
          const opponentData = allOpponentData[opponentSquadId];
          if (opponentData) {
            matchResults[opponentName] = opponentData.matches_data || [];
            formations[opponentName] = opponentData.formations_data || [];
          }
        }
        
        setOpponentFormations(formations);
        setOpponentMatchResults(matchResults);
        return;
      }
      
      console.log('⚠️ BACKGROUND: Not all opponent data available, will fetch from API...');
      fetchOpponentFormations(matches);
    } catch (error) {
      console.error('❌ BACKGROUND: Error loading opponent data:', error);
      // Fallback to API if database check fails
      fetchOpponentFormations(matches);
    }
  };

  const fetchOpponentFormations = async (matches: MFLMatch[]) => {
    const formations: {[key: string]: string[]} = {};
    const matchResults: {[key: string]: MFLMatch[]} = {};
    
    // Get unique opponents
    const uniqueOpponents = new Set<string>();
    matches.forEach(match => {
      const opponentName = match.homeTeamName === match.clubName ? match.awayTeamName : match.homeTeamName;
      uniqueOpponents.add(opponentName);
    });
    
    const totalOpponents = uniqueOpponents.size;
    const totalMatchesToLoad = totalOpponents * 7; // 7 matches per opponent
    
    // Wait a moment for preload to complete if it's still running
    if (preloadProgress.status === 'preloading') {
      console.log('🔍 TEST: Waiting for preload to complete...');
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
    }
    
    // Check if we already have data in database for all opponents
    let allDataInDB = true;
    let dbMatchesLoaded = 0;
    
    // Get all unique opponent squad IDs
    const opponentSquadIds: number[] = [];
    for (const match of matches) {
      const opponentSquadId = match.homeTeamName === match.clubName ? match.awaySquad.id : match.homeSquad.id;
      if (!opponentSquadIds.includes(opponentSquadId)) {
        opponentSquadIds.push(opponentSquadId);
      }
    }
    
    // Check database for all opponent data
    const allOpponentData = await opponentMatchesService.getAllOpponentData(opponentSquadIds, 7);
    
    for (const match of matches) {
      const opponentName = match.homeTeamName === match.clubName ? match.awayTeamName : match.homeTeamName;
      const opponentSquadId = match.homeTeamName === match.clubName ? match.awaySquad.id : match.homeSquad.id;
      
      // Check if we have recent data in database for this opponent
      const opponentData = allOpponentData[opponentSquadId];
      const isInDB = opponentData && new Date(opponentData.last_synced) > new Date(Date.now() - (12 * 60 * 60 * 1000));
      console.log(`🔍 DB: Database check for ${opponentName} (squad ${opponentSquadId}): ${isInDB ? 'available' : 'not available'}`);
      
      if (isInDB) {
        dbMatchesLoaded += 7; // Assume 7 matches in DB
      } else {
        allDataInDB = false;
        break;
      }
    }
    
    // If all data is in database, use it immediately
    if (allDataInDB) {
      console.log('🔍 DB: All opponent data is in database, loading instantly...');
      setLoadingOpponents({ current: totalMatchesToLoad, total: totalMatchesToLoad });
      
      // Load data from database
      for (const match of matches) {
        const opponentName = match.homeTeamName === match.clubName ? match.awayTeamName : match.homeTeamName;
        const opponentSquadId = match.homeTeamName === match.clubName ? match.awaySquad.id : match.homeSquad.id;
        
        try {
          const opponentData = allOpponentData[opponentSquadId];
          if (opponentData) {
            matchResults[opponentName] = opponentData.matches_data || [];
            formations[opponentName] = opponentData.formations_data || [];
          } else {
            console.warn(`No database data found for ${opponentName}`);
            formations[opponentName] = [];
            matchResults[opponentName] = [];
          }
        } catch (error) {
          console.warn(`Failed to load database data for ${opponentName}:`, error);
          formations[opponentName] = [];
          matchResults[opponentName] = [];
        }
      }
      
      setOpponentFormations(formations);
      setOpponentMatchResults(matchResults);
      setLoadingOpponents({ current: 0, total: 0 });
      return;
    }
    
    // If not all data is cached, proceed with normal loading
    setLoadingOpponents({ current: 0, total: totalMatchesToLoad });
    
    console.log('🔍 TEST: Starting to fetch opponent data for', matches.length, 'matches');
    console.log('🔍 TEST: Found', totalOpponents, 'unique opponents');
    
    let currentMatchesLoaded = 0;
    
    for (const match of matches) {
      const opponentName = match.homeTeamName === match.clubName ? match.awayTeamName : match.homeTeamName;
      const opponentSquadId = match.homeTeamName === match.clubName ? match.awaySquad.id : match.homeSquad.id;
      
      console.log(`🔍 TEST: Processing opponent "${opponentName}" with squad ID ${opponentSquadId}`);
      
      if (!formations[opponentName]) {
        
        try {
          // First check if we have data in database
          const dbOpponentData = allOpponentData[opponentSquadId];
          if (dbOpponentData && new Date(dbOpponentData.last_synced) > new Date(Date.now() - (12 * 60 * 60 * 1000))) {
            console.log(`🔍 DB: Using database data for ${opponentName} (squad ${opponentSquadId})`);
            
            // Use data from database
            matchResults[opponentName] = dbOpponentData.matches_data || [];
            formations[opponentName] = dbOpponentData.formations_data || [];
            
            // Update progress
            currentMatchesLoaded += 7;
            setLoadingOpponents({ current: currentMatchesLoaded, total: totalMatchesToLoad });
          } else {
            // Fallback to API if no recent database data
            console.log(`🔍 API: Fetching past matches for squad ${opponentSquadId} from API...`);
            const opponentMatches = await matchesService.fetchOpponentPastMatches(opponentSquadId, 7);
            
            console.log(`🔍 API: Found ${opponentMatches.length} past matches for ${opponentName}:`, opponentMatches.map(m => ({
              id: m.id,
              homeTeam: m.homeTeamName,
              awayTeam: m.awayTeamName,
              homeScore: m.homeScore,
              awayScore: m.awayScore,
              status: m.status
            })));
            
            // Store the match results
            matchResults[opponentName] = opponentMatches;
            
            // Fetch formation for each match
            const opponentFormations: string[] = [];
            for (const opponentMatch of opponentMatches) {
              console.log(`🔍 API: Fetching formation for match ${opponentMatch.id}...`);
              const formation = await matchesService.fetchMatchFormation(opponentMatch.id.toString());
              if (formation) {
                console.log(`🔍 API: Found formation "${formation}" for match ${opponentMatch.id}`);
                opponentFormations.push(formation);
              } else {
                console.log(`🔍 API: No formation found for match ${opponentMatch.id}`);
              }
              
              // Update progress for each match processed
              currentMatchesLoaded++;
              setLoadingOpponents({ current: currentMatchesLoaded, total: totalMatchesToLoad });
            }
            
            console.log(`🔍 API: Final formations for ${opponentName}:`, opponentFormations);
            formations[opponentName] = opponentFormations;
          }
        } catch (error) {
          console.error(`🔍 ERROR: Error fetching formations for ${opponentName} (squad ${opponentSquadId}):`, error);
          formations[opponentName] = [];
          matchResults[opponentName] = [];
        }
      }
    }
    
    console.log('🔍 TEST: Final formations data:', formations);
    console.log('🔍 TEST: Final match results data:', matchResults);
    
    setOpponentFormations(formations);
    setOpponentMatchResults(matchResults);
    setLoadingOpponents({ current: 0, total: 0 }); // Reset when done
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {!hasCheckedWallet ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-lg text-gray-600 dark:text-gray-400">
                Checking wallet connection...
              </span>
            </div>
          ) : (
            <div className="text-center">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                MFL Tactics
              </h1>
              <p className="text-lg text-gray-600 dark:text-gray-400">
                Please connect your wallet to view upcoming matches
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen dark:bg-gray-900">
      <div>
        <div className="mb-8">
          <div className="mb-2">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              MFL Tactics
            </h1>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            All upcoming matches for your clubs in next 48 hours.
          </p>
          
          {/* Club Filter Pills */}
          {clubs.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {clubs
                .sort((a, b) => {
                  // Sort by league division (lower number = higher division)
                  const aDivision = a.data?.club?.division?.number || 999;
                  const bDivision = b.data?.club?.division?.number || 999;
                  return aDivision - bDivision;
                })
                .map((clubData) => {
                const clubName = clubData.data?.club?.name;
                const matchCount = allUpcomingMatches.filter(match => match.clubName === clubName).length;
                return (
                  <button
                    key={clubData.data?.club?.id}
                    onClick={() => handleClubFilter(clubName)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      selectedClub === clubName
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    {clubName}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600 dark:text-gray-400">
              Loading upcoming matches...
            </span>
          </div>
        )}

        {loadingOpponents.total > 0 && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600"></div>
            <span className="ml-3 text-gray-600 dark:text-gray-400">
              Loading opponents matches ({loadingOpponents.current}/{loadingOpponents.total})...
            </span>
          </div>
        )}


        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-800 dark:text-red-200">{error}</p>
            <button
              onClick={fetchAllUpcomingMatches}
              className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {!isLoading && !error && filteredMatches.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 dark:text-gray-600 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No Upcoming Matches
            </h3>
              <p className="text-gray-600 dark:text-gray-400">
                No upcoming matches found for your clubs in the next 48 hours. Check back later or try a different club.
              </p>
          </div>
        )}

        {!isLoading && !error && filteredMatches.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Upcoming Matches - {selectedClub} ({filteredMatches.length})
              </h2>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredMatches.map((match) => (
                <div key={`${match.id}-${match.clubId}`} className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="text-xl font-medium text-gray-900 dark:text-white">
                            <span className={match.homeTeamName === match.clubName ? 'font-bold' : ''} style={{ fontSize: match.homeTeamName === match.clubName ? '100%' : '90%' }}>
                              {match.homeTeamName}
                            </span>
                            {' vs '}
                            <span className={match.awayTeamName === match.clubName ? 'font-bold' : ''} style={{ fontSize: match.awayTeamName === match.clubName ? '100%' : '90%' }}>
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
                              <span className="font-bold">{match.type}</span>
                              {match.competition && ` - ${match.competition.name || match.competition}`}
                            </span>
                          )}
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-white">
                            {match.homeTeamName === match.clubName ? 'Home' : 'Away'}
                          </span>
                        </div>
                        
                        {(() => {
                          const opponentName = match.homeTeamName === match.clubName ? match.awayTeamName : match.homeTeamName;
                          const formations = opponentFormations[opponentName];
                          const matchResults = opponentMatchResults[opponentName];
                          
                          if ((formations && formations.length > 0) || (matchResults && matchResults.length > 0)) {
                            return (
                              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                                <div className="text-lg font-medium text-gray-500 dark:text-gray-400 mb-2">
                                  {opponentName} (Last 7 matches):
                                </div>
                                <div className="flex items-center space-x-2">
                                  <div className="flex space-x-2">
                                    {matchResults && matchResults.length > 0 && formations && formations.length > 0 ? (
                                      // Pair results with formations (most recent first)
                                      matchResults.slice(0, 7).map((opponentMatch, index) => {
                                        const result = matchesService.getMatchResult(opponentMatch, opponentName);
                                        const formation = formations[index] || 'N/A';
                                        
                                        if (!result) return null;
                                        
                                        const resultBgColor = result === 'W' ? '!bg-[lab(60_-54.51_41.79)]' :
                                                           result === 'L' ? '!bg-[#ec4b4b]' :
                                                           '!bg-[#6e6b6b]';
                                        
                                        // Format date (most recent first)
                                        const matchDate = new Date(opponentMatch.startDate);
                                        const dateStr = matchDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                        
                                        // Determine if it was a home or away match
                                        const isHome = opponentMatch.homeTeamName === opponentName;
                                        const venue = isHome ? 'Home' : 'Away';
                                        const venueBgColor = 'bg-gray-100 text-gray-700 dark:bg-gray-600 dark:text-gray-200';
                                        
                                        // Determine competition type
                                        const competitionType = opponentMatch.competition?.name?.toLowerCase().includes('cup') ? 'Cup' : 'League';
                                        
                                        return (
                                          <div 
                                            key={index} 
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
                                      })
                                    ) : (
                                      // Fallback if we don't have both results and formations
                                      <>
                                        {matchResults && matchResults.length > 0 && (
                                          <div className="flex items-center space-x-2">
                                            <span className="text-xs text-gray-500 dark:text-gray-400">Results:</span>
                                            <div className="flex space-x-1">
                                              {matchResults.slice(0, 7).map((opponentMatch, index) => {
                                                const result = matchesService.getMatchResult(opponentMatch, opponentName);
                                                if (!result) return null;
                                                
                                                const bgColor = result === 'W' ? '!bg-[lab(60_-54.51_41.79)]' :
                                                               result === 'L' ? '!bg-[#ec4b4b]' :
                                                               '!bg-[#6e6b6b]';
                                                
                                                return (
                                                  <span 
                                                    key={index}
                                                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-sm font-medium text-white ${bgColor}`}
                                                  >
                                                    {result}
                                                  </span>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        )}
                                        {formations && formations.length > 0 && (
                                          <div className="flex items-center space-x-2">
                                            <span className="text-xs text-gray-500 dark:text-gray-400">Formations:</span>
                                            <div className="flex space-x-1">
                                              {formations.slice(0, 7).map((formation, index) => (
                                                <span 
                                                  key={index}
                                                  className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-600 dark:text-gray-200"
                                                >
                                                  {formation}
                                                </span>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* View formation meta link - positioned after matches list */}
        {!isLoading && !error && filteredMatches.length > 0 && (
          <div className="mt-6 text-center">
            <a 
              href="https://mfl-coach.com/formation-meta" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline text-sm"
            >
              View formation meta →
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default MatchesTacticsPage;
