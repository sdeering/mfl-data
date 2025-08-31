"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { mflApi } from '../services/mflApi';
import { fetchMarketData } from '../services/marketDataService';
import { calculateMarketValue } from '../utils/marketValueCalculator';
import { fetchPlayerSaleHistory } from '../services/playerSaleHistoryService';
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
    
    // Keep only the last 20 searches
    const limitedSearches = updatedSearches.slice(0, 20);
    
    localStorage.setItem('mfl-recent-searches', JSON.stringify(limitedSearches));
  } catch (error) {
    console.error('Failed to save to recent searches:', error);
  }
};

const PlayerResultsPage: React.FC<PlayerResultsPageProps> = ({ propPlayerId }) => {
  const searchParams = useSearchParams();
  const [player, setPlayer] = useState<MFLPlayer | null>(null);
  const [marketValueEstimate, setMarketValueEstimate] = useState<MarketValueEstimate | null>(null);
  const [progressionData, setProgressionData] = useState<any[] | null>(null);
  const [matchCount, setMatchCount] = useState<number | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setIsLoading: setGlobalLoading } = useLoading();

  const calculateMarketValueForPlayer = useCallback(async (player: MFLPlayer) => {
    try {
      // Validate that player and metadata exist
      if (!player || !player.metadata) {
        console.warn('Player or player metadata not available for market value calculation');
        return;
      }

      const [marketResponse, historyResponse, progressionResponse, matchesResponse] = await Promise.all([
        fetchMarketData({
          positions: player.metadata.positions,
          ageMin: Math.max(1, player.metadata.age - 1),
          ageMax: player.metadata.age + 1,
          overallMin: Math.max(1, player.metadata.overall - 1),
          overallMax: player.metadata.overall + 1,
          limit: 50
        }),
        fetchPlayerSaleHistory(player.id.toString()),
        fetchPlayerExperienceHistory(player.id.toString()),
        fetchPlayerMatches(player.id.toString())
      ]);

      // Calculate position ratings
      const playerForOVR = {
        id: player.id,
        name: `${player.metadata.firstName} ${player.metadata.lastName}`,
        attributes: {
          PAC: player.metadata.pace,
          SHO: player.metadata.shooting,
          PAS: player.metadata.passing,
          DRI: player.metadata.dribbling,
          DEF: player.metadata.defense,
          PHY: player.metadata.physical,
          GK: player.metadata.goalkeeping || 0
        },
        positions: player.metadata.positions,
        overall: player.metadata.overall
      };
      const positionRatingsResult = calculateAllPositionOVRs(playerForOVR);
      const positionRatings = positionRatingsResult.results;
      


      // Store progression data and match count for tags
      if (progressionResponse.success) {
        setProgressionData(processProgressionData(progressionResponse.data));
      }
      if (matchesResponse.success) {
        setMatchCount(matchesResponse.data.length);
      }

      if (marketResponse.success && player.metadata) {
  
        // Convert position ratings to the expected format
        const positionRatingsForMarketValue = Object.entries(positionRatings).reduce((acc, [position, result]) => {
          if (result.success) {
            acc[position] = result.ovr;
          }
          return acc;
        }, {} as { [position: string]: number });

        const estimate = calculateMarketValue(
          player.metadata,
          marketResponse.data,
          historyResponse.success ? historyResponse.data : [],
          progressionResponse.success ? processProgressionData(progressionResponse.data) : [],
          positionRatingsForMarketValue,
          player.metadata.retirementYears,
          matchesResponse.success ? matchesResponse.data.length : undefined,
          player.id // Pass the actual player ID
        );

        setMarketValueEstimate(estimate);
      } else {

      }
    } catch (error) {
      console.error('Failed to calculate market value:', error);
    }
  }, []);

  const fetchPlayerData = useCallback(async (playerId: string) => {
    setIsLoading(true);
    setGlobalLoading(true);
    setError(null);
    
    try {
      const player = await mflApi.getPlayer(playerId);
      setPlayer(player);
      
      // Add player to recent searches when successfully loaded
      addToRecentSearches(player);
      
      // Calculate market value
      await calculateMarketValueForPlayer(player);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch player data';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      setGlobalLoading(false);
    }
  }, [setGlobalLoading, calculateMarketValueForPlayer]);

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
                  <PlayerStats 
                    player={player!} 
                    marketValueEstimate={marketValueEstimate}
                    progressionData={progressionData}
                    matchCount={matchCount}
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

