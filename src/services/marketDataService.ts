// Market Data Service for fetching comparable player listings
// Used for market value estimation
// 
// NOTE: The external API requires authentication (API key) which we don't currently have.
// When the API call fails, the system falls back to a simple calculation based on overall rating.

import { cacheService } from './cacheService';

// Rate limiter to protect external API
class RateLimiter {
  private calls: number[] = [];
  private readonly maxCalls: number;
  private readonly timeWindow: number; // in milliseconds

  constructor(maxCalls: number = 10, timeWindowMs: number = 60000) { // 10 calls per minute
    this.maxCalls = maxCalls;
    this.timeWindow = timeWindowMs;
  }

  canMakeCall(): boolean {
    const now = Date.now();
    // Remove calls older than the time window
    this.calls = this.calls.filter(callTime => now - callTime < this.timeWindow);
    
    return this.calls.length < this.maxCalls;
  }

  recordCall(): void {
    this.calls.push(Date.now());
  }

  getRemainingCalls(): number {
    const now = Date.now();
    this.calls = this.calls.filter(callTime => now - callTime < this.timeWindow);
    return Math.max(0, this.maxCalls - this.calls.length);
  }

  getTimeUntilReset(): number {
    if (this.calls.length === 0) return 0;
    const oldestCall = Math.min(...this.calls);
    return Math.max(0, this.timeWindow - (Date.now() - oldestCall));
  }
}

// Global rate limiter instance
const marketDataRateLimiter = new RateLimiter(10, 60000); // 10 calls per minute

export interface MarketListing {
  listingResourceId: string;
  price: number;
  player: {
    metadata: {
      overall: number;
      age: number;
      positions: string[];
    };
  };
}

export interface MarketDataResponse {
  success: boolean;
  data: MarketListing[];
  error?: string;
}

export async function fetchMarketData(params: {
  positions: string[];
  ageMin: number;
  ageMax: number;
  overallMin: number;
  overallMax: number;
  limit?: number;
}): Promise<MarketDataResponse> {
  try {
    const { positions, ageMin, ageMax, overallMin, overallMax, limit = 50 } = params;
    
    // Check rate limit before making API call
    if (!marketDataRateLimiter.canMakeCall()) {
      const remainingCalls = marketDataRateLimiter.getRemainingCalls();
      const timeUntilReset = marketDataRateLimiter.getTimeUntilReset();
      console.warn(`⚠️ Rate limit exceeded! ${remainingCalls} calls remaining. Reset in ${Math.ceil(timeUntilReset / 1000)}s`);
      
      return {
        success: false,
        data: [],
        error: `Rate limit exceeded. ${remainingCalls} calls remaining. Reset in ${Math.ceil(timeUntilReset / 1000)} seconds.`
      };
    }
    
    // Build query parameters
    const queryParams = new URLSearchParams({
      limit: limit.toString(),
      type: 'PLAYER',
      status: 'AVAILABLE',
      view: 'full',
      sorts: 'listing.price',
      sortsOrders: 'ASC',
      ageMin: ageMin.toString(),
      ageMax: ageMax.toString(),
      overallMin: overallMin.toString(),
      overallMax: overallMax.toString(),
      positions: positions.join(','),
      onlyPrimaryPosition: 'true'  // Only include primary position matches
    });

    const url = `https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/listings?${queryParams}`;

    // Check cache first
    const cachedData = cacheService.get(url);
    if (cachedData) {
      
      return cachedData;
    }

    console.log(`🔍 Fetching market data from: ${url}`);
    
    // Use our server-side API route to avoid CORS issues
    // Handle both frontend (relative URL) and backend (absolute URL) contexts
    const baseUrl = typeof window !== 'undefined' 
      ? '' // Frontend context - use relative URL
      : 'http://localhost:3000'; // Backend context - use absolute URL
    
    const apiUrl = `${baseUrl}/api/market-data?${new URLSearchParams({
      limit: limit.toString(),
      type: 'PLAYER',
      status: 'AVAILABLE',
      view: 'full',
      sorts: 'listing.price',
      sortsOrders: 'ASC',
      ageMin: ageMin.toString(),
      ageMax: ageMax.toString(),
      overallMin: overallMin.toString(),
      overallMax: overallMax.toString(),
      positions: positions.join(','),
      onlyPrimaryPosition: 'true'
    }).toString()}`;
    
    let response;
    try {
      response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      // Record the API call in rate limiter
      marketDataRateLimiter.recordCall();
    } catch (fetchError) {
      console.warn(`⚠️ Network error fetching market data:`, fetchError);
      return {
        success: false,
        data: [],
        error: `Network error - unable to reach market data API: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`
      };
    }
    
    if (!response.ok) {
      return {
        success: false,
        data: [],
        error: `HTTP error! status: ${response.status} - ${response.statusText}`
      };
    }
    
    let result;
    try {
      result = await response.json();
    } catch (jsonError) {
      console.warn(`⚠️ Error parsing market data JSON:`, jsonError);
      return {
        success: false,
        data: [],
        error: `Invalid JSON response from market data API`
      };
    }
    
    // Extract data from our API response
    const data = result.success ? result.data : [];
    
    const marketDataResult = {
      success: true,
      data: Array.isArray(data) ? data : []
    };

    // Cache the result
    cacheService.set(apiUrl, marketDataResult);

    return marketDataResult;
  } catch (error) {
    console.error('❌ Error fetching market data:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        errorMessage = 'Request timeout - market data API is slow or unreachable';
      } else if (error.message.includes('Failed to fetch')) {
        errorMessage = 'Network error - unable to reach market data API';
      } else if (error.message.includes('HTTP error')) {
        errorMessage = error.message;
      } else {
        errorMessage = error.message;
      }
    }
    
    return {
      success: false,
      data: [],
      error: errorMessage
    };
  }
}
