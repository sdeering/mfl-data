import type { PlayerMatchesResponse } from '../types/playerMatches';

export const fetchPlayerMatches = async (playerId: string): Promise<PlayerMatchesResponse> => {
  try {
    const response = await fetch(
      `https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/players/${playerId}/matches/stats?limit=25`
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    return {
      success: true,
      data: data
    };
  } catch (error) {
    console.error('Error fetching player matches:', error);
    return {
      success: false,
      data: [],
      error: error instanceof Error ? error.message : 'Failed to fetch player matches'
    };
  }
};
