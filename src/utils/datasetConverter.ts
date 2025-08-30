import { PlayerForOVRCalculation } from '../types/positionOvr';

/**
 * Interface for the dataset player format
 */
export interface DatasetPlayer {
  name: string;
  id: number;
  inputUrl: string;
  inputData: string;
  primary: string;
  secondary: string;
  ST: number;
  CF: number;
  CAM: number;
  RW: number;
  LW: number;
  RM: number;
  LM: number;
  CM: number;
  CDM: number;
  RWB: number;
  LWB: number;
  RB: number;
  LB: number;
  CB: number;
}

/**
 * Convert dataset player format to our algorithm format
 */
export function convertDatasetPlayerToOVRFormat(datasetPlayer: DatasetPlayer): PlayerForOVRCalculation {
  try {
    // Parse the inputData JSON to get the original MFL player data
    const inputData = JSON.parse(datasetPlayer.inputData);
    const mflPlayer = inputData.player;
    
    // Extract the required fields
    const metadata = mflPlayer.metadata;
    
    return {
      id: metadata.id,
      name: `${metadata.firstName} ${metadata.lastName}`,
      attributes: {
        PAC: metadata.pace,
        SHO: metadata.shooting,
        PAS: metadata.passing,
        DRI: metadata.dribbling,
        DEF: metadata.defense,
        PHY: metadata.physical
      },
      positions: metadata.positions
    };
  } catch (error) {
    throw new Error(`Failed to convert dataset player: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate dataset player data
 */
export function validateDatasetPlayer(datasetPlayer: any): datasetPlayer is DatasetPlayer {
  return (
    datasetPlayer &&
    typeof datasetPlayer.name === 'string' &&
    typeof datasetPlayer.id === 'number' &&
    typeof datasetPlayer.inputData === 'string' &&
    typeof datasetPlayer.primary === 'string' &&
    Array.isArray(datasetPlayer.metadata?.positions) &&
    datasetPlayer.metadata?.pace !== undefined &&
    datasetPlayer.metadata?.shooting !== undefined &&
    datasetPlayer.metadata?.passing !== undefined &&
    datasetPlayer.metadata?.dribbling !== undefined &&
    datasetPlayer.metadata?.defense !== undefined &&
    datasetPlayer.metadata?.physical !== undefined
  );
}

/**
 * Convert dataset response to our format
 */
export function convertDatasetResponseToOVRFormat(datasetResponse: any): PlayerForOVRCalculation {
  if (!validateDatasetPlayer(datasetResponse)) {
    throw new Error('Invalid dataset player data structure');
  }
  
  return convertDatasetPlayerToOVRFormat(datasetResponse);
}
