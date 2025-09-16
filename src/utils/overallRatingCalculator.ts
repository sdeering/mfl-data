/**
 * Overall Rating Calculator
 * Calculates the precise overall rating from individual player attributes
 * This uses the same formula as position ratings for consistency
 */

import { RuleBasedPositionCalculator } from './ruleBasedPositionCalculator';
import { MFLPosition } from '../types/positionOvr';

export interface PlayerAttributes {
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defense: number;
  physical: number;
  goalkeeping?: number;
  positions: string[];
}

/**
 * Calculate the precise overall rating from individual attributes
 * This uses the same position-specific weights as the position rating calculator
 */
export function calculatePreciseOverallRating(attributes: PlayerAttributes): number {
  const { pace, shooting, passing, dribbling, defense, physical, goalkeeping, positions } = attributes;
  
  // Get the player's primary position (first in the positions array)
  const primaryPosition = positions[0] as MFLPosition;
  
  // Create a player object for the position calculator
  const playerForOVR = {
    id: 0, // Not needed for calculation
    name: '', // Not needed for calculation
    positions: positions as MFLPosition[],
    attributes: {
      PAS: passing,
      SHO: shooting,
      DEF: defense,
      DRI: dribbling,
      PAC: pace,
      PHY: physical,
      GK: goalkeeping || 0
    }
  };
  
  // Use the position calculator to get the precise rating for the primary position
  const calculator = new RuleBasedPositionCalculator();
  const result = calculator.calculatePositionOVR(playerForOVR, primaryPosition);
  
  if (result.success) {
    // Return the weighted average (before rounding and penalty) for precise decimal value
    return result.weightedAverage;
  } else {
    // Fallback to simple calculation if position calculator fails
    return (pace + shooting + passing + dribbling + defense + physical) / 6;
  }
}

/**
 * Format the precise overall rating to 2 decimal places
 */
export function formatPreciseOverallRating(attributes: PlayerAttributes): string {
  const preciseRating = calculatePreciseOverallRating(attributes);
  return preciseRating.toFixed(2);
}

/**
 * Get the precise overall rating for a player from MFL API data
 */
export function getPlayerPreciseOverall(player: any): string {
  const attributes: PlayerAttributes = {
    pace: player.metadata.pace,
    shooting: player.metadata.shooting,
    passing: player.metadata.passing,
    dribbling: player.metadata.dribbling,
    defense: player.metadata.defense,
    physical: player.metadata.physical,
    goalkeeping: player.metadata.goalkeeping,
    positions: player.metadata.positions
  };
  
  return formatPreciseOverallRating(attributes);
}

/**
 * Get the precise overall rating for a specific position
 */
export function getPlayerPreciseOverallForPosition(player: any, position: MFLPosition): string {
  const { pace, shooting, passing, dribbling, defense, physical, goalkeeping, positions } = player.metadata;
  
  // Create a player object for the position calculator
  const playerForOVR = {
    id: 0, // Not needed for calculation
    name: '', // Not needed for calculation
    positions: positions as MFLPosition[],
    attributes: {
      PAS: passing,
      SHO: shooting,
      DEF: defense,
      DRI: dribbling,
      PAC: pace,
      PHY: physical,
      GK: goalkeeping || 0
    }
  };
  
  // Use the position calculator to get the precise rating for the specific position
  const calculator = new RuleBasedPositionCalculator();
  const result = calculator.calculatePositionOVR(playerForOVR, position);
  
  if (result.success) {
    // Return the weighted average (before rounding and penalty) for precise decimal value
    return result.weightedAverage.toFixed(2);
  } else {
    // Fallback to simple calculation if position calculator fails
    return ((pace + shooting + passing + dribbling + defense + physical) / 6).toFixed(2);
  }
}
