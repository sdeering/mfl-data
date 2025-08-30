import type { PlayerSaleHistory, PlayerSaleHistoryEntry } from '../types/playerSaleHistory';

/**
 * Fetch player sale history from the MFL API
 */
export async function fetchPlayerSaleHistory(playerId: string, limit: number = 25): Promise<PlayerSaleHistory> {
  try {
    console.log('Fetching sale history for player:', playerId);
    const url = `https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/listings/feed?limit=${limit}&playerId=${playerId}`;
    console.log('API URL:', url);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error('HTTP error:', response.status, response.statusText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: PlayerSaleHistoryEntry[] = await response.json();
    console.log('Raw API response data:', data);
    console.log('Data length:', data.length);
    
    return {
      success: true,
      data: data
    };
  } catch (error) {
    console.error('Error in fetchPlayerSaleHistory:', error);
    return {
      success: false,
      data: [],
      error: error instanceof Error ? error.message : 'Failed to fetch sale history'
    };
  }
}
