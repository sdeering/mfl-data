import type { PlayerMatchesResponse } from '../types/playerMatches';

// Cache for player matches data
const cache = new Map<string, { data: PlayerMatchesResponse; timestamp: number }>();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

// Track in-flight requests to prevent duplicate API calls
const inFlightRequests = new Map<string, Promise<PlayerMatchesResponse>>();

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

  // Check if there's already an in-flight request for this player
  const inFlightRequest = inFlightRequests.get(cacheKey);
  if (inFlightRequest) {
    console.log(`⏳ Request already in-flight for ${cacheKey}, waiting for existing request...`);
    return inFlightRequest;
  }

  // Create a new request promise
  const requestPromise = (async () => {
    try {
      console.log(`🚀 CACHE MISS: Fetching player matches data from API for ${cacheKey}`);
      
      // Detect environment: use proxy in browser, direct API in Node/test
      const hasDom = typeof window !== 'undefined' && typeof document !== 'undefined';
      const isTest = typeof process !== 'undefined' && !!(process.env?.JEST_WORKER_ID || process.env?.NODE_ENV === 'test');
      const isBrowserRuntime = hasDom && !isTest;

      let response;
      if (isBrowserRuntime) {
        // Use proxy API route to avoid CORS issues in browser
        const proxyUrl = `/api/players/${playerId}/matches?limit=25`;
        console.log(`🌐 Using proxy API route: ${proxyUrl}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        try {
          response = await fetch(proxyUrl, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
            },
            signal: controller.signal
          });
          clearTimeout(timeoutId);
        } catch (error) {
          clearTimeout(timeoutId);
          throw error;
        }
      } else {
        // In Node.js/test environment, use direct MFL API call
        response = await fetch(
          `https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/players/${playerId}/matches/stats?limit=25`
        );
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const resultData = await response.json();
      
      // Handle proxy response format { success: true, data: [...] }
      const data = resultData.data || resultData;

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
    } finally {
      // Remove from in-flight requests once done
      inFlightRequests.delete(cacheKey);
    }
  })();

  // Store the in-flight request
  inFlightRequests.set(cacheKey, requestPromise);
  
  return requestPromise;
};
