import { ScrapedPlayerData } from '../types/positionOvr';

/**
 * MFL Player Info Service
 * Uses backend API to fetch position ratings data
 */

/**
 * Fetch position ratings data via backend API
 */
export async function scrapePositionRatings(playerId: string): Promise<ScrapedPlayerData> {
  try {
    // Use our backend API route to fetch data quietly
    const response = await fetch(`/api/player-ratings?playerId=${playerId}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Only return data if scraping was successful and we have ratings
    if (data.success && data.positionRatings && data.positionRatings.length > 0) {
      return {
        playerId,
        positionRatings: data.positionRatings,
        success: true
      };
    } else {
      // If scraping fails, try to calculate ratings as fallback
      try {
        // This would need the player data to calculate ratings
        // For now, return empty array - we'll need to pass player data to this function
        return {
          playerId,
          positionRatings: [],
          success: false,
          error: data.error || 'No position ratings available'
        };
      } catch {
        // Return empty array if both scraping and calculation fail
        return {
          playerId,
          positionRatings: [],
          success: false,
          error: data.error || 'No position ratings available'
        };
      }
    }
    
  } catch (error) {
    // Return empty array on any error - no dummy data
    return {
      playerId,
      positionRatings: [],
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
