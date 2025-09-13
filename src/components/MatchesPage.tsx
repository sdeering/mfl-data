"use client";

import React, { useState, useEffect } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useRouter } from 'next/navigation';
import { matchesService, MFLMatch } from '../services/matchesService';
import { clubsService } from '../services/clubsService';

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

  const fetchMatches = async (squadId: string) => {
    if (!squadId) return;
    
    console.log('fetchMatches called with squadId:', squadId);
    setIsLoadingMatches(true);
    setError(null);
    
    try {
      const [pastData, upcomingData] = await Promise.all([
        matchesService.fetchPastMatches(squadId),
        matchesService.fetchUpcomingMatches(squadId)
      ]);
      
      console.log('Past matches:', pastData);
      console.log('Upcoming matches:', upcomingData);
      
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
  const getMatchResult = (match: MFLMatch, clubName: string): 'W' | 'L' | null => {
    if (match.status !== 'FINISHED') return null;
    
    const isHomeTeam = match.homeTeamName === clubName;
    const isAwayTeam = match.awayTeamName === clubName;
    
    if (!isHomeTeam && !isAwayTeam) return null;
    
    if (isHomeTeam) {
      return match.homeScore > match.awayScore ? 'W' : 'L';
    } else {
      return match.awayScore > match.homeScore ? 'W' : 'L';
    }
  };

  useEffect(() => {
    console.log('MatchesPage useEffect - isConnected:', isConnected, 'account:', account);
    if (isConnected && account) {
      console.log('Wallet connected, fetching clubs for:', account);
      fetchClubs();
    } else {
      console.log('Wallet not connected or no account address');
    }
  }, [isConnected, account]);

  useEffect(() => {
    console.log('selectedClub changed:', selectedClub);
    if (selectedClub) {
      console.log('selectedClub.club:', selectedClub.club);
      console.log('selectedClub.club.squads:', selectedClub.club?.squads);
      
      // Try to get squad ID from club name mapping
      const squadId = matchesService.getSquadIdForClub(selectedClub.club.name);
      console.log('Squad ID for club', selectedClub.club.name, ':', squadId);
      
      if (squadId) {
        console.log('Fetching matches for squad ID:', squadId, 'Club:', selectedClub.club.name);
        fetchMatches(squadId);
      } else {
        console.log('No squad ID found for club:', selectedClub.club?.name);
        // Clear matches if no squad ID found
        setPastMatches([]);
        setUpcomingMatches([]);
      }
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            MFL Matches
          </h1>
          {clubs.length > 0 && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {clubs.length} club{clubs.length !== 1 ? 's' : ''} available
            </p>
          )}
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600 dark:text-gray-400">Loading clubs...</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-800 dark:text-red-200">{error}</p>
            <button
              onClick={() => selectedClub ? fetchMatches(selectedClub.squad.id.toString()) : fetchClubs()}
              className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {!isLoading && !error && clubs.length === 0 && (
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

        {!isLoading && !error && clubs.length > 0 && (
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
                {isLoadingMatches && (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    <span className="ml-3 text-gray-600 dark:text-gray-400">Loading matches...</span>
                  </div>
                )}

                {/* Upcoming Matches */}
                {!isLoadingMatches && upcomingMatches.length > 0 && (
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
                                <div className="text-center">
                                  <div className="font-semibold text-gray-900 dark:text-white">
                                    {match.homeTeamName}
                                  </div>
                                  <div className="text-sm text-gray-500 dark:text-gray-400">
                                    Home
                                  </div>
                                </div>
                                <div className="text-center">
                                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                                    {match.homeScore} - {match.awayScore}
                                  </div>
                                  <div className="text-sm text-gray-500 dark:text-gray-400">
                                    {matchesService.formatMatchDate(match.startDate)}
                                  </div>
                                </div>
                                <div className="text-center">
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
                                {match.status}
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
                {!isLoadingMatches && pastMatches.length > 0 && (
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
                                  {/* Win/Loss Indicator */}
                                  {result && (
                                    <div className="flex-shrink-0">
                                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                                        result === 'W' 
                                          ? 'bg-green-500 text-white' 
                                          : 'bg-red-500 text-white'
                                      }`}>
                                        {result}
                                      </span>
                                    </div>
                                  )}
                                  
                                  <div className="text-center">
                                    <div className="font-semibold text-gray-900 dark:text-white">
                                      {match.homeTeamName}
                                    </div>
                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                      Home
                                    </div>
                                  </div>
                                  <div className="text-center">
                                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                                      {match.homeScore} - {match.awayScore}
                                    </div>
                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                      {matchesService.formatMatchDate(match.startDate)}
                                    </div>
                                  </div>
                                  <div className="text-center">
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
                                  {match.status}
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

                {/* No Matches */}
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
