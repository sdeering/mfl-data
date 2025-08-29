/**
 * ML-Based Position Rating Calculator
 * Uses trained machine learning models to predict position ratings
 */

import { MFLPosition, PlayerForOVRCalculation, PositionOVRResult, AllPositionOVRResults, OVRCalculationError } from '../types/positionOvr';
import { predictAllPositionRatings, PlayerAttributes } from './positionPredictor';

export class MLPositionCalculator {
  private allPositions: MFLPosition[];

  constructor() {
    this.allPositions = [
      'GK', 'CB', 'LB', 'RB', 'LWB', 'RWB', 
      'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 
      'CF', 'ST'
    ] as MFLPosition[];
  }

  /**
   * Calculate OVR for a specific position using ML models
   */
  public async calculatePositionOVR(player: PlayerForOVRCalculation, targetPosition: MFLPosition): Promise<PositionOVRResult> {
    try {
      // Validate inputs
      if (!this.allPositions.includes(targetPosition)) {
        return {
          success: false,
          position: targetPosition,
          ovr: 0,
          weightedAverage: 0,
          penalty: 0,
          familiarity: 'UNFAMILIAR' as const,
          error: { type: 'INVALID_POSITION' as OVRCalculationError, message: `Invalid position: ${targetPosition}` }
        };
      }

      // Convert player data to ML format
      const playerAttributes: PlayerAttributes = {
        PAC: player.attributes.PAC,
        SHO: player.attributes.SHO,
        PAS: player.attributes.PAS,
        DRI: player.attributes.DRI,
        DEF: player.attributes.DEF,
        PHY: player.attributes.PHY
      };

      // Get ML predictions
      const predictionResult = await predictAllPositionRatings(playerAttributes, player.positions, player.overall);
      
      // Find the specific position rating
      const positionRating = predictionResult.positionRatings.find(r => r.position === targetPosition);
      
      if (!positionRating) {
        return {
          success: false,
          position: targetPosition,
          ovr: 0,
          weightedAverage: 0,
          penalty: 0,
          familiarity: 'UNFAMILIAR' as const,
          error: { type: 'CALCULATION_ERROR' as OVRCalculationError, message: 'Position not found in ML predictions' }
        };
      }

      // Get overall rating from player data
      const overallRating = this.getOverallRatingFromPlayer(player);
      
      // Calculate penalty (difference from overall)
      const penalty = positionRating.difference;
      
      // Ensure rating is within valid range
      const finalRating = Math.max(0, Math.min(99, positionRating.rating));
      
      return {
        success: true,
        position: targetPosition,
        ovr: finalRating,
        weightedAverage: positionRating.rating,
        penalty,
        familiarity: positionRating.familiarity
      };

    } catch (error) {
      return {
        success: false,
        position: targetPosition,
        ovr: 0,
        weightedAverage: 0,
        penalty: 0,
        familiarity: 'UNFAMILIAR' as const,
        error: { type: 'CALCULATION_ERROR' as OVRCalculationError, message: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * Calculate all position ratings using ML models
   */
  public async calculateAllPositionOVRs(player: PlayerForOVRCalculation): Promise<AllPositionOVRResults> {
    const results: AllPositionOVRResults = {
      success: true,
      playerId: player.id,
      playerName: player.name,
      results: {} as Record<MFLPosition, PositionOVRResult>,
      error: undefined
    };

    try {
      // Convert player data to ML format
      const playerAttributes: PlayerAttributes = {
        PAC: player.attributes.PAC,
        SHO: player.attributes.SHO,
        PAS: player.attributes.PAS,
        DRI: player.attributes.DRI,
        DEF: player.attributes.DEF,
        PHY: player.attributes.PHY
      };

      // Get ML predictions
      const predictionResult = await predictAllPositionRatings(playerAttributes, player.positions, player.overall);
      
      // Convert to our format
      for (const rating of predictionResult.positionRatings) {
        const position = rating.position as MFLPosition;
        results.results[position] = {
          success: true,
          position,
          ovr: Math.max(0, Math.min(99, rating.rating)),
          weightedAverage: rating.rating,
          penalty: rating.difference,
          familiarity: rating.familiarity
        };
      }

    } catch (error) {
      results.success = false;
      results.error = {
        type: 'CALCULATION_ERROR' as OVRCalculationError,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    return results;
  }

  /**
   * Get overall rating from player data
   */
  private getOverallRatingFromPlayer(player: PlayerForOVRCalculation): number {
    // If player has an overall rating, use it
    if ('overall' in player && typeof player.overall === 'number') {
      return player.overall;
    }
    
    // Otherwise calculate from attributes
    const { PAC, SHO, PAS, DRI, DEF, PHY } = player.attributes;
    const simpleAverage = (PAC + SHO + PAS + DRI + DEF + PHY) / 6;
    const mflOffset = 8.34; // Average difference from analysis
    return Math.round(simpleAverage + mflOffset);
  }

  /**
   * Get the best positions for a player (top 5)
   */
  public async getBestPositions(player: PlayerForOVRCalculation, limit: number = 5): Promise<Array<{ position: MFLPosition; ovr: number }>> {
    const allOVRs = await this.calculateAllPositionOVRs(player);
    
    if (!allOVRs.success) {
      return [];
    }

    return Object.values(allOVRs.results)
      .filter(result => result.ovr > 0)
      .sort((a, b) => b.ovr - a.ovr)
      .slice(0, limit)
      .map(result => ({ 
        position: result.position, 
        ovr: result.ovr 
      }));
  }

  /**
   * Validate player data structure
   */
  public validatePlayer(player: PlayerForOVRCalculation): boolean {
    const required = ['attributes', 'positions'];
    const attrRequired = ['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY'];
    
    for (const field of required) {
      if (!(field in player)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    for (const attr of attrRequired) {
      if (typeof player.attributes[attr as keyof typeof player.attributes] !== 'number' || 
          (player.attributes[attr as keyof typeof player.attributes] as number) < 0 || 
          (player.attributes[attr as keyof typeof player.attributes] as number) > 99) {
        throw new Error(`Invalid attribute ${attr}: must be 0-99`);
      }
    }

    if (!Array.isArray(player.positions) || player.positions.length === 0) {
      throw new Error('Positions must be a non-empty array');
    }

    for (const pos of player.positions) {
      if (!this.allPositions.includes(pos)) {
        throw new Error(`Invalid position: ${pos}`);
      }
    }

    return true;
  }
}
