import type { PlayerSaleHistory, PlayerSaleHistoryEntry } from '../types/playerSaleHistory';

// Cache for player sale history data
const cache = new Map<string, { data: PlayerSaleHistory; timestamp: number }>();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

const isCacheValid = (timestamp: number): boolean => {
  return Date.now() - timestamp < CACHE_DURATION;
};

/**
 * Fetch player sale history from the MFL API
 */
export async function fetchPlayerSaleHistory(playerId: string, limit: number = 25): Promise<PlayerSaleHistory> {
  const cacheKey = `player_sale_history_${playerId}_${limit}`;
  const cached = cache.get(cacheKey);
  
  if (cached && isCacheValid(cached.timestamp)) {
    console.log(`🎯 CACHE HIT: Using cached player sale history data for ${cacheKey}`);
    return cached.data;
  }

  try {
    console.log(`🚀 CACHE MISS: Fetching player sale history data from API for ${cacheKey}`);
    const url = `https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/listings/feed?limit=${limit}&playerId=${playerId}`;
    
    // Handle network errors gracefully
    let response;
    try {
      response = await fetch(url);
    } catch (networkError) {
      console.warn(`⚠️ Network error - unable to reach player sale history API: ${networkError}`);
      const errorResult: PlayerSaleHistory = {
        success: false,
        data: [],
        error: `Network error - unable to reach player sale history API: ${networkError}`
      };
      return errorResult;
    }
    
    if (!response.ok) {
      console.warn(`⚠️ HTTP error for player sale history API: ${response.status} ${response.statusText}`);
      const errorResult: PlayerSaleHistory = {
        success: false,
        data: [],
        error: `HTTP error! status: ${response.status}`
      };
      return errorResult;
    }

    let data: PlayerSaleHistoryEntry[];
    try {
      data = await response.json();
    } catch (jsonError) {
      console.warn(`⚠️ JSON parsing error for player sale history: ${jsonError}`);
      const errorResult: PlayerSaleHistory = {
        success: false,
        data: [],
        error: `JSON parsing error: ${jsonError}`
      };
      return errorResult;
    }
    
    const result: PlayerSaleHistory = {
      success: true,
      data: data
    };

    // Cache the successful result
    cache.set(cacheKey, { data: result, timestamp: Date.now() });
    
    return result;
  } catch (error) {
    console.error('Error in fetchPlayerSaleHistory:', error);
    const errorResult: PlayerSaleHistory = {
      success: false,
      data: [],
      error: error instanceof Error ? error.message : 'Failed to fetch sale history'
    };
    
    // Don't cache errors
    return errorResult;
  }
}
