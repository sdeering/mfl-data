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

  // Helper functions for league detection (same as Recent Matches)
  const getMatchType = (competitionName: string): string => {
    const name = competitionName.toLowerCase();
    if (name.includes('cup') || name.includes('championship') || name.includes('trophy')) {
      return 'Cup';
    }
    return 'League';
  };

  const getDivisionBadge = (competitionName: string): string => {
    const name = competitionName.toLowerCase();
    if (name.includes('flint')) return 'Flint';
    if (name.includes('ice')) return 'Ice';
    if (name.includes('spark')) return 'Spark';
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
      case 'flint': return 'bg-orange-600 text-white';
      case 'ice': return 'bg-cyan-400 text-gray-900';
      case 'spark': return 'bg-yellow-400 text-gray-900';
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

  // Calculate league summaries
  const calculateLeagueSummaries = () => {
    const leagueMap = new Map<string, PlayerMatchStats[]>();
    
    matches.forEach(match => {
      // Use match.type instead of competition name for type detection
      const matchType = match.match?.type === 'CUP' ? 'Cup' : 'League';
      const competitionName = match.competition?.name || '';
      const division = getDivisionBadge(competitionName);
      
      // Group by match type (League or Cup) and division
      const leagueKey = `${matchType} ${division}`;
      
      if (!leagueMap.has(leagueKey)) {
        leagueMap.set(leagueKey, []);
      }
      leagueMap.get(leagueKey)!.push(match);
    });

    return Array.from(leagueMap.entries())
      .map(([league, leagueMatches]) => {
        const totalRating = leagueMatches.reduce((sum, match) => sum + match.stats.rating, 0);
        return {
          league,
          matches: leagueMatches.length,
          averageRating: totalRating / leagueMatches.length,
          totalGoals: leagueMatches.reduce((sum, match) => sum + match.stats.goals, 0),
          totalAssists: leagueMatches.reduce((sum, match) => sum + match.stats.assists, 0),
        };
      })
      .sort((a, b) => {
        // Sort by match type first (League before Cup), then by matches count
        const aIsLeague = a.league.startsWith('League');
        const bIsLeague = b.league.startsWith('League');
        if (aIsLeague && !bIsLeague) return -1;
        if (!aIsLeague && bIsLeague) return 1;
        return b.matches - a.matches;
      });
  };

  const leagueSummaries = calculateLeagueSummaries();

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

               {/* League Summaries */}
         {leagueSummaries.length > 0 && (
           <div className="mt-6">
             <h4 className="text-base text-gray-500 dark:text-gray-400 mb-3">League Summary (last {matches.length} matches)</h4>
             <div className="space-y-2">
               {leagueSummaries.map((summary) => {
                 const [matchType, division] = summary.league.split(' ');
                 const divisionColor = getDivisionColor(division);
                 
                 return (
                   <div
                     key={summary.league}
                     className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                   >
                     <div className="flex justify-between items-center">
                       <div className="flex-1">
                         <div className="flex items-center space-x-2">
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
                 );
               })}
             </div>
           </div>
         )}
    </div>
  );
}
