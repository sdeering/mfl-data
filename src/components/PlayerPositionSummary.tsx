'use client';

import React, { useState, useEffect } from 'react';
import { fetchPlayerMatches } from '../services/playerMatchesService';
import type { PlayerMatchStats, PositionSummary } from '../types/playerMatches';

interface PlayerPositionSummaryProps {
  playerId: string;
  playerName: string;
}

export default function PlayerPositionSummary({ playerId, playerName }: PlayerPositionSummaryProps) {
  const [matches, setMatches] = useState<PlayerMatchStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadMatches = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetchPlayerMatches(playerId);
        
        if (response.success && response.data.length > 0) {
          setMatches(response.data);
        } else {
          setError(response.error || 'No matches available');
        }
      } catch (err) {
        console.error('Error fetching matches:', err);
        setError('Failed to load matches');
      } finally {
        setIsLoading(false);
      }
    };

    if (playerId) {
      loadMatches();
    }
  }, [playerId]);

  // Calculate position summaries
  const calculatePositionSummaries = (): PositionSummary[] => {
    const positionMap = new Map<string, PlayerMatchStats[]>();
    
    matches.forEach(match => {
      const position = match.stats.position;
      if (!positionMap.has(position)) {
        positionMap.set(position, []);
      }
      positionMap.get(position)!.push(match);
    });

    return Array.from(positionMap.entries()).map(([position, positionMatches]) => {
      const totalRating = positionMatches.reduce((sum, match) => sum + match.stats.rating, 0);
      const totalMinutes = positionMatches.reduce((sum, match) => sum + (match.stats.time / 60), 0);
      const totalGoals = positionMatches.reduce((sum, match) => sum + match.stats.goals, 0);
      const totalAssists = positionMatches.reduce((sum, match) => sum + match.stats.assists, 0);

      return {
        position,
        matches: positionMatches.length,
        averageRating: totalRating / positionMatches.length,
        totalMinutes: Math.round(totalMinutes),
        totalGoals,
        totalAssists,
        averageGoals: totalGoals / positionMatches.length,
        averageAssists: totalAssists / positionMatches.length,
      };
    }).sort((a, b) => b.matches - a.matches); // Sort by number of matches
  };

  const formatRating = (rating: number) => {
    return rating.toFixed(2);
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 8.0) return 'text-[#00adc3]';
    if (rating >= 7.0) return 'text-[#00c424]';
    if (rating >= 6.0) return 'text-[#d7af00]';
    return 'text-red-600';
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="w-full p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="w-full p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-center h-48">
          <div className="text-center text-gray-500 dark:text-gray-400">
            <p className="text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // No data state
  if (matches.length === 0) {
    return (
      <div className="w-full p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Match Position Ratings</h3>
      </div>
        <div className="flex items-center justify-center h-48">
          <div className="text-center text-gray-500 dark:text-gray-400">
            <p className="text-sm">No matches available</p>
          </div>
        </div>
      </div>
    );
  }

  const positionSummaries = calculatePositionSummaries();

  return (
    <div className="w-full p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Match Position Ratings</h3>
      </div>

      {/* Position Summaries */}
      {positionSummaries.length > 0 && (
        <div>
          <h4 className="text-base text-gray-500 dark:text-gray-400 mb-3">Position Summary (last {matches.length} matches)</h4>
          <div className="space-y-2">
            {positionSummaries.map((summary) => (
              <div 
                key={summary.position}
                className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
              >
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                                        <div className="flex items-center space-x-2">
                      <span className="text-base font-bold text-gray-900 dark:text-white">
                        {summary.position}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {summary.matches} matches • {summary.totalGoals} goals • {summary.totalAssists} assists
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`text-[20px] font-bold ${getRatingColor(summary.averageRating)}`}>
                      {formatRating(summary.averageRating)}
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      avg rating
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
