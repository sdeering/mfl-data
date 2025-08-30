'use client';

import React, { useState, useEffect } from 'react';
import { fetchPlayerMatches } from '../services/playerMatchesService';
import type { PlayerMatchStats, PositionSummary } from '../types/playerMatches';

interface PlayerMatchesProps {
  playerId: string;
  playerName: string;
}

export default function PlayerMatches({ playerId, playerName }: PlayerMatchesProps) {
  const [matches, setMatches] = useState<PlayerMatchStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllMatches, setShowAllMatches] = useState(false);

  useEffect(() => {
    const loadMatches = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetchPlayerMatches(playerId);
        
        console.log('Player matches response for player', playerId, ':', response);
        
        if (response.success && response.data.length > 0) {
          console.log('Setting matches data:', response.data);
          setMatches(response.data);
        } else {
          console.log('No matches data or error:', response.error);
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

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatMinutes = (seconds: number) => {
    const minutes = Math.round(seconds / 60);
    return `${minutes}m`;
  };

  const formatRating = (rating: number) => {
    return rating.toFixed(2);
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 8.0) return 'text-green-600';
    if (rating >= 7.0) return 'text-blue-600';
    if (rating >= 6.0) return 'text-yellow-600';
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
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Matches</h3>
          <p className="text-base text-gray-500 dark:text-gray-400">No matches</p>
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
  const displayedMatches = showAllMatches ? matches : matches.slice(0, 5);

  return (
    <div className="w-full p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="mb-4">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">Match Position Ratings</h3>
      </div>

      {/* Position Summaries */}
      {positionSummaries.length > 0 && (
        <div className="mb-6">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Position Summary ({matches.length} matches)</h4>
          <div className="space-y-2">
            {positionSummaries.map((summary) => (
              <div 
                key={summary.position}
                className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
              >
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-base font-medium text-gray-900 dark:text-white">
                        {summary.position}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        ({summary.matches} matches)
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {summary.totalMinutes}m • {summary.totalGoals} goals • {summary.totalAssists} assists
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`text-base font-bold ${getRatingColor(summary.averageRating)}`}>
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
      
      {/* Recent Matches */}
      <div className="mb-4">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Matches</h4>
      </div>
      <div className="space-y-3">
        {displayedMatches.map((match) => (
          <div 
            key={match.id} 
            className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
          >
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <span className="text-base font-medium text-gray-900 dark:text-white">
                    {match.stats.position}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {formatMinutes(match.stats.time)}
                  </span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {match.match.homeTeamName} vs {match.match.awayTeamName}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDate(match.match.startDate)} • {match.match.competition.name}
                </p>
              </div>
              <div className="text-right">
                <span className={`text-lg font-bold ${getRatingColor(match.stats.rating)}`}>
                  {formatRating(match.stats.rating)}
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  rating
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Show More/Less Button */}
      {matches.length > 5 && (
        <div className="text-center mt-4">
          <button
            onClick={() => setShowAllMatches(!showAllMatches)}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-white transition-all duration-200 font-medium text-sm cursor-pointer"
          >
            {showAllMatches 
              ? `Show Less Matches` 
              : `Show ${matches.length - 5} More Matches`
            }
          </button>
        </div>
      )}
    </div>
  );
}
