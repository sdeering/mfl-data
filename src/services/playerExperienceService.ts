import type { PlayerExperienceHistory, PlayerExperienceEntry } from '../types/playerExperience';

/**
 * Fetch player experience history from the MFL API
 */
export async function fetchPlayerExperienceHistory(playerId: string): Promise<PlayerExperienceHistory> {
  try {
    const response = await fetch(`https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/players/${playerId}/experiences/history`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: PlayerExperienceEntry[] = await response.json();
    
    return {
      success: true,
      data: data
    };
  } catch (error) {
    return {
      success: false,
      data: [],
      error: error instanceof Error ? error.message : 'Failed to fetch experience history'
    };
  }
}

/**
 * Process experience history data for chart display
 */
export function processProgressionData(experienceData: PlayerExperienceEntry[]) {
  const progressionData = experienceData
    .filter(entry => entry.values.overall !== undefined)
    .map(entry => ({
      date: new Date(entry.date),
      overall: entry.values.overall!,
      age: entry.values.age,
      pace: entry.values.pace,
      dribbling: entry.values.dribbling,
      passing: entry.values.passing,
      shooting: entry.values.shooting,
      defense: entry.values.defense,
      physical: entry.values.physical
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  return progressionData;
}
