// Market Data Service for fetching comparable player listings
// Used for market value estimation

import { cacheService } from './cacheService';

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

    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    const result = {
      success: true,
      data: Array.isArray(data) ? data : []
    };

    // Cache the result
    cacheService.set(url, result);

    return result;
  } catch (error) {
    console.error('Error fetching market data:', error);
    return {
      success: false,
      data: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
