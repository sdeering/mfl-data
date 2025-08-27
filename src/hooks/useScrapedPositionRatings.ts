import { useState, useEffect, useCallback } from 'react';
import { scrapePositionRatings, ScrapedPositionRating } from '../services/mflPlayerInfoScraper';

interface UseScrapedPositionRatingsReturn {
  positionRatings: ScrapedPositionRating[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useScrapedPositionRatings(player: any): UseScrapedPositionRatingsReturn {
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
    } catch (err) {
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
