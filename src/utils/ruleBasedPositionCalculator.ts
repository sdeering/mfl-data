/**
 * Rule-Based Position Rating Calculator
 * Implements the exact algorithm specified for MFL player position ratings
 */

import { MFLPosition, PlayerForOVRCalculation, PositionOVRResult, AllPositionOVRResults, OVRCalculationError } from '../types/positionOvr';

// Position Attributes Distribution Table
// Each position has weights that sum to 100%
const POSITION_ATTRIBUTE_WEIGHTS: Record<MFLPosition, Record<string, number>> = {
  'ST': { PAS: 10, SHO: 46, DEF: 0, DRI: 29, PAC: 10, PHY: 5 },
  'CF': { PAS: 24, SHO: 23, DEF: 0, DRI: 40, PAC: 13, PHY: 0 },
  'LW': { PAS: 24, SHO: 23, DEF: 0, DRI: 40, PAC: 13, PHY: 0 },
  'RW': { PAS: 24, SHO: 23, DEF: 0, DRI: 40, PAC: 13, PHY: 0 },
  'CAM': { PAS: 34, SHO: 21, DEF: 0, DRI: 38, PAC: 7, PHY: 0 },
  'CM': { PAS: 43, SHO: 12, DEF: 10, DRI: 29, PAC: 0, PHY: 6 },
  'LM': { PAS: 43, SHO: 12, DEF: 10, DRI: 29, PAC: 0, PHY: 6 },
  'RM': { PAS: 43, SHO: 12, DEF: 10, DRI: 29, PAC: 0, PHY: 6 },
  'CDM': { PAS: 28, SHO: 0, DEF: 40, DRI: 17, PAC: 0, PHY: 15 },
  'LWB': { PAS: 19, SHO: 0, DEF: 44, DRI: 17, PAC: 10, PHY: 10 },
  'RWB': { PAS: 19, SHO: 0, DEF: 44, DRI: 17, PAC: 10, PHY: 10 },
  'LB': { PAS: 19, SHO: 0, DEF: 44, DRI: 17, PAC: 10, PHY: 10 },
  'RB': { PAS: 19, SHO: 0, DEF: 44, DRI: 17, PAC: 10, PHY: 10 },
  'CB': { PAS: 5, SHO: 0, DEF: 64, DRI: 9, PAC: 2, PHY: 20 },
  'GK': { PAS: 0, SHO: 0, DEF: 0, DRI: 0, PAC: 0, PHY: 100 }
};

// Primary Position Familiarity Matrix
// 3 = Primary position (no penalty)
// 2 = Fairly Familiar (-5 penalty)
// 1 = Somewhat Familiar (-8 penalty)
// 0 = Unfamiliar (-20 penalty)
const POSITION_FAMILIARITY_MATRIX: Record<MFLPosition, Record<MFLPosition, number>> = {
  'GK': {
    'GK': 3, 'CB': 0, 'RB': 0, 'LB': 0, 'RWB': 0, 'LWB': 0, 'CDM': 0, 'CM': 0, 'CAM': 0, 'RM': 0, 'LM': 0, 'RW': 0, 'LW': 0, 'CF': 0, 'ST': 0
  },
  'CB': {
    'GK': 0, 'CB': 3, 'RB': 1, 'LB': 1, 'RWB': 0, 'LWB': 0, 'CDM': 1, 'CM': 0, 'CAM': 0, 'RM': 0, 'LM': 0, 'RW': 0, 'LW': 0, 'CF': 0, 'ST': 0
  },
  'RB': {
    'GK': 0, 'CB': 1, 'RB': 3, 'LB': 1, 'RWB': 2, 'LWB': 0, 'CDM': 0, 'CM': 0, 'CAM': 0, 'RM': 1, 'LM': 0, 'RW': 0, 'LW': 0, 'CF': 0, 'ST': 0
  },
  'LB': {
    'GK': 0, 'CB': 1, 'RB': 1, 'LB': 3, 'RWB': 0, 'LWB': 2, 'CDM': 0, 'CM': 0, 'CAM': 0, 'RM': 0, 'LM': 1, 'RW': 0, 'LW': 0, 'CF': 0, 'ST': 0
  },
  'RWB': {
    'GK': 0, 'CB': 0, 'RB': 2, 'LB': 0, 'RWB': 3, 'LWB': 1, 'CDM': 0, 'CM': 0, 'CAM': 0, 'RM': 1, 'LM': 0, 'RW': 1, 'LW': 0, 'CF': 0, 'ST': 0
  },
  'LWB': {
    'GK': 0, 'CB': 0, 'RB': 0, 'LB': 2, 'RWB': 1, 'LWB': 3, 'CDM': 0, 'CM': 0, 'CAM': 0, 'RM': 0, 'LM': 1, 'RW': 0, 'LW': 1, 'CF': 0, 'ST': 0
  },
  'CDM': {
    'GK': 0, 'CB': 1, 'RB': 0, 'LB': 0, 'RWB': 0, 'LWB': 0, 'CDM': 3, 'CM': 2, 'CAM': 1, 'RM': 0, 'LM': 0, 'RW': 0, 'LW': 0, 'CF': 0, 'ST': 0
  },
  'CM': {
    'GK': 0, 'CB': 0, 'RB': 0, 'LB': 0, 'RWB': 0, 'LWB': 0, 'CDM': 2, 'CM': 3, 'CAM': 2, 'RM': 1, 'LM': 1, 'RW': 0, 'LW': 0, 'CF': 0, 'ST': 0
  },
  'CAM': {
    'GK': 0, 'CB': 0, 'RB': 0, 'LB': 0, 'RWB': 0, 'LWB': 0, 'CDM': 1, 'CM': 2, 'CAM': 3, 'RM': 0, 'LM': 0, 'RW': 0, 'LW': 0, 'CF': 2, 'ST': 0
  },
  'RM': {
    'GK': 0, 'CB': 0, 'RB': 1, 'LB': 0, 'RWB': 1, 'LWB': 0, 'CDM': 0, 'CM': 1, 'CAM': 0, 'RM': 3, 'LM': 1, 'RW': 2, 'LW': 0, 'CF': 0, 'ST': 0
  },
  'LM': {
    'GK': 0, 'CB': 0, 'RB': 0, 'LB': 1, 'RWB': 0, 'LWB': 1, 'CDM': 0, 'CM': 1, 'CAM': 0, 'RM': 1, 'LM': 3, 'RW': 0, 'LW': 2, 'CF': 0, 'ST': 0
  },
  'RW': {
    'GK': 0, 'CB': 0, 'RB': 0, 'LB': 0, 'RWB': 1, 'LWB': 0, 'CDM': 0, 'CM': 0, 'CAM': 0, 'RM': 2, 'LM': 0, 'RW': 3, 'LW': 1, 'CF': 0, 'ST': 0
  },
  'LW': {
    'GK': 0, 'CB': 0, 'RB': 0, 'LB': 0, 'RWB': 0, 'LWB': 1, 'CDM': 0, 'CM': 0, 'CAM': 0, 'RM': 0, 'LM': 2, 'RW': 1, 'LW': 3, 'CF': 0, 'ST': 0
  },
  'CF': {
    'GK': 0, 'CB': 0, 'RB': 0, 'LB': 0, 'RWB': 0, 'LWB': 0, 'CDM': 0, 'CM': 0, 'CAM': 2, 'RM': 0, 'LM': 0, 'RW': 0, 'LW': 0, 'CF': 3, 'ST': 2
  },
  'ST': {
    'GK': 0, 'CB': 0, 'RB': 0, 'LB': 0, 'RWB': 0, 'LWB': 0, 'CDM': 0, 'CM': 0, 'CAM': 0, 'RM': 0, 'LM': 0, 'RW': 0, 'LW': 0, 'CF': 2, 'ST': 3
  }
};

// Familiarity penalty mapping
const FAMILIARITY_PENALTIES: Record<number, number> = {
  3: 0,   // Primary position - no penalty
  2: -5,  // Fairly Familiar - -5 penalty
  1: -8,  // Somewhat Familiar - -8 penalty
  0: -20  // Unfamiliar - -20 penalty
};

export class RuleBasedPositionCalculator {
  private allPositions: MFLPosition[];

  constructor() {
    this.allPositions = [
      'GK', 'CB', 'LB', 'RB', 'LWB', 'RWB', 
      'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 
      'CF', 'ST'
    ] as MFLPosition[];
  }

  /**
   * Calculate OVR for a specific position using the rule-based algorithm
   */
  public calculatePositionOVR(player: PlayerForOVRCalculation, targetPosition: MFLPosition): PositionOVRResult {
    try {
      // Validate input
      this.validatePlayer(player);

      // Get player's primary position (first in array)
      const primaryPosition = player.positions[0];
      
      // Determine penalty based on position familiarity
      let penalty: number;
      let familiarity: string;
      
      if (targetPosition === primaryPosition) {
        // Primary position - no penalty
        penalty = 0;
        familiarity = 'PRIMARY';
      } else if (player.positions.includes(targetPosition)) {
        // Secondary/Third position - -1 penalty
        penalty = -1;
        familiarity = 'SECONDARY';
      } else {
        // Position not in player's positions - use familiarity matrix
        const familiarityLevel = POSITION_FAMILIARITY_MATRIX[primaryPosition][targetPosition];
        penalty = FAMILIARITY_PENALTIES[familiarityLevel];
        
        // Convert familiarity level to string
        switch (familiarityLevel) {
          case 2:
            familiarity = 'FAIRLY_FAMILIAR';
            break;
          case 1:
            familiarity = 'SOMEWHAT_FAMILIAR';
            break;
          case 0:
            familiarity = 'UNFAMILIAR';
            break;
          default:
            familiarity = 'UNKNOWN';
        }
      }

      // Get position weights
      const weights = POSITION_ATTRIBUTE_WEIGHTS[targetPosition];

      // Calculate weighted average using the formula:
      // PAS * PAS_weight + SHO * SHO_weight + DEF * DEF_weight + DRI * DRI_weight + PAC * PAC_weight + PHY * PHY_weight
      const weightedSum = 
        player.attributes.PAS * (weights.PAS / 100) +
        player.attributes.SHO * (weights.SHO / 100) +
        player.attributes.DEF * (weights.DEF / 100) +
        player.attributes.DRI * (weights.DRI / 100) +
        player.attributes.PAC * (weights.PAC / 100) +
        player.attributes.PHY * (weights.PHY / 100);

      // Apply familiarity penalty
      const finalRating = weightedSum + penalty;

      // Round to nearest whole number and clamp to 0-99 range
      const ovr = Math.max(0, Math.min(99, Math.round(finalRating)));

      return {
        success: true,
        position: targetPosition,
        ovr,
        weightedAverage: weightedSum,
        penalty,
        familiarity
      };

    } catch (error) {
      return {
        success: false,
        position: targetPosition,
        ovr: 0,
        weightedAverage: 0,
        penalty: 0,
        familiarity: 'UNFAMILIAR',
        error: { 
          type: 'CALCULATION_ERROR' as OVRCalculationError, 
          message: error instanceof Error ? error.message : 'Unknown error' 
        }
      };
    }
  }

  /**
   * Calculate OVR for all positions
   */
  public calculateAllPositionOVRs(player: PlayerForOVRCalculation): AllPositionOVRResults {
    const results: AllPositionOVRResults = {
      success: true,
      playerId: player.id,
      playerName: player.name,
      results: {} as Record<MFLPosition, PositionOVRResult>,
      error: undefined
    };

    try {
      for (const position of this.allPositions) {
        results.results[position] = this.calculatePositionOVR(player, position);
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
   * Get the best positions for a player (top 5)
   */
  public getBestPositions(player: PlayerForOVRCalculation, limit: number = 5): Array<{ position: MFLPosition; ovr: number }> {
    const allOVRs = this.calculateAllPositionOVRs(player);
    
    if (!allOVRs.success) {
      return [];
    }

    return Object.values(allOVRs.results)
      .filter(result => result.success && result.ovr > 0)
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
    const required = ['id', 'name', 'attributes', 'positions'];
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

  /**
   * Get position weights for a specific position
   */
  public getPositionWeights(position: MFLPosition): Record<string, number> {
    return POSITION_ATTRIBUTE_WEIGHTS[position];
  }

  /**
   * Get familiarity level between two positions
   */
  public getFamiliarityLevel(primaryPosition: MFLPosition, targetPosition: MFLPosition): number {
    return POSITION_FAMILIARITY_MATRIX[primaryPosition][targetPosition];
  }

  /**
   * Get penalty for a familiarity level
   */
  public getFamiliarityPenalty(familiarityLevel: number): number {
    return FAMILIARITY_PENALTIES[familiarityLevel];
  }
}

// Export convenience functions
export function calculatePositionOVR(
  player: PlayerForOVRCalculation,
  position: MFLPosition
): PositionOVRResult {
  const calculator = new RuleBasedPositionCalculator();
  return calculator.calculatePositionOVR(player, position);
}

export function calculateAllPositionOVRs(
  player: PlayerForOVRCalculation
): AllPositionOVRResults {
  const calculator = new RuleBasedPositionCalculator();
  return calculator.calculateAllPositionOVRs(player);
}

export function getBestPositions(
  player: PlayerForOVRCalculation,
  limit: number = 5
): Array<{ position: MFLPosition; ovr: number }> {
  const calculator = new RuleBasedPositionCalculator();
  return calculator.getBestPositions(player, limit);
}

export function validatePlayer(player: PlayerForOVRCalculation): boolean {
  const calculator = new RuleBasedPositionCalculator();
  return calculator.validatePlayer(player);
}


