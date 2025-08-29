import { useState, useEffect, useCallback } from 'react';
import { calculateAllPositionOVRs } from '../utils/positionOvrCalculator';
import type { MFLPosition } from '../types/positionOvr';

interface UseMLPositionRatingsReturn {
  positionRatings: Array<{
    position: MFLPosition;
    rating: number;
    familiarity: 'PRIMARY' | 'SECONDARY' | 'UNFAMILIAR';
    difference: number;
  }>;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

interface Player {
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
  };
}

export function useMLPositionRatings(player: Player): UseMLPositionRatingsReturn {
  const [positionRatings, setPositionRatings] = useState<Array<{
    position: MFLPosition;
    rating: number;
    familiarity: 'PRIMARY' | 'SECONDARY' | 'UNFAMILIAR';
    difference: number;
  }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculatePositionRatings = useCallback(async () => {
    if (!player?.id) return;

    setIsLoading(true);
    setError(null);

    try {
      // Convert player data to the format expected by the ML calculator
      const playerForCalculation = {
        id: player.id,
        name: `${player.metadata.firstName} ${player.metadata.lastName}`,
        attributes: {
          PAC: player.metadata.pace,
          SHO: player.metadata.shooting,
          PAS: player.metadata.passing,
          DRI: player.metadata.dribbling,
          DEF: player.metadata.defense,
          PHY: player.metadata.physical,
          GK: 0 // Not used in ML calculation
        },
        positions: player.metadata.positions as MFLPosition[],
        overall: player.metadata.overall
      };

      // Use the ML-based calculator
      const results = calculateAllPositionOVRs(playerForCalculation);
      
      if (results.success) {
        // Convert results to the format expected by the component
        const ratings = Object.values(results.results).map(result => ({
          position: result.position,
          rating: result.ovr,
          familiarity: result.familiarity,
          difference: result.penalty
        }));
        
        setPositionRatings(ratings);
      } else {
        setPositionRatings([]);
        setError(results.error?.message || 'Failed to calculate position ratings');
      }
    } catch (err) {
      setPositionRatings([]);
      setError(err instanceof Error ? err.message : 'Failed to calculate position ratings');
    } finally {
      setIsLoading(false);
    }
  }, [player?.id, player?.metadata]);

  useEffect(() => {
    calculatePositionRatings();
  }, [calculatePositionRatings]);

  return {
    positionRatings,
    isLoading,
    error,
    refetch: calculatePositionRatings
  };
}
