import { useState, useEffect, useCallback } from 'react';
import { scrapePositionRatings } from '../services/mflPlayerInfoScraper';
import type { ScrapedPositionRating } from '../types/positionOvr';

interface UseScrapedPositionRatingsReturn {
  positionRatings: ScrapedPositionRating[];
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
  };
}

export function useScrapedPositionRatings(player: Player): UseScrapedPositionRatingsReturn {
  const [positionRatings, setPositionRatings] = useState<ScrapedPositionRating[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPositionRatings = useCallback(async () => {
    if (!player?.id) return;

    setIsLoading(true);
    setError(null);

    try {
      const scrapedData = await scrapePositionRatings(player.id.toString());
      
      if (scrapedData.success && scrapedData.positionRatings.length > 0) {
        setPositionRatings(scrapedData.positionRatings);
      } else {
        // No ratings available - don't show dummy data
        setPositionRatings([]);
        if (scrapedData.error) {
          setError(scrapedData.error);
        }
      }
    } catch {
      // On any error, just return empty array - no dummy data
      setPositionRatings([]);
      setError('Failed to fetch position ratings');
    } finally {
      setIsLoading(false);
    }
  }, [player?.id]);

  useEffect(() => {
    fetchPositionRatings();
  }, [fetchPositionRatings]);

  return {
    positionRatings,
    isLoading,
    error,
    refetch: fetchPositionRatings
  };
}
