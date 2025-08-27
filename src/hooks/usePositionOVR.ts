import { useState, useEffect, useCallback } from 'react';
import { calculateAllPositionOVRs } from '../utils/positionOvrCalculator';
import { convertMFLPlayerToOVRFormat, isValidForOVRCalculation } from '../utils/playerDataConverter';
import type { MFLPlayer } from '../types/mflApi';
import type { AllPositionOVRResults } from '../types/positionOvr';

interface UsePositionOVRReturn {
  positionOVRs: AllPositionOVRResults | null;
  isLoading: boolean;
  error: string | null;
  recalculate: () => void;
}

export function usePositionOVR(player: MFLPlayer | null): UsePositionOVRReturn {
  const [positionOVRs, setPositionOVRs] = useState<AllPositionOVRResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculateOVRs = useCallback(() => {
    if (!player) {
      setPositionOVRs(null);
      setError(null);
      return;
    }

    if (!isValidForOVRCalculation(player)) {
      setPositionOVRs(null);
      setError('Player data is not valid for OVR calculation');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const playerForOVR = convertMFLPlayerToOVRFormat(player);
      const results = calculateAllPositionOVRs(playerForOVR);
      
      if (results.success) {
        setPositionOVRs(results);
      } else {
        setError(results.error?.message || 'Failed to calculate position OVRs');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to calculate position OVRs';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [player]);

  const recalculate = useCallback(() => {
    calculateOVRs();
  }, [calculateOVRs]);

  // Calculate OVRs when player changes
  useEffect(() => {
    calculateOVRs();
  }, [calculateOVRs]);

  return {
    positionOVRs,
    isLoading,
    error,
    recalculate
  };
}
