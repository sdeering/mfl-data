'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRuleBasedPositionRatings } from '../hooks/useRuleBasedPositionRatings';
import type { MFLPosition, PlayerForOVRCalculation } from '../types/positionOvr';
import { getTierColors } from '../utils/tierColors';
import { fetchPlayerMatches } from '../services/playerMatchesService';
import type { PlayerMatchStats, PositionSummary } from '../types/playerMatches';
import { OverallRatingTooltip } from './OverallRatingTooltip';
import { btnSecondary } from './ui';

// Row tint by how the position compares to the primary one: bright for the primary (or a position the player
// rates as well in matches), fading green just below it, red well below it
const getRowTint = (isBright: boolean, difference: number) => {
  const [background, borderColor] = isBright ? ['rgba(138,230,58,.34)', 'rgba(138,230,58,.8)']
    : difference >= -1 ? ['rgba(138,230,58,.14)', 'rgba(138,230,58,.35)']
    : difference >= -6 ? ['rgba(138,230,58,.07)', 'rgba(138,230,58,.2)']
    : difference >= -17 ? ['rgba(239,68,68,.09)', 'rgba(239,68,68,.22)']
    : ['rgba(239,68,68,.17)', 'rgba(239,68,68,.35)'];
  return { background, borderColor };
};

const getMatchRatingColor = (rating: number) => {
  if (rating >= 8.0) return 'text-rt-cyan';
  if (rating >= 7.0) return 'text-rt-green';
  if (rating >= 6.0) return 'text-warn-ink';
  return 'text-danger-ink';
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
  // Average match rating per position, from the player's matches
  showMatchRatings?: boolean;
}

export default function PositionRatingsDisplay({ player, showMatchRatings = true }: PositionRatingsDisplayProps) {
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
      <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted">
        <div className="animate-spin rounded-full h-4 w-4 border-2 border-accent border-t-transparent"></div>
        <span>Calculating position ratings...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="py-6 text-center text-sm text-muted">
        <p className="m-0">No position ratings available</p>
      </div>
    );
  }

  // No ratings available
  if (!positionRatings || !positionRatings.success || !positionRatings.results) {
    return (
      <div className="py-6 text-center text-sm text-muted">
        <p className="m-0">No position ratings available</p>
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
        difference: result.ovr - player.metadata.overall
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

  // A position the player rates as well in matches as their primary one is highlighted like the primary
  const primaryMatchRating = showMatchRatings
    ? matchPositionRatings.find(mr => mr.position === sortedRatings.find(r => r.familiarity === 'PRIMARY')?.position)?.averageRating
    : undefined;

  return (
    <div className="flex flex-col gap-2">
      {displayedRatings.map((rating, index) => {
        const matchRating = showMatchRatings ? matchPositionRatings.find(mr => mr.position === rating.position) : undefined;
        return (
          <PositionRatingItem 
            key={`${rating.position}-${index}`} 
            rating={rating} 
            player={player} 
            matchRating={matchRating}
            primaryMatchRating={primaryMatchRating}
          />
        );
      })}
      
      {/* Show More/Less Button */}
      {sortedRatings.length > 6 && (
        <button
          onClick={() => setShowAllPositions(!showAllPositions)}
          className={`${btnSecondary} w-full mt-1.5 text-fg-2`}
        >
          {showAllPositions 
            ? `Show Less Positions` 
            : `Show ${sortedRatings.length - 6} More Positions`
          }
        </button>
      )}
    </div>
  );
}

// Individual position rating item component
function PositionRatingItem({ rating, player, matchRating, primaryMatchRating }: { 
  rating: {
    position: MFLPosition;
    rating: number;
    familiarity: 'PRIMARY' | 'SECONDARY' | 'UNFAMILIAR';
    difference: number;
  }; 
  player: PositionRatingsDisplayProps['player'];
  matchRating?: PositionSummary;
  primaryMatchRating?: number;
}) {
  const { position, familiarity, difference, rating: ratingValue } = rating;
  
  const tierColors = getTierColors(ratingValue);
  const isBright = familiarity === 'PRIMARY' ||
    (matchRating !== undefined && primaryMatchRating !== undefined && matchRating.averageRating >= primaryMatchRating);
  const ringClass = familiarity === 'PRIMARY' ? 'border-[#8ae63a]'
    : familiarity === 'SECONDARY' ? 'border-[#f97316]'
    : 'border-line-2';

  const ratingChip = (
    <div
      className="grid place-items-center w-11 h-[38px] rounded-[10px] font-display text-lg font-extrabold tabular-nums"
      style={{ background: tierColors.bg, color: tierColors.fg }}
    >
      {ratingValue}
    </div>
  );

  return (
    <div
      className="flex items-center gap-3 h-14 pl-2 pr-2.5 rounded-[14px] border transition-colors"
      style={getRowTint(isBright, difference)}
    >
      <span className={`grid place-items-center min-w-11 h-[38px] px-1.5 rounded-[10px] border-2 bg-field text-[13px] font-extrabold text-fg ${ringClass}`}>
        {position}
      </span>
      {matchRating && (
        <div className="relative group">
          <span className={`font-display text-xl font-extrabold tabular-nums ${getMatchRatingColor(matchRating.averageRating)} cursor-help`}>
            {matchRating.averageRating.toFixed(2)}
          </span>
          {/* Tooltip */}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 rounded-xl border border-line-2 bg-panel text-fg text-xs font-semibold shadow-[0_12px_30px_rgba(0,0,0,.4)] opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
            {matchRating.matches} {matchRating.matches === 1 ? 'game' : 'games'}
          </div>
        </div>
      )}
      {familiarity === 'PRIMARY' && (
        <span className="text-xs font-semibold text-fg-3">
          Primary
        </span>
      )}
      {familiarity === 'SECONDARY' && (
        <span className="text-xs font-semibold text-fg-3">
          Secondary
        </span>
      )}
      <span className="flex-1" />
      {difference !== 0 && (
        <span className={`font-mono text-[13px] font-semibold ${difference > 0 ? 'text-green-600 dark:text-green-400' : 'text-muted'}`}>
          {difference > 0 ? '+' : ''}{difference}
        </span>
      )}
      {(familiarity === 'PRIMARY' || familiarity === 'SECONDARY') ? (
        <OverallRatingTooltip player={player} position={position}>
          {ratingChip}
        </OverallRatingTooltip>
      ) : (
        ratingChip
      )}
    </div>
  );
}
