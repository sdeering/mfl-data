"use client";

import React, { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { mflApi } from '../../src/services/mflApi';
import { fetchMarketData } from '../../src/services/marketDataService';
import { calculateMarketValue } from '../../src/utils/marketValueCalculator';
import { fetchPlayerSaleHistory } from '../../src/services/playerSaleHistoryService';
import { fetchPlayerExperienceHistory, processProgressionData } from '../../src/services/playerExperienceService';
import { fetchPlayerMatches } from '../../src/services/playerMatchesService';
import { calculateAllPositionOVRs } from '../../src/utils/ruleBasedPositionCalculator';
import type { MFLPlayer } from '../../src/types/mflApi';
import type { MarketValueEstimate } from '../../src/utils/marketValueCalculator';
import PlayerImage from '../../src/components/PlayerImage';
import PlayerStatsGrid from '../../src/components/PlayerStatsGrid';
import PositionRatingsDisplay from '../../src/components/PositionRatingsDisplay';
import PlayerProgressionGraph from '../../src/components/PlayerProgressionGraph';
import PlayerRecentMatches from '../../src/components/PlayerRecentMatches';
import PlayerSaleHistory from '../../src/components/PlayerSaleHistory';
import { useLoading } from '../../src/contexts/LoadingContext';

function ComparePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [player1, setPlayer1] = useState<MFLPlayer | null>(null);
  const [player2, setPlayer2] = useState<MFLPlayer | null>(null);
  const [player1Id, setPlayer1Id] = useState<string>('');
  const [player2Id, setPlayer2Id] = useState<string>('');
  const [isLoading1, setIsLoading1] = useState(false);
  const [isLoading2, setIsLoading2] = useState(false);
  const [error1, setError1] = useState<string | null>(null);
  const [error2, setError2] = useState<string | null>(null);
  const [marketValueEstimate1, setMarketValueEstimate1] = useState<MarketValueEstimate | null>(null);
  const [marketValueEstimate2, setMarketValueEstimate2] = useState<MarketValueEstimate | null>(null);
  const { setIsLoading: setGlobalLoading } = useLoading();

  // Get player IDs from URL search params
  const urlPlayer1Id = searchParams.get('player1Id');
  const urlPlayer2Id = searchParams.get('player2Id');
  const urlPlayerId = searchParams.get('playerId'); // Legacy support

  const fetchPlayer = useCallback(async (playerId: string, playerNumber: 1 | 2) => {
    if (!playerId.trim()) return;

    const setIsLoading = playerNumber === 1 ? setIsLoading1 : setIsLoading2;
    const setError = playerNumber === 1 ? setError1 : setError2;
    const setPlayer = playerNumber === 1 ? setPlayer1 : setPlayer2;

    setIsLoading(true);
    setGlobalLoading(true);
    setError(null);

    try {
      const player = await mflApi.getPlayer(playerId);
      setPlayer(player);
      
      // Calculate market value for the player
      await calculateMarketValueForPlayer(player, playerNumber);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch player data';
      setError(errorMessage);
      setPlayer(null);
    } finally {
      setIsLoading(false);
      setGlobalLoading(false);
    }
  }, [setGlobalLoading]);

  const updateURL = (player1Id: string, player2Id: string) => {
    const params = new URLSearchParams();
    if (player1Id) params.set('player1Id', player1Id);
    if (player2Id) params.set('player2Id', player2Id);
    
    const newURL = params.toString() ? `?${params.toString()}` : '/compare';
    router.replace(newURL, { scroll: false });
  };

  const handlePlayer1Search = () => {
    fetchPlayer(player1Id, 1);
    updateURL(player1Id, player2Id);
  };

  const handlePlayer2Search = () => {
    fetchPlayer(player2Id, 2);
    updateURL(player1Id, player2Id);
  };

  const handleKeyPress = (e: React.KeyboardEvent, playerNumber: 1 | 2) => {
    if (e.key === 'Enter') {
      if (playerNumber === 1) {
        handlePlayer1Search();
      } else {
        handlePlayer2Search();
      }
    }
  };

  const calculateMarketValueForPlayer = useCallback(async (player: MFLPlayer, playerNumber: 1 | 2) => {
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

        if (playerNumber === 1) {
          setMarketValueEstimate1(estimate);
        } else {
          setMarketValueEstimate2(estimate);
        }
      }
    } catch (error) {
      console.error('Failed to calculate market value:', error);
    }
  }, []);

  // Load players from URL on component mount
  useEffect(() => {
    // Handle legacy playerId parameter
    if (urlPlayerId && !urlPlayer1Id) {
      setPlayer1Id(urlPlayerId);
      fetchPlayer(urlPlayerId, 1);
    }
    
    // Handle player1Id parameter
    if (urlPlayer1Id) {
      setPlayer1Id(urlPlayer1Id);
      fetchPlayer(urlPlayer1Id, 1);
    }
    
    // Handle player2Id parameter
    if (urlPlayer2Id) {
      setPlayer2Id(urlPlayer2Id);
      fetchPlayer(urlPlayer2Id, 2);
    }
  }, [urlPlayerId, urlPlayer1Id, urlPlayer2Id]);

  return (
    <div className="min-h-screen bg-white dark:bg-[#121213]">
      <div className="px-4 lg:px-0 bg-white dark:bg-[#121213] rounded-lg">
        {/* Page Title */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Compare Players</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Enter player IDs to compare their stats and ratings</p>
        </div>

        {/* Search Inputs */}
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          {/* Player 1 Search */}
          <div className="flex-1">
            <label htmlFor="player1" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Player 1 ID
            </label>
            <div className="flex gap-2">
              <input
                id="player1"
                type="text"
                value={player1Id}
                onChange={(e) => setPlayer1Id(e.target.value)}
                onKeyPress={(e) => handleKeyPress(e, 1)}
                placeholder="Enter player ID..."
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={handlePlayer1Search}
                disabled={isLoading1 || !player1Id.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading1 ? 'Loading...' : 'Search'}
              </button>
            </div>
            {error1 && (
              <p className="text-red-600 text-sm mt-1">{error1}</p>
            )}
          </div>

          {/* Player 2 Search */}
          <div className="flex-1">
            <label htmlFor="player2" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Player 2 ID
            </label>
            <div className="flex gap-2">
              <input
                id="player2"
                type="text"
                value={player2Id}
                onChange={(e) => setPlayer2Id(e.target.value)}
                onKeyPress={(e) => handleKeyPress(e, 2)}
                placeholder="Enter player ID..."
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={handlePlayer2Search}
                disabled={isLoading2 || !player2Id.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading2 ? 'Loading...' : 'Search'}
              </button>
            </div>
            {error2 && (
              <p className="text-red-600 text-sm mt-1">{error2}</p>
            )}
          </div>
        </div>

        {/* Comparison Layout */}
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-[30px]">
          {/* Player 1 Column */}
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 text-center">
              {player1 ? (
                <div className="flex flex-col items-center space-y-2">
                  <span>{player1.metadata.firstName} {player1.metadata.lastName}</span>
                  <a 
                    href={`/players/${player1.id}`}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline transition-colors"
                  >
                    Full Profile
                  </a>
                </div>
              ) : (
                'Player 1'
              )}
            </h2>
            
            {isLoading1 ? (
              <div className="flex items-center justify-center h-64 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-500 dark:text-gray-400">Loading player data...</p>
                </div>
              </div>
            ) : player1 ? (
              <div className="space-y-6">
                {/* Player Card Column */}
                <div className="flex flex-col items-center space-y-4 p-[5px]">
                  <PlayerImage player={player1} />
                  <div className="w-full max-w-[400px]">
                    <PlayerStatsGrid player={player1} />
                  </div>
                </div>

                {/* Position Ratings Column */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-[5px] p-[5px]">Position Ratings</h3>
                  <div className="w-full p-[5px]">
                    <PositionRatingsDisplay player={player1} />
                  </div>
                </div>

                {/* Progression Graph Column */}
                <div className="w-full">
                  <PlayerProgressionGraph 
                    playerId={player1.id.toString()} 
                    playerName={`${player1.metadata.firstName} ${player1.metadata.lastName}`}
                    playerPositions={player1.metadata.positions}
                  />
                </div>

                {/* Sale History Column */}
                <div className="w-full p-[5px]">
                  <PlayerSaleHistory 
                    playerId={player1.id.toString()} 
                    playerName={`${player1.metadata.firstName} ${player1.metadata.lastName}`}
                    playerMetadata={player1.metadata}
                    marketValueEstimate={marketValueEstimate1}
                  />
                </div>

                {/* Recent Matches Column */}
                <div className="w-full p-[5px]">
                  <PlayerRecentMatches 
                    playerId={player1.id.toString()} 
                    playerName={`${player1.metadata.firstName} ${player1.metadata.lastName}`}
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                <div className="text-center">
                  <p className="text-gray-500 dark:text-gray-400">Enter a player ID to load player data</p>
                </div>
              </div>
            )}
          </div>

          {/* Player 2 Column */}
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 text-center">
              {player2 ? (
                <div className="flex flex-col items-center space-y-2">
                  <span>{player2.metadata.firstName} {player2.metadata.lastName}</span>
                  <a 
                    href={`/players/${player2.id}`}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline transition-colors"
                  >
                    Full Profile
                  </a>
                </div>
              ) : (
                'Player 2'
              )}
            </h2>
            
            {isLoading2 ? (
              <div className="flex items-center justify-center h-64 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-500 dark:text-gray-400">Loading player data...</p>
                </div>
              </div>
            ) : player2 ? (
              <div className="space-y-6">
                {/* Player Card Column */}
                <div className="flex flex-col items-center space-y-4 p-[5px]">
                  <PlayerImage player={player2} />
                  <div className="w-full max-w-[400px]">
                    <PlayerStatsGrid player={player2} />
                  </div>
                </div>

                {/* Position Ratings Column */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-[5px] p-[5px]">
                    Position Ratings
                  </h3>
                  <div className="w-full p-[5px]">
                    <PositionRatingsDisplay player={player2} />
                  </div>
                </div>

                {/* Progression Graph Column */}
                <div className="w-full">
                  <PlayerProgressionGraph 
                    playerId={player2.id.toString()} 
                    playerName={`${player2.metadata.firstName} ${player2.metadata.lastName}`}
                    playerPositions={player2.metadata.positions}
                  />
                </div>

                {/* Sale History Column */}
                <div className="w-full p-[5px]">
                  <PlayerSaleHistory 
                    playerId={player2.id.toString()} 
                    playerName={`${player2.metadata.firstName} ${player2.metadata.lastName}`}
                    playerMetadata={player2.metadata}
                    marketValueEstimate={marketValueEstimate2}
                  />
                </div>

                {/* Recent Matches Column */}
                <div className="w-full p-[5px]">
                  <PlayerRecentMatches 
                    playerId={player2.id.toString()} 
                    playerName={`${player2.metadata.firstName} ${player2.metadata.lastName}`}
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                <div className="text-center">
                  <p className="text-gray-500 dark:text-gray-400">Enter a player ID to load player data</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const ComparePage = () => {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white dark:bg-[#121213] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">Loading compare page...</p>
        </div>
      </div>
    }>
      <ComparePageContent />
    </Suspense>
  );
};

export default ComparePage;
