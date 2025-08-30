"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { mflApi } from '../services/mflApi';
import type { MFLPlayer } from '../types/mflApi';
import PlayerImage from './PlayerImage';
import PlayerStats from './PlayerStats';
import PlayerStatsGrid from './PlayerStatsGrid';
import PositionRatingsDisplay from './PositionRatingsDisplay';
import PlayerProgressionGraph from './PlayerProgressionGraph';
import PlayerSaleHistory from './PlayerSaleHistory';
import PlayerPositionSummary from './PlayerPositionSummary';
import PlayerRecentMatches from './PlayerRecentMatches';
import { useLoading } from '../contexts/LoadingContext';

interface PlayerResultsPageProps {
  propPlayerId?: string;
}

// Function to add player to recent searches
const addToRecentSearches = (player: MFLPlayer) => {
  try {
    const recentSearches = JSON.parse(localStorage.getItem('mfl-recent-searches') || '[]');
    
    // Create new search entry
    const newSearch = {
      id: player.id.toString(),
      name: `${player.metadata.firstName} ${player.metadata.lastName}`,
      overall: player.metadata.overall,
      positions: player.metadata.positions,
      timestamp: Date.now()
    };
    
    // Remove existing entry if it exists (to avoid duplicates)
    const filteredSearches = recentSearches.filter((search: { id: string }) => search.id !== newSearch.id);
    
    // Add new search to the beginning
    const updatedSearches = [newSearch, ...filteredSearches];
    
    // Keep only the last 10 searches
    const limitedSearches = updatedSearches.slice(0, 10);
    
    localStorage.setItem('mfl-recent-searches', JSON.stringify(limitedSearches));
  } catch (error) {
    console.error('Failed to save to recent searches:', error);
  }
};

const PlayerResultsPage: React.FC<PlayerResultsPageProps> = ({ propPlayerId }) => {
  const searchParams = useSearchParams();
  const [player, setPlayer] = useState<MFLPlayer | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setIsLoading: setGlobalLoading } = useLoading();

  const fetchPlayerData = useCallback(async (playerId: string) => {
    setIsLoading(true);
    setGlobalLoading(true);
    setError(null);
    
    try {
      const player = await mflApi.getPlayer(playerId);
      setPlayer(player);
      
      // Add player to recent searches when successfully loaded
      addToRecentSearches(player);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch player data';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      setGlobalLoading(false);
    }
  }, [setGlobalLoading]);

  // Initialize player data on component mount
  useEffect(() => {
    const currentPlayerId = propPlayerId || searchParams.get('playerId');
    
    if (currentPlayerId) {
      fetchPlayerData(currentPlayerId);
    }
  }, [propPlayerId, searchParams, fetchPlayerData]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen">
        <div className="p-6 bg-white dark:bg-[#121213]">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading player data...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen">
        <div className="p-6 bg-white dark:bg-[#121213]">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <p className="text-red-600 mb-4">Error: {error}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#121213]">
      {/* Main Content Area - Responsive Layout */}
      <div className="px-4 lg:px-0 bg-white dark:bg-[#121213] rounded-lg">
        {player ? (
          <>
            {/* Row 1 - Main player information */}
            <div key={`player-${player.id}`} className="flex flex-wrap gap-6 lg:gap-[30px] h-full mb-6">
              {/* Column 1 - Player Card (Mobile: First, Desktop: Second) */}
              <div className="w-full lg:w-[375px] lg:flex-shrink-0 flex flex-col order-1 lg:order-2">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 text-center hidden">Player Card</h2>
                <div className="flex flex-col items-center space-y-4 p-[5px]">
                  <PlayerImage player={player!} />
                  {/* Player Stats Grid */}
                  <div className="w-full mt-4">
                    <PlayerStatsGrid player={player!} />
                  </div>
                </div>
              </div>

              {/* Column 2 - Position Ratings (Mobile: Second, Desktop: Third) */}
              <div className="w-full lg:w-[350px] lg:flex-shrink-0 order-2 lg:order-3">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-[5px] p-[5px]">Position Ratings</h2>
                <div className="w-full p-[5px]">
                  <PositionRatingsDisplay player={player} />
                </div>
              </div>

              {/* Column 3 - Player Information (Mobile: Third, Desktop: First) */}
              <div className="w-full lg:w-[350px] lg:flex-shrink-0 order-3 lg:order-1">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 hidden">Player Information</h2>
                <div className="w-full bg-white dark:bg-[#121213] p-[5px]">
                  <PlayerStats player={player!} />
                  {/* View on MFL.com Button */}
                  {player!.id && (
                    <div className="mt-4 space-y-2">
                      <button
                        onClick={() => window.open(`https://app.playmfl.com/players/${player!.id}`, '_blank')}
                        className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-white transition-all duration-200 font-medium text-sm flex items-center justify-center space-x-2 cursor-pointer"
                      >
                        <span>View on mfl.com</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </button>
                      <button
                        onClick={() => window.open(`https://mflplayer.info/player/${player!.id}`, '_blank')}
                        className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-white transition-all duration-200 font-medium text-sm flex items-center justify-center space-x-2 cursor-pointer"
                      >
                        <span>View on mflplayer.info</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </button>
                      <button
                        onClick={() => window.open(`https://mfl-assistant.com/search?q=${encodeURIComponent(`${player!.metadata.firstName} ${player!.metadata.lastName}`)}`, '_blank')}
                        className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-white transition-all duration-200 font-medium text-sm flex items-center justify-center space-x-2 cursor-pointer"
                      >
                        <span>View on mfl-assistant.com</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>


            </div>

            {/* Row 2 - Progression Graph (Full width) */}
            <div className="w-full mb-6">
              <div className="w-full p-[5px]">
                <PlayerProgressionGraph 
                  playerId={player.id.toString()} 
                  playerName={`${player.metadata.firstName} ${player.metadata.lastName}`}
                  playerPositions={player.metadata.positions}
                />
              </div>
            </div>

            {/* Row 3 - Sale History, Position Summary, and Recent Matches (Three columns) */}
            <div className="flex flex-wrap gap-4 mb-6">
              {/* Sale History */}
              <div className="w-full lg:w-[400px]">
                <div className="w-full p-[5px]">
                  <PlayerSaleHistory 
                    playerId={player.id.toString()} 
                    playerName={`${player.metadata.firstName} ${player.metadata.lastName}`}
                    playerMetadata={player.metadata}
                  />
                </div>
              </div>

              {/* Position Summary */}
              <div className="w-full lg:w-[350px]">
                <div className="w-full p-[5px]">
                  <PlayerPositionSummary 
                    playerId={player.id.toString()} 
                    playerName={`${player.metadata.firstName} ${player.metadata.lastName}`}
                  />
                </div>
              </div>

              {/* Recent Matches */}
              <div className="w-full lg:w-[350px]">
                <div className="w-full p-[5px]">
                  <PlayerRecentMatches 
                    playerId={player.id.toString()} 
                    playerName={`${player.metadata.firstName} ${player.metadata.lastName}`}
                  />
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <p className="text-gray-600">No player data available</p>
              <p className="text-sm text-gray-400 mt-2">Debug: player={player ? 'exists' : 'null'}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlayerResultsPage;
