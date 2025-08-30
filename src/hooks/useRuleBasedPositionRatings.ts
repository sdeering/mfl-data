import { useState, useEffect } from 'react';
import { calculateAllPositionOVRs, calculatePositionOVR } from '../utils/ruleBasedPositionCalculator';
import { PlayerForOVRCalculation, AllPositionOVRResults, PositionOVRResult, MFLPosition } from '../types/positionOvr';

interface UseRuleBasedPositionRatingsReturn {
  positionRatings: AllPositionOVRResults | null;
  isLoading: boolean;
  error: string | null;
  calculateRating: (position: MFLPosition) => PositionOVRResult | null;
}

/**
 * React hook for calculating rule-based position ratings
 */
export function useRuleBasedPositionRatings(player: PlayerForOVRCalculation): UseRuleBasedPositionRatingsReturn {
  const [positionRatings, setPositionRatings] = useState<AllPositionOVRResults | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!player) {
      setPositionRatings(null);
      setError(null);
      return;
    }

    const calculateRatings = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Since our calculator is synchronous, we can call it directly
        const results = calculateAllPositionOVRs(player);
        setPositionRatings(results);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to calculate position ratings');
        setPositionRatings(null);
      } finally {
        setIsLoading(false);
      }
    };

    calculateRatings();
  }, [player]);

  const calculateRating = (position: MFLPosition): PositionOVRResult | null => {
    if (!player) return null;

    try {
      return calculatePositionOVR(player, position);
    } catch (err) {
      console.error(`Error calculating rating for position ${position}:`, err);
      return null;
    }
  };

  return {
    positionRatings,
    isLoading,
    error,
    calculateRating
  };
}

/**
 * Hook for calculating a single position rating
 */
export function useSinglePositionRating(
  player: PlayerForOVRCalculation | null,
  position: MFLPosition
): { rating: PositionOVRResult | null; isLoading: boolean; error: string | null } {
  const [rating, setRating] = useState<PositionOVRResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!player) {
      setRating(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = calculatePositionOVR(player, position);
      setRating(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to calculate position rating');
      setRating(null);
    } finally {
      setIsLoading(false);
    }
  }, [player, position]);

  return { rating, isLoading, error };
}
