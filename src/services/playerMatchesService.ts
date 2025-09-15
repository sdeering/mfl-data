import type { PlayerMatchesResponse } from '../types/playerMatches';

// Cache for player matches data
const cache = new Map<string, { data: PlayerMatchesResponse; timestamp: number }>();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

const isCacheValid = (timestamp: number): boolean => {
  return Date.now() - timestamp < CACHE_DURATION;
};

export const fetchPlayerMatches = async (playerId: string): Promise<PlayerMatchesResponse> => {
  const cacheKey = `player_matches_${playerId}`;
  const cached = cache.get(cacheKey);
  
  if (cached && isCacheValid(cached.timestamp)) {
    console.log(`🎯 CACHE HIT: Using cached player matches data for ${cacheKey}`);
    return cached.data;
  }

  try {
    console.log(`🚀 CACHE MISS: Fetching player matches data from API for ${cacheKey}`);
    const response = await fetch(
      `https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/players/${playerId}/matches/stats?limit=25`
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    const result: PlayerMatchesResponse = {
      success: true,
      data: data
    };

    // Cache the successful result
    cache.set(cacheKey, { data: result, timestamp: Date.now() });
    
    return result;
  } catch (error) {
    console.error('Error fetching player matches:', error);
    const errorResult: PlayerMatchesResponse = {
      success: false,
      data: [],
      error: error instanceof Error ? error.message : 'Failed to fetch player matches'
    };
    
    // Don't cache errors
    return errorResult;
  }
};
