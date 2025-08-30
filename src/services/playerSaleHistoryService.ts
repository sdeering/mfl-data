import type { PlayerSaleHistory, PlayerSaleHistoryEntry } from '../types/playerSaleHistory';

/**
 * Fetch player sale history from the MFL API
 */
export async function fetchPlayerSaleHistory(playerId: string, limit: number = 25): Promise<PlayerSaleHistory> {
  try {
    const url = `https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/listings/feed?limit=${limit}&playerId=${playerId}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: PlayerSaleHistoryEntry[] = await response.json();
    
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
