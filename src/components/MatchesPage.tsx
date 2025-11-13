"use client";

import React, { useState, useEffect } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useRouter } from 'next/navigation';
import { matchesService, MFLMatch } from '../services/matchesService';
import { clubsService } from '../services/clubsService';

// Lightweight child component to fetch and render formations for a given match
const MatchFormations: React.FC<{ matchId: string }> = ({ matchId }) => {
  const [home, setHome] = useState<string | null>(null);
  const [away, setAway] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [loaded, setLoaded] = useState<boolean>(false);

  useEffect(() => {
    if (loaded) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const formations = await matchesService.fetchMatchFormations(matchId);
        if (!cancelled) {
          setHome(formations.home || null);
          setAway(formations.away || null);
          setLoaded(true);
        }
      } catch {
        if (!cancelled) setLoaded(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [matchId, loaded]);

  if (loading && !loaded) {
    return <span>Loading formations…</span>;
  }

  if (!home && !away) {
    return <span>No formation data</span>;
  }

  return (
    <div className="mt-1 space-x-2">
      {home && <span className="inline-block px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white">Home: {home}</span>}
      {away && <span className="inline-block px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white">Away: {away}</span>}
    </div>
  );
};

const MatchesPage: React.FC = () => {
  const { isConnected, account } = useWallet();
  const [clubs, setClubs] = useState<any[]>([]);
  const [selectedClub, setSelectedClub] = useState<any>(null);
  const [pastMatches, setPastMatches] = useState<MFLMatch[]>([]);
  const [upcomingMatches, setUpcomingMatches] = useState<MFLMatch[]>([]);
  const [showAllPast, setShowAllPast] = useState(false);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  // Only redirect if we've checked and wallet is still not connected
  useEffect(() => {
    if (hasCheckedWallet && !isConnected) {
      router.push('/');
    }
  }, [hasCheckedWallet, isConnected, router]);

  const fetchClubs = async () => {
    if (!account) return;
    
    console.log('fetchClubs called with account:', account);
    setIsLoading(true);
    setError(null);
    
    try {
      const clubsData = await clubsService.fetchClubsForWallet(account);
      console.log('Clubs data received:', clubsData);
      setClubs(clubsData);
      if (clubsData.length > 0) {
        console.log('Setting selected club to:', clubsData[0]);
        setSelectedClub(clubsData[0]);
      }
    } catch (err) {
      console.error('Error fetching clubs:', err);
      setError('Failed to load clubs data');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMatches = async (clubId: string) => {
    if (!clubId) return;
    
    console.log('fetchMatches called with clubId:', clubId);
    setIsLoadingMatches(true);
    setError(null);
    
    // Clear previous matches immediately to show fresh state
    setPastMatches([]);
    setUpcomingMatches([]);
    
    try {
      // Always use club-specific methods to get matches for the selected club
      console.log('🔍 Fetching matches for club:', clubId);
      
      // Fetch matches in background - don't block UI
      const [pastData, upcomingData] = await Promise.all([
        matchesService.fetchPastMatches(clubId),
        matchesService.fetchUpcomingMatches(clubId)
      ]);
      
      console.log('Past matches for club:', pastData);
      console.log('Upcoming matches for club:', upcomingData);
      
      setPastMatches(pastData);
      setUpcomingMatches(upcomingData);
    } catch (err) {
      console.error('Error fetching matches:', err);
      setError('Failed to load matches data');
    } finally {
      setIsLoadingMatches(false);
    }
  };

  // Helper function to determine if the selected club won the match
  const getMatchResult = (match: MFLMatch, clubName: string): 'W' | 'L' | 'D' | null => {
    console.log('getMatchResult called:', {
      matchStatus: match.status,
      clubName,
      homeTeam: match.homeTeamName,
      awayTeam: match.awayTeamName,
      homeScore: match.homeScore,
      awayScore: match.awayScore
    });
    
    if (match.status !== 'FINISHED' && match.status !== 'ENDED') {
      console.log('Match not finished, status:', match.status);
      return null;
    }
    
    const isHomeTeam = match.homeTeamName === clubName;
    const isAwayTeam = match.awayTeamName === clubName;
    
    if (!isHomeTeam && !isAwayTeam) {
      console.log('Club not found in match teams');
      return null;
    }
    
    // Check if it's a draw
    if (match.homeScore === match.awayScore) {
      console.log('Draw detected');
      return 'D';
    }
    
    if (isHomeTeam) {
      const result = match.homeScore > match.awayScore ? 'W' : 'L';
      console.log('Home team result:', result);
      return result;
    } else {
      const result = match.awayScore > match.homeScore ? 'W' : 'L';
      console.log('Away team result:', result);
      return result;
    }
  };

  useEffect(() => {
    console.log('MatchesPage useEffect - isConnected:', isConnected, 'account:', account);
    if (isConnected && account) {
      console.log('Wallet connected, fetching clubs for:', account);
      // Fetch clubs in background - don't block UI
      fetchClubs().catch(err => {
        console.error('Background fetch clubs error:', err);
      });
    } else {
      console.log('Wallet not connected or no account address');
    }
  }, [isConnected, account]);

  useEffect(() => {
    console.log('selectedClub changed:', selectedClub);
    if (selectedClub) {
      console.log('selectedClub.club:', selectedClub.club);
      console.log('selectedClub.club.id:', selectedClub.club.id);
      
      // Use the club ID directly
      const clubId = selectedClub.club.id.toString();
      console.log('Using club ID:', clubId, 'for club:', selectedClub.club.name);
      // Fetch matches in background - don't block UI
      fetchMatches(clubId).catch(err => {
        console.error('Background fetch matches error:', err);
      });
    }
  }, [selectedClub]);

  // Show loading state while checking wallet connection
  if (!hasCheckedWallet) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              MFL Matches
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              Loading...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show not connected message only after we've checked
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              MFL Matches
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              Please connect your wallet to view your matches
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              MFL Matches
            </h1>
            <a
              href="/matches/tactics"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              View Tactics
            </a>
          </div>
          {clubs.length > 0 && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {clubs.length} club{clubs.length !== 1 ? 's' : ''} available
            </p>
          )}
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-800 dark:text-red-200">{error}</p>
            <button
              onClick={() => selectedClub ? fetchMatches(selectedClub.club.id.toString()) : fetchClubs()}
              className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Show loading indicator only for clubs section, not blocking entire page */}
        {isLoading && clubs.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600 dark:text-gray-400">Loading clubs...</span>
            </div>
          </div>
        )}

        {!isLoading && clubs.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 dark:text-gray-600 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No Clubs Found
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              You don't have any MFL clubs in this wallet.
            </p>
          </div>
        )}

        {clubs.length > 0 && (
          <div className="space-y-8">
            {/* Club Selector */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Select Club
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {clubs.map((clubData) => (
                  <button
                    key={clubData.club.id}
                    onClick={() => setSelectedClub(clubData)}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      selectedClub?.club.id === clubData.club.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="text-left">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {clubData.club.name}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {clubsService.getDivisionName(clubData.club.division)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Matches Content */}
            {selectedClub && (
              <div className="space-y-6">
                {/* Show loading indicator only when matches are loading and we have no data yet */}
                {isLoadingMatches && upcomingMatches.length === 0 && pastMatches.length === 0 && (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    <span className="ml-3 text-gray-600 dark:text-gray-400">Loading matches...</span>
                  </div>
                )}

                {/* Upcoming Matches */}
                {upcomingMatches.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                        Upcoming Matches ({upcomingMatches.length})
                      </h2>
                    </div>
                    <div className="divide-y divide-gray-200 dark:divide-gray-700">
                      {(showAllUpcoming ? upcomingMatches : upcomingMatches.slice(0, 3)).map((match) => (
                        <div key={match.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-4">
                                <div className="text-center min-w-[150px]">
                                  <div className="font-semibold text-gray-900 dark:text-white">
                                    {match.homeTeamName}
                                  </div>
                                  <div className="text-sm text-gray-500 dark:text-gray-400">
                                    Home
                                  </div>
                                </div>
                                <div className="text-center min-w-[120px]">
                                  <div className="text-2xl font-bold text-gray-900 dark:text-white font-mono">
                                    {match.homeScore} - {match.awayScore}
                                  </div>
                                  <div className="text-sm text-gray-500 dark:text-gray-400">
                                    {matchesService.formatMatchDate(match.startDate)}
                                  </div>
                                </div>
                                <div className="text-center min-w-[150px]">
                                  <div className="font-semibold text-gray-900 dark:text-white">
                                    {match.awayTeamName}
                                  </div>
                                  <div className="text-sm text-gray-500 dark:text-gray-400">
                                    Away
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col items-end space-y-2">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${matchesService.getMatchStatusColor(match.status)}`}>
                                {matchesService.formatMatchStatus(match.status)}
                              </span>
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${matchesService.getCompetitionTypeColor(match.competition.type)}`}>
                                {match.competition.name}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {upcomingMatches.length > 3 && (
                      <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                        <button
                          onClick={() => setShowAllUpcoming(!showAllUpcoming)}
                          className="w-full text-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
                        >
                          {showAllUpcoming ? 'Show Less' : `Show More (${upcomingMatches.length - 3} more)`}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Past Matches */}
                {pastMatches.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                        Recent Matches ({pastMatches.length})
                      </h2>
                    </div>
                    <div className="divide-y divide-gray-200 dark:divide-gray-700">
                      {(showAllPast ? pastMatches : pastMatches.slice(0, 3)).map((match) => {
                        const result = getMatchResult(match, selectedClub.club.name);
                        return (
                          <div key={match.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-4">
                                  {/* Win/Loss/Draw Indicator */}
                                  {result && (
                                    <div className="flex-shrink-0">
                                      <span className={`inline-flex items-center justify-center w-16 h-16 rounded-full text-2xl font-bold ${
                                        result === 'W' 
                                          ? 'bg-green-500 text-white' 
                                          : result === 'L'
                                          ? 'bg-red-500 text-white'
                                          : 'bg-gray-500 text-white'
                                      }`}>
                                        {result}
                                      </span>
                                    </div>
                                  )}
                                  
                                  <div className="text-center min-w-[150px]">
                                    <div className="font-semibold text-gray-900 dark:text-white">
                                      {match.homeTeamName}
                                    </div>
                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                      Home
                                    </div>
                                  </div>
                                  <div className="text-center min-w-[120px]">
                                    <div className="text-2xl font-bold text-gray-900 dark:text-white font-mono">
                                      {match.homeScore} - {match.awayScore}
                                    </div>
                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                      {matchesService.formatMatchDate(match.startDate)}
                                    </div>
                                    {/* Formations row (always shown) */}
                                    <div className="mt-1 text-xs text-gray-600 dark:text-white">
                                      <MatchFormations matchId={match.id.toString()} />
                                    </div>
                                  </div>
                                  <div className="text-center min-w-[150px]">
                                    <div className="font-semibold text-gray-900 dark:text-white">
                                      {match.awayTeamName}
                                    </div>
                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                      Away
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="flex flex-col items-end space-y-2">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${matchesService.getMatchStatusColor(match.status)}`}>
                                  {matchesService.formatMatchStatus(match.status)}
                                </span>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${matchesService.getCompetitionTypeColor(match.competition.type)}`}>
                                  {match.competition.name}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {pastMatches.length > 3 && (
                      <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                        <button
                          onClick={() => setShowAllPast(!showAllPast)}
                          className="w-full text-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
                        >
                          {showAllPast ? 'Show Less' : `Show More (${pastMatches.length - 3} more)`}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* No Matches - only show if not loading and no data */}
                {!isLoadingMatches && upcomingMatches.length === 0 && pastMatches.length === 0 && (
                  <div className="text-center py-12">
                    <div className="text-gray-400 dark:text-gray-600 mb-4">
                      <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      No Matches Found
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      No matches found for {selectedClub.club.name}.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MatchesPage;
