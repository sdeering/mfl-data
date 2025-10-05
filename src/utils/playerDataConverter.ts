import { PlayerForOVRCalculation } from '../types/positionOvr';

/**
 * MFL API Player interface based on the example provided
 */
export interface MFLPlayer {
  id: number;
  metadata: {
    id: number;
    firstName: string;
    lastName: string;
    overall: number;
    nationalities: string[];
    positions: string[];
    preferredFoot: 'LEFT' | 'RIGHT';
    age: number;
    height: number;
    pace: number;
    shooting: number;
    passing: number;
    dribbling: number;
    defense: number;
    physical: number;
    goalkeeping: number;
  };
  ownedBy?: {
    walletAddress: string;
    name: string;
    twitter: string;
    lastActive: number;
  };
  ownedSince?: number;
  activeContract?: any;
  hasPreContract?: boolean;
  energy?: number;
  offerStatus?: number;
  nbSeasonYellows?: number;
}

/**
 * Convert MFL API player data to PlayerForOVRCalculation format
 */
export function convertMFLPlayerToOVRFormat(mflPlayer: MFLPlayer): PlayerForOVRCalculation {
  // Validate the player data before conversion
  if (!validateMFLPlayerData(mflPlayer)) {
    throw new Error('Invalid player data structure');
  }

  return {
    id: mflPlayer.id,
    name: `${mflPlayer.metadata.firstName} ${mflPlayer.metadata.lastName}`,
    attributes: {
      PAC: mflPlayer.metadata.pace,
      SHO: mflPlayer.metadata.shooting,
      PAS: mflPlayer.metadata.passing,
      DRI: mflPlayer.metadata.dribbling,
      DEF: mflPlayer.metadata.defense,
      PHY: mflPlayer.metadata.physical,
      GK: mflPlayer.metadata.goalkeeping
    },
    positions: mflPlayer.metadata.positions as any[], // Convert to MFLPosition array
    overall: mflPlayer.metadata.overall
  };
}

/**
 * Convert MFL API response to PlayerForOVRCalculation format
 * Handles the wrapper format: { player: MFLPlayer }
 */
export function convertMFLResponseToOVRFormat(mflResponse: { player: MFLPlayer }): PlayerForOVRCalculation {
  return convertMFLPlayerToOVRFormat(mflResponse.player);
}

/**
 * Validate that MFL player data has all required fields
 */
export function validateMFLPlayerData(mflPlayer: any): mflPlayer is MFLPlayer {
  if (!mflPlayer || typeof mflPlayer !== 'object') {
    return false;
  }

  if (!mflPlayer.metadata || typeof mflPlayer.metadata !== 'object') {
    return false;
  }

  const requiredMetadataFields = [
    'id', 'firstName', 'lastName', 'overall', 'positions',
    'pace', 'shooting', 'passing', 'dribbling', 'defense', 'physical', 'goalkeeping'
  ];

  for (const field of requiredMetadataFields) {
    if (!(field in mflPlayer.metadata)) {
      return false;
    }
  }

  // Validate positions array
  if (!Array.isArray(mflPlayer.metadata.positions) || mflPlayer.metadata.positions.length === 0) {
    return false;
  }

  // Validate attribute ranges
  const attributes = ['pace', 'shooting', 'passing', 'dribbling', 'defense', 'physical', 'goalkeeping'];
  for (const attr of attributes) {
    const value = mflPlayer.metadata[attr];
    if (typeof value !== 'number' || value < 0 || value > 99) {
      return false;
    }
  }

  return true;
}

/**
 * Fetch player data from MFL API and convert to OVR format
 */
export async function fetchAndConvertPlayerData(playerId: number): Promise<PlayerForOVRCalculation> {
  try {
    const response = await fetch(`https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/players/${playerId}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.player) {
      throw new Error('Invalid API response: missing player data');
    }

    if (!validateMFLPlayerData(data.player)) {
      throw new Error('Invalid player data structure');
    }

    return convertMFLResponseToOVRFormat(data);
  } catch (error) {
    throw new Error(`Failed to fetch player data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
