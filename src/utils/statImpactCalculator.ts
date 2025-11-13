/**
 * Stat Impact Calculator
 * Calculates the impact of +1 in each stat on overall rating
 */

import { MFLPosition } from '../types/positionOvr';

// Position Attributes Distribution Table (same as ruleBasedPositionCalculator)
const POSITION_ATTRIBUTE_WEIGHTS: Record<MFLPosition, Record<string, number>> = {
  'ST': { PAS: 10, SHO: 46, DEF: 0, DRI: 29, PAC: 10, PHY: 5, GK: 0 },
  'CF': { PAS: 24, SHO: 23, DEF: 0, DRI: 40, PAC: 13, PHY: 0, GK: 0 },
  'LW': { PAS: 24, SHO: 23, DEF: 0, DRI: 40, PAC: 13, PHY: 0, GK: 0 },
  'RW': { PAS: 24, SHO: 23, DEF: 0, DRI: 40, PAC: 13, PHY: 0, GK: 0 },
  'CAM': { PAS: 34, SHO: 21, DEF: 0, DRI: 38, PAC: 7, PHY: 0, GK: 0 },
  'CM': { PAS: 43, SHO: 12, DEF: 10, DRI: 29, PAC: 0, PHY: 6, GK: 0 },
  'LM': { PAS: 43, SHO: 12, DEF: 10, DRI: 29, PAC: 0, PHY: 6, GK: 0 },
  'RM': { PAS: 43, SHO: 12, DEF: 10, DRI: 29, PAC: 0, PHY: 6, GK: 0 },
  'CDM': { PAS: 28, SHO: 0, DEF: 40, DRI: 17, PAC: 0, PHY: 15, GK: 0 },
  'LWB': { PAS: 19, SHO: 0, DEF: 44, DRI: 17, PAC: 10, PHY: 10, GK: 0 },
  'RWB': { PAS: 19, SHO: 0, DEF: 44, DRI: 17, PAC: 10, PHY: 10, GK: 0 },
  'LB': { PAS: 19, SHO: 0, DEF: 44, DRI: 17, PAC: 10, PHY: 10, GK: 0 },
  'RB': { PAS: 19, SHO: 0, DEF: 44, DRI: 17, PAC: 10, PHY: 10, GK: 0 },
  'CB': { PAS: 5, SHO: 0, DEF: 64, DRI: 9, PAC: 2, PHY: 20, GK: 0 },
  'GK': { PAS: 0, SHO: 0, DEF: 0, DRI: 0, PAC: 0, PHY: 0, GK: 100 }
};

/**
 * Calculate the impact of +1 in a specific stat on overall rating
 * @param primaryPosition - The player's primary position
 * @param statLabel - The stat label (PAC, DRI, PAS, SHO, DEF, PHY)
 * @returns The OVR impact (e.g., 0.21 for +0.21 OVR)
 */
export function calculateStatImpact(primaryPosition: string, statLabel: string): number {
  const position = primaryPosition as MFLPosition;
  
  // If position is not in the weights table, return 0
  if (!POSITION_ATTRIBUTE_WEIGHTS[position]) {
    return 0;
  }
  
  const weights = POSITION_ATTRIBUTE_WEIGHTS[position];
  
  // Map stat labels to weight keys
  const statKeyMap: Record<string, string> = {
    'PAC': 'PAC',
    'DRI': 'DRI',
    'PAS': 'PAS',
    'SHO': 'SHO',
    'DEF': 'DEF',
    'PHY': 'PHY'
  };
  
  const weightKey = statKeyMap[statLabel];
  if (!weightKey || !weights[weightKey]) {
    return 0;
  }
  
  // Impact is the weight divided by 100 (since weights are percentages)
  return weights[weightKey] / 100;
}

/**
 * Format the impact value for display
 * @param impact - The OVR impact value
 * @returns Formatted string (e.g., "+0.21" or "+0.00")
 */
export function formatStatImpact(impact: number): string {
  if (impact === 0) {
    return '+0.00';
  }
  const sign = impact > 0 ? '+' : '';
  return `${sign}${impact.toFixed(2)}`;
}

