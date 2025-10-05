"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { mflApi } from '../services/mflApi';
import { getPlayerMarketValue } from '../services/marketValueService';
import { fetchPlayerExperienceHistory, processProgressionData } from '../services/playerExperienceService';
import { fetchPlayerMatches } from '../services/playerMatchesService';
import { calculateAllPositionOVRs } from '../utils/ruleBasedPositionCalculator';
import type { MFLPlayer } from '../types/mflApi';
import type { MarketValueEstimate } from '../utils/marketValueCalculator';
import PlayerImage from './PlayerImage';
import PlayerStats from './PlayerStats';
import PlayerStatsGrid from './PlayerStatsGrid';
import PositionRatingsDisplay from './PositionRatingsDisplay';
import PlayerProgressionGraph from './PlayerProgressionGraph';
import PlayerSaleHistory from './PlayerSaleHistory';
import PlayerPositionSummary from './PlayerPositionSummary';
import PlayerRecentMatches from './PlayerRecentMatches';
import { useLoading } from '../contexts/LoadingContext';
import { supabase, TABLES } from '../lib/supabase';
import { useWallet } from '../contexts/WalletContext';

interface PlayerResultsPageProps {
  propPlayerId?: string;
  initialPlayer?: MFLPlayer | null;
  initialError?: string | null;
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
    
    // Keep only the last 20 searches
    const limitedSearches = updatedSearches.slice(0, 20);
    
    localStorage.setItem('mfl-recent-searches', JSON.stringify(limitedSearches));
  } catch (error) {
    console.error('Failed to save to recent searches:', error);
  }
};

const PlayerResultsPage: React.FC<PlayerResultsPageProps> = ({ propPlayerId, initialPlayer, initialError }) => {
  const searchParams = useSearchParams();
  const { account } = useWallet();
  const [player, setPlayer] = useState<MFLPlayer | null>(initialPlayer || null);
  const [marketValueEstimate, setMarketValueEstimate] = useState<MarketValueEstimate | null>(null);
  const [isCalculatingMarketValue, setIsCalculatingMarketValue] = useState(false);
  const [progressionData, setProgressionData] = useState<any[] | null>(null);
  const [matchCount, setMatchCount] = useState<number | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError || null);
  const { setIsLoading: setGlobalLoading } = useLoading();


  const calculateMarketValueForPlayer = useCallback(async (player: MFLPlayer) => {
    try {
      // Validate that player and metadata exist
      if (!player || !player.metadata) {
        console.warn('Player or player metadata not available for market value calculation');
        return;
      }

      console.log('🔄 Calculating market value for player:', player.id);
      setIsCalculatingMarketValue(true);

      // Use the centralized market value calculation service
      const result = await getPlayerMarketValue(
        player.id.toString(),
        account || 'anonymous',
        false // Use cached value if available
      );

      if (result.success && result.details) {
        // Convert the result to the expected format for the component
        const estimate: MarketValueEstimate = {
          estimatedValue: result.marketValue!,
          confidence: result.confidence!,
          breakdown: result.details.breakdown,
          details: result.details.details
        };
        
        setMarketValueEstimate(estimate);

        // Still need to fetch progression and match data for tags
        const [progressionResponse, matchesResponse] = await Promise.all([
          fetchPlayerExperienceHistory(player.id.toString()),
          fetchPlayerMatches(player.id.toString())
        ]);

        if (progressionResponse.success) {
          setProgressionData(processProgressionData(progressionResponse.data));
        }
        if (matchesResponse.success) {
          setMatchCount(matchesResponse.data.length);
        }
      } else {
        console.error('Failed to calculate market value:', result.error);
      }
    } catch (error) {
      console.error('Failed to calculate market value:', error);
    } finally {
      setIsCalculatingMarketValue(false);
    }
  }, [account]);

  const fetchPlayerData = useCallback(async (playerId: string) => {
    setIsLoading(true);
    setGlobalLoading(true);
    setError(null);
    
    try {
      // Fetch player data from our API route (server-side)
      const response = await fetch(`/api/player/${playerId}`);
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch player data');
      }
      
      const player = data.data;
      setPlayer(player);
      
      // Add player to recent searches when successfully loaded
      addToRecentSearches(player);
      
      // Calculate market value
      await calculateMarketValueForPlayer(player);
    } catch (err) {
      let errorMessage = 'Failed to fetch player data';
      
      if (err instanceof Error) {
        // Check if it's an HTTP 400 error (likely a name search)
        if (err.message.includes('HTTP 400')) {
          // Check if the search query looks like a name (contains letters) vs an ID (numbers only)
          const isLikelyName = /[a-zA-Z]/.test(playerId);
          if (isLikelyName) {
            errorMessage = 'Player name search is not supported yet. Please search by Player ID (numbers only).';
          } else {
            errorMessage = 'Invalid Player ID. Please enter a valid numeric Player ID.';
          }
        } else {
          errorMessage = err.message;
        }
      }
      
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
  }, [propPlayerId, searchParams]);


  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen">
        <div className="p-6 bg-white dark:bg-[#111827]">
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
        <div className="p-6 bg-white dark:bg-[#111827] pt-8">
          <div className="flex items-start justify-center min-h-[calc(100vh-6rem)]">
            <div className="text-center max-w-md">
              <div className="mb-6">
                <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Search Error</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
              </div>
              
              <div className="space-y-3">
                <button
                  onClick={() => window.location.href = '/'}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Back to Search
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Try Again
                </button>
              </div>
              
              {error.includes('Player name search') && (
                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">How to find a Player ID:</h3>
                  <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                    <li>• Visit <a href="https://app.playmfl.com" target="_blank" rel="noopener noreferrer" className="underline">app.playmfl.com</a></li>
                    <li>• Search for the player you want</li>
                    <li>• Copy the Player ID from the URL or player page</li>
                    <li>• Paste the ID here to search</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#111827]">
      {/* Main Content Area - Responsive Layout */}
              <div className="px-4 lg:px-0 mt-5 bg-white dark:bg-[#111827] rounded-lg">
        {player ? (
          <>
            {/* Row 1 - Main player information */}
            <div key={`player-${player.id}`} className="flex flex-wrap justify-center gap-6 lg:gap-[30px] h-full mb-6">
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
                <div className="w-full bg-white dark:bg-[#111827] p-[5px]">
                  <PlayerStats 
                    player={player!} 
                    marketValueEstimate={marketValueEstimate}
                    progressionData={progressionData}
                    matchCount={matchCount}
                    isCalculatingMarketValue={isCalculatingMarketValue}
                  />
                </div>
              </div>


            </div>

            {/* Row 2 - External Links (Full width) */}
            {player!.id && (
              <div className="w-full mb-6">
                <div className="w-full p-[5px]">
                  <div className="flex gap-2 max-w-lg mx-auto">
                    <button
                      onClick={() => window.open(`https://app.playmfl.com/players/${player!.id}`, '_blank')}
                      className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-white transition-all duration-200 font-medium text-sm flex items-center justify-center space-x-2 cursor-pointer"
                    >
                      <span>mfl.com</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </button>
                    <button
                      onClick={() => window.open(`https://mflplayer.info/player/${player!.id}`, '_blank')}
                      className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-white transition-all duration-200 font-medium text-sm flex items-center justify-center space-x-2 cursor-pointer"
                    >
                      <span>mflplayer.info</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </button>
                    <button
                      onClick={() => window.open(`https://mfl-assistant.com/search?q=${encodeURIComponent(`${player!.metadata.firstName} ${player!.metadata.lastName}`)}`, '_blank')}
                      className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-white transition-all duration-200 font-medium text-sm flex items-center justify-center space-x-2 cursor-pointer"
                    >
                      <span>mfl-assistant.com</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Row 3 - Progression Graph (Full width) */}
            <div className="w-full mb-6">
              <div className="w-full p-[5px]">
                <PlayerProgressionGraph 
                  playerId={player.id.toString()} 
                  playerName={`${player.metadata.firstName} ${player.metadata.lastName}`}
                  playerPositions={player.metadata.positions}
                />
              </div>
            </div>

            {/* Row 4 - Sale History, Position Summary, and Recent Matches (Three columns) */}
            <div className="flex flex-wrap gap-4 mb-6">
              {/* Sale History */}
              <div className="w-full lg:w-[400px]">
                <div className="w-full p-[5px]">
                  <PlayerSaleHistory 
                    playerId={player.id.toString()} 
                    playerName={`${player.metadata.firstName} ${player.metadata.lastName}`}
                    playerMetadata={player.metadata}
                    marketValueEstimate={marketValueEstimate}
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
              <div className="w-full lg:w-[397px]">
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

