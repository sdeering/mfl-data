import { ProgressionDataPoint } from '../types/playerExperience';

interface SaleStats {
  overall: number;
  age: number;
  pace: number;
  dribbling: number;
  passing: number;
  shooting: number;
  defense: number;
  physical: number;
  goalkeeping: number;
}

/**
 * Calculate player stats at the time of a sale using progression data
 * @param saleDate - The timestamp of the sale
 * @param progressionData - Array of progression data points
 * @returns Player stats at the time of sale, or null if no data available
 */
export const calculatePlayerStatsAtSale = (
  saleDate: number,
  progressionData: ProgressionDataPoint[]
): SaleStats | null => {
  if (!progressionData || progressionData.length === 0) {
    return null;
  }

  // Sort progression data by date (oldest first)
  const sortedData = [...progressionData].sort((a, b) => a.date - b.date);
  
  // Find the most recent progression entry before or at the sale date
  let statsAtSale: Partial<SaleStats> = {};
  let lastValidEntry: ProgressionDataPoint | null = null;

  for (const entry of sortedData) {
    if (entry.date.getTime() <= saleDate) {
      lastValidEntry = entry;
      // Merge stats from this entry (flat structure)
      if (entry.overall !== undefined) statsAtSale.overall = entry.overall;
      if (entry.age !== undefined) statsAtSale.age = entry.age;
      if (entry.pace !== undefined) statsAtSale.pace = entry.pace;
      if (entry.dribbling !== undefined) statsAtSale.dribbling = entry.dribbling;
      if (entry.passing !== undefined) statsAtSale.passing = entry.passing;
      if (entry.shooting !== undefined) statsAtSale.shooting = entry.shooting;
      if (entry.defense !== undefined) statsAtSale.defense = entry.defense;
      if (entry.physical !== undefined) statsAtSale.physical = entry.physical;
    } else {
      break; // We've passed the sale date
    }
  }

  // If we found no data before the sale date, use the first available data as fallback
  if (!lastValidEntry) {
    const firstEntry = sortedData[0];
    if (firstEntry) {
      return {
        overall: firstEntry.overall ?? 0,
        age: firstEntry.age ?? 0,
        pace: firstEntry.pace ?? 0,
        dribbling: firstEntry.dribbling ?? 0,
        passing: firstEntry.passing ?? 0,
        shooting: firstEntry.shooting ?? 0,
        defense: firstEntry.defense ?? 0,
        physical: firstEntry.physical ?? 0,
        goalkeeping: 0, // Not available in ProgressionDataPoint
      };
    }
    return null;
  }

  // Fill in missing stats with the first available values from progression data
  const firstEntry = sortedData[0];
  if (firstEntry) {
    if (statsAtSale.overall === undefined && firstEntry.overall !== undefined) {
      statsAtSale.overall = firstEntry.overall;
    }
    if (statsAtSale.age === undefined && firstEntry.age !== undefined) {
      statsAtSale.age = firstEntry.age;
    }
    if (statsAtSale.pace === undefined && firstEntry.pace !== undefined) {
      statsAtSale.pace = firstEntry.pace;
    }
    if (statsAtSale.dribbling === undefined && firstEntry.dribbling !== undefined) {
      statsAtSale.dribbling = firstEntry.dribbling;
    }
    if (statsAtSale.passing === undefined && firstEntry.passing !== undefined) {
      statsAtSale.passing = firstEntry.passing;
    }
    if (statsAtSale.shooting === undefined && firstEntry.shooting !== undefined) {
      statsAtSale.shooting = firstEntry.shooting;
    }
    if (statsAtSale.defense === undefined && firstEntry.defense !== undefined) {
      statsAtSale.defense = firstEntry.defense;
    }
    if (statsAtSale.physical === undefined && firstEntry.physical !== undefined) {
      statsAtSale.physical = firstEntry.physical;
    }
    // goalkeeping is not available in ProgressionDataPoint, so we'll use 0
    if (statsAtSale.goalkeeping === undefined) {
      statsAtSale.goalkeeping = 0;
    }
  }

  // Return null if we don't have at least overall and age
  if (statsAtSale.overall === undefined || statsAtSale.age === undefined) {
    return null;
  }

  // Return the calculated stats with defaults for missing values
  return {
    overall: statsAtSale.overall,
    age: statsAtSale.age,
    pace: statsAtSale.pace ?? 0,
    dribbling: statsAtSale.dribbling ?? 0,
    passing: statsAtSale.passing ?? 0,
    shooting: statsAtSale.shooting ?? 0,
    defense: statsAtSale.defense ?? 0,
    physical: statsAtSale.physical ?? 0,
    goalkeeping: statsAtSale.goalkeeping ?? 0,
  };
};
