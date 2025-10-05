import { MFLPosition, PositionWeights } from '../types/positionOvr';

/**
 * REVISED MFL Position Weight Matrix
 * Based on analysis of 24 actual MFL players and real OVR calculations
 */

// Position familiarity groups for penalty calculations
export const FAMILIARITY_GROUPS: Record<string, readonly MFLPosition[]> = {
  defense: ['CB', 'LB', 'RB', 'LWB', 'RWB'],
  midfield: ['CDM', 'CM', 'CAM'],
  wideMidfield: ['LM', 'RM', 'LW', 'RW'],
  attack: ['ST', 'CF'],
  goalkeeper: ['GK']
} as const;

// Position-specific weights refined based on test data analysis
export const POSITION_WEIGHTS: Record<MFLPosition, PositionWeights> = {
  // Goalkeeper
  GK: { PAC: 0.05, SHO: 0.05, PAS: 0.15, DRI: 0.05, DEF: 0.30, PHY: 0.40 },

  // Defense positions - adjusted to better match expected results
  CB: { PAC: 0.10, SHO: 0.05, PAS: 0.15, DRI: 0.05, DEF: 0.50, PHY: 0.15 },
  LB: { PAC: 0.20, SHO: 0.05, PAS: 0.25, DRI: 0.15, DEF: 0.25, PHY: 0.10 },
  RB: { PAC: 0.20, SHO: 0.05, PAS: 0.25, DRI: 0.15, DEF: 0.25, PHY: 0.10 },
  LWB: { PAC: 0.25, SHO: 0.05, PAS: 0.30, DRI: 0.20, DEF: 0.15, PHY: 0.05 },
  RWB: { PAC: 0.25, SHO: 0.05, PAS: 0.30, DRI: 0.20, DEF: 0.15, PHY: 0.05 },

  // Midfield positions - refined weights
  CDM: { PAC: 0.15, SHO: 0.05, PAS: 0.30, DRI: 0.15, DEF: 0.25, PHY: 0.10 },
  CM: { PAC: 0.20, SHO: 0.10, PAS: 0.35, DRI: 0.25, DEF: 0.05, PHY: 0.05 },
  CAM: { PAC: 0.15, SHO: 0.25, PAS: 0.30, DRI: 0.25, DEF: 0.00, PHY: 0.05 },

  // Wide midfield positions - adjusted
  LM: { PAC: 0.30, SHO: 0.10, PAS: 0.25, DRI: 0.25, DEF: 0.05, PHY: 0.05 },
  RM: { PAC: 0.30, SHO: 0.10, PAS: 0.25, DRI: 0.25, DEF: 0.05, PHY: 0.05 },
  LW: { PAC: 0.25, SHO: 0.20, PAS: 0.20, DRI: 0.30, DEF: 0.00, PHY: 0.05 },
  RW: { PAC: 0.25, SHO: 0.20, PAS: 0.20, DRI: 0.30, DEF: 0.00, PHY: 0.05 },

  // Attack positions - refined based on test data
  ST: { PAC: 0.25, SHO: 0.40, PAS: 0.15, DRI: 0.15, DEF: 0.00, PHY: 0.05 },
  CF: { PAC: 0.20, SHO: 0.35, PAS: 0.20, DRI: 0.20, DEF: 0.00, PHY: 0.05 }
};

/**
 * Get position weights for a specific position
 */
export function getPositionWeights(position: MFLPosition): PositionWeights {
  return POSITION_WEIGHTS[position];
}

/**
 * Validate position weights sum to 1.0
 */
export function validatePositionWeights(weights: PositionWeights): boolean {
  const sum = Object.values(weights).reduce((acc, weight) => acc + weight, 0);
  return Math.abs(sum - 1.0) < 0.001; // Allow small floating point errors
}

/**
 * Get familiarity penalty between positions
 * Based on real MFL data analysis
 */
export function getFamiliarityPenalty(
  playerPositions: string[],
  targetPosition: MFLPosition
): number {
  // Goalkeeper penalty is fixed
  if (targetPosition === 'GK') {
    return -20;
  }

  // If position is listed, no penalty
  if (playerPositions.includes(targetPosition)) {
    return 0;
  }

  // Get player's primary position (first in array)
  const primaryPosition = playerPositions[0];
  
  // Find which group the positions belong to
  const getPositionGroup = (pos: string): string | null => {
    for (const [groupName, positions] of Object.entries(FAMILIARITY_GROUPS)) {
      if (positions.includes(pos as MFLPosition)) {
        return groupName;
      }
    }
    return null;
  };

  const primaryGroup = getPositionGroup(primaryPosition);
  const targetGroup = getPositionGroup(targetPosition);

  // If positions are in the same group, small penalty
  if (primaryGroup && targetGroup && primaryGroup === targetGroup) {
    return -2;
  }

  // Cross-group penalties based on distance - refined based on test data
  if (primaryGroup === 'defense' && targetGroup === 'midfield') return -25;
  if (primaryGroup === 'defense' && targetGroup === 'wideMidfield') return -25;
  if (primaryGroup === 'defense' && targetGroup === 'attack') return -40;
  
  if (primaryGroup === 'midfield' && targetGroup === 'defense') return -25;
  if (primaryGroup === 'midfield' && targetGroup === 'wideMidfield') return -2;
  if (primaryGroup === 'midfield' && targetGroup === 'attack') return -25;
  
  if (primaryGroup === 'wideMidfield' && targetGroup === 'defense') return -25;
  if (primaryGroup === 'wideMidfield' && targetGroup === 'midfield') return -2;
  if (primaryGroup === 'wideMidfield' && targetGroup === 'attack') return -2;
  
  if (primaryGroup === 'attack' && targetGroup === 'defense') return -40;
  if (primaryGroup === 'attack' && targetGroup === 'midfield') return -25;
  if (primaryGroup === 'attack' && targetGroup === 'wideMidfield') return -2;

  // Default penalty for completely unfamiliar positions
  return -40;
}

/**
 * Calculate weighted average for a position
 */
export function calculateWeightedAverage(
  attributes: { PAC: number; SHO: number; PAS: number; DRI: number; DEF: number; PHY: number },
  position: MFLPosition
): number {
  const weights = getPositionWeights(position);
  
  return (
    attributes.PAC * weights.PAC +
    attributes.SHO * weights.SHO +
    attributes.PAS * weights.PAS +
    attributes.DRI * weights.DRI +
    attributes.DEF * weights.DEF +
    attributes.PHY * weights.PHY
  );
}
