/**
 * MFL Position Overall Rating Calculator
 * Algorithm based on real MFL position rating patterns
 * 
 * This algorithm calculates position ratings based on:
 * 1. Primary position ALWAYS equals the player's overall rating
 * 2. Other positions use predefined differences based on real MFL data
 * 3. Position-specific modifiers based on attribute relevance
 * 
 * Now uses ML-based predictions for improved accuracy
 */

import { MFLPosition, PlayerForOVRCalculation, PositionOVRResult, AllPositionOVRResults, OVRCalculationError } from '../types/positionOvr';
import { MLPositionCalculator } from './mlPositionCalculator';

// Create ML calculator instance
const mlCalculator = new MLPositionCalculator();

/**
 * Main function to calculate position OVR for a specific position
 */
export function calculatePositionOVR(
  player: PlayerForOVRCalculation, 
  position: MFLPosition
): PositionOVRResult {
  return mlCalculator.calculatePositionOVR(player, position);
}

/**
 * Main function to calculate OVR for all positions
 */
export function calculateAllPositionOVRs(
  player: PlayerForOVRCalculation
): AllPositionOVRResults {
  return mlCalculator.calculateAllPositionOVRs(player);
}

/**
 * Get best positions for a player
 */
export function getBestPositions(
  player: PlayerForOVRCalculation, 
  limit: number = 5
): Array<{ position: MFLPosition; ovr: number }> {
  return mlCalculator.getBestPositions(player, limit);
}

/**
 * Validate player data
 */
export function validatePlayer(player: PlayerForOVRCalculation): boolean {
  return mlCalculator.validatePlayer(player);
}

// Export the calculator class for testing
export { MLPositionCalculator };
