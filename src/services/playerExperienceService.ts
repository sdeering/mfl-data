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
  // Sort by date first
  const sortedData = experienceData.sort((a, b) => a.date - b.date);
  
  // Find the first entry with an age to establish the baseline
  const firstAgeEntry = sortedData.find(entry => entry.values.age !== undefined);
  const baselineAge = firstAgeEntry?.values.age || 0;
  const baselineDate = firstAgeEntry?.date || sortedData[0]?.date || 0;
  
  // Carry forward values - each entry should have all stats from previous entries
  let currentValues = {
    overall: undefined as number | undefined,
    age: undefined as number | undefined,
    pace: undefined as number | undefined,
    dribbling: undefined as number | undefined,
    passing: undefined as number | undefined,
    shooting: undefined as number | undefined,
    defense: undefined as number | undefined,
    physical: undefined as number | undefined
  };

  const progressionData = sortedData
    .filter(entry => entry.values.overall !== undefined || entry.values.pace !== undefined || entry.values.dribbling !== undefined || entry.values.passing !== undefined || entry.values.shooting !== undefined || entry.values.defense !== undefined || entry.values.physical !== undefined)
    .map((entry, index) => {
      // Calculate precise age progression: 1 year every 6 weeks (42 days)
      const daysSinceBaseline = (entry.date - baselineDate) / (1000 * 60 * 60 * 24);
      const ageProgression = daysSinceBaseline / 42; // 42 days = 6 weeks
      const calculatedAge = baselineAge + ageProgression;
      
      // Update current values with any new values from this entry
      if (entry.values.overall !== undefined) currentValues.overall = entry.values.overall;
      if (entry.values.age !== undefined) currentValues.age = entry.values.age;
      if (entry.values.pace !== undefined) currentValues.pace = entry.values.pace;
      if (entry.values.dribbling !== undefined) currentValues.dribbling = entry.values.dribbling;
      if (entry.values.passing !== undefined) currentValues.passing = entry.values.passing;
      if (entry.values.shooting !== undefined) currentValues.shooting = entry.values.shooting;
      if (entry.values.defense !== undefined) currentValues.defense = entry.values.defense;
      if (entry.values.physical !== undefined) currentValues.physical = entry.values.physical;

      const result = {
        date: new Date(entry.date),
        overall: currentValues.overall!,
        age: calculatedAge, // Use precise calculated age with decimals
        pace: currentValues.pace,
        dribbling: currentValues.dribbling,
        passing: currentValues.passing,
        shooting: currentValues.shooting,
        defense: currentValues.defense,
        physical: currentValues.physical
      };

      return result;
    });

  return progressionData;
}
