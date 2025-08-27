import type { MFLPlayer } from '../types/mflApi';
import type { PlayerForOVRCalculation } from '../types/positionOvr';

/**
 * Convert MFL player data to the format expected by the position OVR calculator
 */
export function convertMFLPlayerToOVRFormat(player: MFLPlayer): PlayerForOVRCalculation {
  const isGoalkeeper = player.metadata.positions?.includes('GK');
  
  return {
    id: player.id, // ID is already a number
    name: `${player.metadata.firstName} ${player.metadata.lastName}`,
    positions: player.metadata.positions || [], // Use array format directly
    overall: player.metadata.overall, // Include the exact MFL overall rating
    attributes: {
      PAC: isGoalkeeper ? 0 : (player.metadata.pace || 0),
      SHO: isGoalkeeper ? 0 : (player.metadata.shooting || 0),
      PAS: isGoalkeeper ? 0 : (player.metadata.passing || 0),
      DRI: isGoalkeeper ? 0 : (player.metadata.dribbling || 0),
      DEF: isGoalkeeper ? 0 : (player.metadata.defense || 0),
      PHY: isGoalkeeper ? 0 : (player.metadata.physical || 0),
      GK: player.metadata.goalkeeping || 0 // Add goalkeeping attribute for GK calculations
    }
  };
}

/**
 * Check if a player has valid data for OVR calculation
 */
export function isValidForOVRCalculation(player: MFLPlayer): boolean {
  const isGoalkeeper = player.metadata.positions?.includes('GK');
  
  // Basic validation for all players
  const basicValidation = !!(
    player.metadata.positions &&
    player.metadata.positions.length > 0
  );
  
  if (!basicValidation) return false;
  
  // For goalkeepers, only require goalkeeping attribute
  if (isGoalkeeper) {
    return typeof player.metadata.goalkeeping === 'number';
  }
  
  // For outfield players, require all outfield attributes
  return !!(
    typeof player.metadata.pace === 'number' &&
    typeof player.metadata.shooting === 'number' &&
    typeof player.metadata.passing === 'number' &&
    typeof player.metadata.dribbling === 'number' &&
    typeof player.metadata.defense === 'number' &&
    typeof player.metadata.physical === 'number'
  );
}
