'use client';

import React, { useState, useEffect } from 'react';
import { fetchPlayerMatches } from '../services/playerMatchesService';
import type { PlayerMatchStats } from '../types/playerMatches';

interface PlayerRecentMatchesProps {
  playerId: string;
  playerName: string;
}

export default function PlayerRecentMatches({ playerId, playerName }: PlayerRecentMatchesProps) {
  const [matches, setMatches] = useState<PlayerMatchStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllMatches, setShowAllMatches] = useState(false);
  const [enabledMatchTypes, setEnabledMatchTypes] = useState<Set<string>>(new Set(['League', 'Cup']));

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

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getMatchType = (competitionName: string): string => {
    const name = competitionName.toLowerCase();
    if (name.includes('cup') || name.includes('championship') || name.includes('trophy')) {
      return 'Cup';
    }
    return 'League';
  };

  const getDivisionBadge = (competitionName: string): string => {
    const name = competitionName.toLowerCase();
    if (name.includes('stone')) return 'Stone';
    if (name.includes('iron')) return 'Iron';
    if (name.includes('bronze')) return 'Bronze';
    if (name.includes('silver')) return 'Silver';
    if (name.includes('gold')) return 'Gold';
    if (name.includes('platinum')) return 'Platinum';
    if (name.includes('diamond')) return 'Diamond';
    if (name.includes('master')) return 'Master';
    if (name.includes('legendary')) return 'Legendary';
    return '';
  };

  const getDivisionColor = (division: string): string => {
    switch (division.toLowerCase()) {
      case 'stone': return 'bg-gray-500 text-white';
      case 'iron': return 'bg-gray-700 text-white';
      case 'bronze': return 'bg-amber-600 text-white';
      case 'silver': return 'bg-gray-400 text-gray-900';
      case 'gold': return 'bg-yellow-500 text-gray-900';
      case 'platinum': return 'bg-blue-400 text-white';
      case 'diamond': return 'bg-purple-500 text-white';
      case 'master': return 'bg-orange-500 text-white';
      case 'legendary': return 'bg-red-600 text-white';
      default: return 'bg-gray-200 text-gray-700';
    }
  };

  const formatMinutes = (seconds: number) => {
    const minutes = Math.round(seconds / 60);
    return `${minutes}m`;
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

  const toggleMatchType = (matchType: string) => {
    if (matchType === 'All') {
      setEnabledMatchTypes(new Set(['League', 'Cup']));
    } else {
      const newEnabledTypes = new Set(enabledMatchTypes);
      if (newEnabledTypes.has(matchType)) {
        newEnabledTypes.delete(matchType);
      } else {
        newEnabledTypes.add(matchType);
      }
      setEnabledMatchTypes(newEnabledTypes);
    }
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
        </div>
        <div className="flex items-center justify-center h-48">
          <div className="text-center text-gray-500 dark:text-gray-400">
            <p className="text-sm">No matches available</p>
          </div>
        </div>
      </div>
    );
  }

  // Filter out friendlies and by match type, then sort by date (most recent first)
  const filteredMatches = matches
    .filter(match => {
      const competitionName = match.match.competition.name.toLowerCase();
      if (competitionName.includes('friendly')) return false;
      
      const matchType = getMatchType(match.match.competition.name);
      return enabledMatchTypes.has(matchType);
    })
    .sort((a, b) => b.match.startDate - a.match.startDate);

  const displayedMatches = showAllMatches ? filteredMatches : filteredMatches.slice(0, 5);

  return (
    <div className="w-full p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Matches</h3>
        
        {/* Match Type Toggles */}
        <div className="mt-3 flex flex-wrap gap-1">
          <button
            onClick={() => toggleMatchType('All')}
            className={`px-3 py-1 text-sm font-bold rounded-full border transition-colors ${
              enabledMatchTypes.size === 2
                ? 'text-white border-transparent bg-blue-500'
                : 'text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600'
            }`}
          >
            All
          </button>
          <button
            onClick={() => toggleMatchType('League')}
            className={`px-3 py-1 text-sm font-bold rounded-full border transition-colors ${
              enabledMatchTypes.has('League')
                ? 'text-white border-transparent bg-green-500'
                : 'text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600'
            }`}
          >
            League
          </button>
          <button
            onClick={() => toggleMatchType('Cup')}
            className={`px-3 py-1 text-sm font-bold rounded-full border transition-colors ${
              enabledMatchTypes.has('Cup')
                ? 'text-white border-transparent bg-purple-500'
                : 'text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600'
            }`}
          >
            Cup
          </button>
        </div>
      </div>
      
      {/* Recent Matches */}
      <div className="space-y-3">
        {displayedMatches.map((match) => {
          const matchType = getMatchType(match.match.competition.name);
          const division = getDivisionBadge(match.match.competition.name);
          const divisionColor = getDivisionColor(division);
          
          return (
            <div 
              key={match.id} 
              className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                                  <div className="flex items-center space-x-2 mb-1">
                  <span className="text-base font-bold text-gray-900 dark:text-white">
                    {match.stats.position}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    matchType === 'Cup' 
                      ? 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200' 
                      : 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                  }`}>
                    {matchType}
                  </span>
                    {division && (
                      <span className={`text-xs px-2 py-1 rounded font-medium ${divisionColor}`}>
                        {division}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {match.match.homeTeamName} vs {match.match.awayTeamName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDate(match.match.startDate)} • {match.match.competition.name}
                  </p>
                </div>
                <div className="text-right">
                  <span className={`text-[20px] font-bold ${getRatingColor(match.stats.rating)}`}>
                    {formatRating(match.stats.rating)}
                  </span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    rating
                  </p>
                </div>
              </div>
            </div>
          );
        })}
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
