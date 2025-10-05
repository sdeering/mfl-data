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

import { MFLPosition, PlayerForOVRCalculation, PositionOVRResult, AllPositionOVRResults } from '../types/positionOvr';
import { MLPositionCalculator } from './mlPositionCalculator';

// Create ML calculator instance
const mlCalculator = new MLPositionCalculator();

/**
 * Calculate OVR for a specific position
 */
export async function calculatePositionOVR(
  player: PlayerForOVRCalculation,
  position: MFLPosition
): Promise<PositionOVRResult> {
  return mlCalculator.calculatePositionOVR(player, position);
}

/**
 * Calculate OVR for all positions
 */
export async function calculateAllPositionOVRs(
  player: PlayerForOVRCalculation
): Promise<AllPositionOVRResults> {
  return mlCalculator.calculateAllPositionOVRs(player);
}

/**
 * Get the best positions for a player (top 5)
 */
export async function getBestPositions(
  player: PlayerForOVRCalculation,
  limit: number = 5
): Promise<Array<{ position: MFLPosition; ovr: number }>> {
  return mlCalculator.getBestPositions(player, limit);
}

/**
 * Validate player data structure
 */
export function validatePlayer(player: PlayerForOVRCalculation): boolean {
  return mlCalculator.validatePlayer(player);
}

// Export the calculator class for testing
export { MLPositionCalculator };
