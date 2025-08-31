// Market Data Service for fetching comparable player listings
// Used for market value estimation

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
      onlyPrimaryPosition: 'false'
    });

    const url = `https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/listings?${queryParams}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    return {
      success: true,
      data: Array.isArray(data) ? data : []
    };
  } catch (error) {
    console.error('Error fetching market data:', error);
    return {
      success: false,
      data: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
