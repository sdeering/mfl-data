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
    if (entry.date <= saleDate) {
      lastValidEntry = entry;
      // Merge stats from this entry
      if (entry.values.overall !== undefined) statsAtSale.overall = entry.values.overall;
      if (entry.values.age !== undefined) statsAtSale.age = entry.values.age;
      if (entry.values.pace !== undefined) statsAtSale.pace = entry.values.pace;
      if (entry.values.dribbling !== undefined) statsAtSale.dribbling = entry.values.dribbling;
      if (entry.values.passing !== undefined) statsAtSale.passing = entry.values.passing;
      if (entry.values.shooting !== undefined) statsAtSale.shooting = entry.values.shooting;
      if (entry.values.defense !== undefined) statsAtSale.defense = entry.values.defense;
      if (entry.values.physical !== undefined) statsAtSale.physical = entry.values.physical;
      if (entry.values.goalkeeping !== undefined) statsAtSale.goalkeeping = entry.values.goalkeeping;
    } else {
      break; // We've passed the sale date
    }
  }

  // If we found no data before the sale date, use the first available data as fallback
  if (!lastValidEntry) {
    const firstEntry = sortedData[0];
    if (firstEntry) {
      return {
        overall: firstEntry.values.overall ?? 0,
        age: firstEntry.values.age ?? 0,
        pace: firstEntry.values.pace ?? 0,
        dribbling: firstEntry.values.dribbling ?? 0,
        passing: firstEntry.values.passing ?? 0,
        shooting: firstEntry.values.shooting ?? 0,
        defense: firstEntry.values.defense ?? 0,
        physical: firstEntry.values.physical ?? 0,
        goalkeeping: firstEntry.values.goalkeeping ?? 0,
      };
    }
    return null;
  }

  // Fill in missing stats with the first available values from progression data
  const firstEntry = sortedData[0];
  if (firstEntry) {
    if (statsAtSale.overall === undefined && firstEntry.values.overall !== undefined) {
      statsAtSale.overall = firstEntry.values.overall;
    }
    if (statsAtSale.age === undefined && firstEntry.values.age !== undefined) {
      statsAtSale.age = firstEntry.values.age;
    }
    if (statsAtSale.pace === undefined && firstEntry.values.pace !== undefined) {
      statsAtSale.pace = firstEntry.values.pace;
    }
    if (statsAtSale.dribbling === undefined && firstEntry.values.dribbling !== undefined) {
      statsAtSale.dribbling = firstEntry.values.dribbling;
    }
    if (statsAtSale.passing === undefined && firstEntry.values.passing !== undefined) {
      statsAtSale.passing = firstEntry.values.passing;
    }
    if (statsAtSale.shooting === undefined && firstEntry.values.shooting !== undefined) {
      statsAtSale.shooting = firstEntry.values.shooting;
    }
    if (statsAtSale.defense === undefined && firstEntry.values.defense !== undefined) {
      statsAtSale.defense = firstEntry.values.defense;
    }
    if (statsAtSale.physical === undefined && firstEntry.values.physical !== undefined) {
      statsAtSale.physical = firstEntry.values.physical;
    }
    if (statsAtSale.goalkeeping === undefined && firstEntry.values.goalkeeping !== undefined) {
      statsAtSale.goalkeeping = firstEntry.values.goalkeeping;
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
