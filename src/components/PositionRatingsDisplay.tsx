'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRuleBasedPositionRatings } from '../hooks/useRuleBasedPositionRatings';
import type { MFLPosition, PlayerForOVRCalculation } from '../types/positionOvr';
import { getRatingStyle } from '../utils/ratingUtils';
import { fetchPlayerMatches } from '../services/playerMatchesService';
import type { PlayerMatchStats, PositionSummary } from '../types/playerMatches';

// Function to get tier color based on rating value (same as PlayerStatsGrid)
const getTierColor = (rating: number) => {
  if (rating >= 95) {
    return {
      bg: 'bg-[#87f6f8]',
      text: 'text-black',
      border: 'border-[var(--tier-common-foreground)]/15'
    };
  } else if (rating >= 85) {
    return {
      bg: 'bg-[#fa53ff]',
      text: 'text-white',
      border: 'border-[var(--tier-common-foreground)]/15'
    };
  } else if (rating >= 75) {
    return {
      bg: 'bg-[#0047ff]',
      text: 'text-white',
      border: 'border-[var(--tier-common-foreground)]/15'
    };
  } else if (rating >= 65) {
    return {
      bg: 'bg-[#71ff30]',
      text: 'text-black',
      border: 'border-[var(--tier-common-foreground)]/15'
    };
  } else if (rating >= 55) {
    return {
      bg: 'bg-[#ecd17f]',
      text: 'text-black',
      border: 'border-[var(--tier-common-foreground)]/15'
    };
  } else {
    return {
      bg: 'bg-[#9f9f9f]',
      text: 'text-white',
      border: 'border-[var(--tier-common-foreground)]/15'
    };
  }
};

interface PositionRatingsDisplayProps {
  player: {
    id: number;
    metadata: {
      firstName: string;
      lastName: string;
      overall: number;
      positions: string[];
      pace: number;
      shooting: number;
      passing: number;
      dribbling: number;
      defense: number;
      physical: number;
      goalkeeping?: number;
    };
  };
}

export default function PositionRatingsDisplay({ player }: PositionRatingsDisplayProps) {
  const [showAllPositions, setShowAllPositions] = useState(false);
  const [matchPositionRatings, setMatchPositionRatings] = useState<PositionSummary[]>([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(true);
  
  // Convert player data to the format expected by the rule-based calculator
  // Use useMemo to prevent infinite re-renders
  const playerForOVR = useMemo(() => {
    return {
      id: player.id,
      name: `${player.metadata.firstName} ${player.metadata.lastName}`,
      attributes: {
        PAC: player.metadata.pace,
        SHO: player.metadata.shooting,
        PAS: player.metadata.passing,
        DRI: player.metadata.dribbling,
        DEF: player.metadata.defense,
        PHY: player.metadata.physical,
        GK: player.metadata.goalkeeping || 0 // Use goalkeeping stat if available, default to 0
      },
      positions: player.metadata.positions as MFLPosition[],
      overall: player.metadata.overall
    };
  }, [player.id, player.metadata]);
  
  // Use the rule-based position ratings hook
  const { positionRatings, isLoading, error } = useRuleBasedPositionRatings(playerForOVR);

  // Fetch match position ratings
  useEffect(() => {
    const loadMatchRatings = async () => {
      setIsLoadingMatches(true);
      try {
        const response = await fetchPlayerMatches(player.id.toString());
        if (response.success && response.data.length > 0) {
          // Calculate position summaries
          const positionMap = new Map<string, PlayerMatchStats[]>();
          
          response.data.forEach(match => {
            const position = match.stats.position;
            if (!positionMap.has(position)) {
              positionMap.set(position, []);
            }
            positionMap.get(position)!.push(match);
          });

          const summaries = Array.from(positionMap.entries()).map(([position, positionMatches]) => {
            const totalRating = positionMatches.reduce((sum, match) => sum + match.stats.rating, 0);
            return {
              position,
              matches: positionMatches.length,
              averageRating: totalRating / positionMatches.length,
              totalMinutes: Math.round(positionMatches.reduce((sum, match) => sum + (match.stats.time / 60), 0)),
              totalGoals: positionMatches.reduce((sum, match) => sum + match.stats.goals, 0),
              totalAssists: positionMatches.reduce((sum, match) => sum + match.stats.assists, 0),
              averageGoals: 0,
              averageAssists: 0,
            };
          }).sort((a, b) => b.matches - a.matches);
          
          setMatchPositionRatings(summaries);
        }
      } catch (err) {
        console.error('Error fetching match ratings:', err);
      } finally {
        setIsLoadingMatches(false);
      }
    };

    if (player.id) {
      loadMatchRatings();
    }
  }, [player.id]);

  // Loading state
  if (isLoading) {
    return (
      <div className="text-gray-600 dark:text-gray-400 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span>Calculating position ratings...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="text-gray-600 dark:text-gray-400 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="text-center">
          <p>No position ratings available</p>
        </div>
      </div>
    );
  }

  // No ratings available
  if (!positionRatings || !positionRatings.success || !positionRatings.results) {
    return (
      <div className="text-gray-600 dark:text-gray-400 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="text-center">
          <p>No position ratings available</p>
        </div>
      </div>
    );
  }

  // Convert the results to the format expected by the component
  const ratingsArray = Object.values(positionRatings.results)
    .filter(result => result.success)
    .map(result => {
      // Map rule-based familiarity values to component expected values
      let mappedFamiliarity: 'PRIMARY' | 'SECONDARY' | 'UNFAMILIAR';
      
      if (result.familiarity === 'PRIMARY') {
        mappedFamiliarity = 'PRIMARY';
      } else if (result.familiarity === 'SECONDARY') {
        mappedFamiliarity = 'SECONDARY';
      } else {
        // All other familiarity levels (FAMILIAR, UNFAMILIAR)
        mappedFamiliarity = 'UNFAMILIAR';
      }
      
      return {
        position: result.position,
        rating: result.ovr,
        familiarity: mappedFamiliarity,
        difference: result.penalty
      };
    });

  // Filter positions for goalkeepers
  const filteredRatings = player.metadata.positions.includes('GK') && player.metadata.positions.length === 1
    ? ratingsArray.filter(rating => rating.position === 'GK')
    : ratingsArray.filter(rating => rating.position !== 'GK');

  // Sort by rating (highest first)
  const sortedRatings = [...filteredRatings].sort((a, b) => b.rating - a.rating);

  // Show only top 6 positions initially, or all if showAllPositions is true
  const displayedRatings = showAllPositions ? sortedRatings : sortedRatings.slice(0, 6);

  return (
    <div className="space-y-4">
      {/* Position Ratings Grid */}
      <div className="grid grid-cols-1 gap-3">
        {displayedRatings.map((rating, index) => {
          const matchRating = matchPositionRatings.find(mr => mr.position === rating.position);
          return (
            <PositionRatingItem 
              key={`${rating.position}-${index}`} 
              rating={rating} 
              player={player} 
              matchRating={matchRating}
            />
          );
        })}
      </div>
      
      {/* Show More/Less Button */}
      {sortedRatings.length > 6 && (
        <div className="text-center">
          <button
            onClick={() => setShowAllPositions(!showAllPositions)}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-white transition-all duration-200 font-medium text-sm cursor-pointer"
          >
            {showAllPositions 
              ? `Show Less Positions` 
              : `Show ${sortedRatings.length - 6} More Positions`
            }
          </button>
        </div>
      )}
    </div>
  );
}

// Individual position rating item component
function PositionRatingItem({ rating, player, matchRating }: { 
  rating: {
    position: MFLPosition;
    rating: number;
    familiarity: 'PRIMARY' | 'SECONDARY' | 'UNFAMILIAR';
    difference: number;
  }; 
  player: PositionRatingsDisplayProps['player'];
  matchRating?: PositionSummary;
}) {
  const { position, familiarity, difference, rating: ratingValue } = rating;
  
  const overallRating = player.metadata.overall;
  const tierColors = getTierColor(ratingValue);
  const gradientStyle = getRatingStyle(ratingValue, overallRating);
  
  const getMatchRatingColor = (rating: number) => {
    if (rating >= 8.0) return 'text-[#00adc3]';
    if (rating >= 7.0) return 'text-[#00c424]';
    if (rating >= 6.0) return 'text-[#d7af00]';
    return 'text-red-600';
  };

  return (
    <div
      className={`px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 transition-all duration-200 ${gradientStyle}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className={`text-lg font-bold px-3 py-2 rounded-lg shadow-sm text-gray-900 dark:text-white bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-600 dark:to-gray-700 ${
            familiarity === 'PRIMARY' ? 'border-4 border-green-500' : 
            familiarity === 'SECONDARY' ? 'border-4 border-orange-500' : ''
          }`}>
            {position}
          </span>
          {matchRating && (
            <div className="flex items-center space-x-1">
              <span className={`text-[24px] font-bold ${getMatchRatingColor(matchRating.averageRating)}`} style={{ marginRight: '10px', marginLeft: '4px' }}>
                {matchRating.averageRating.toFixed(2)}
              </span>
              {familiarity === 'PRIMARY' && (
                <span className="text-xs font-semibold text-black dark:text-white">
                  Primary
                </span>
              )}
              {familiarity === 'SECONDARY' && (
                <span className="text-xs font-semibold text-black dark:text-white">
                  Secondary
                </span>
              )}
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {difference !== 0 && (
            <span 
              className="font-medium text-black"
              style={{
                fontSize: difference > 0 
                  ? `${Math.max(0.75, Math.min(1.5, 0.75 + difference * 0.08))}rem`
                  : '0.875rem' // 14px for negative differences
              }}
            >
              {difference > 0 ? '+' : ''}{difference}
            </span>
          )}
          <div 
            className={`font-bold px-3 py-2 rounded-lg shadow-sm ${tierColors.text} ${tierColors.bg} ${tierColors.border}`}
            style={{ fontSize: '22px' }}
          >
            {ratingValue}
          </div>
        </div>
      </div>
    </div>
  );
}
