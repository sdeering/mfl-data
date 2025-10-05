// Position types for MFL players
export type PlayerPosition = 
  | 'GK' | 'LB' | 'CB' | 'RB' | 'LWB' | 'RWB' | 'CDM' | 'CM' | 'CAM' | 'LM' | 'RM' | 'LW' | 'RW' | 'CF' | 'ST';

// Position ratings interface
export interface PositionRatings {
  GK?: number;
  LB?: number;
  CB?: number;
  RB?: number;
  LWB?: number;
  RWB?: number;
  CDM?: number;
  CM?: number;
  CAM?: number;
  LM?: number;
  RM?: number;
  LW?: number;
  RW?: number;
  CF?: number;
  ST?: number;
}

// Player traits interface
export interface PlayerTrait {
  name: string;
  value: string;
}

// Main MFL Player interface with comprehensive metadata
export interface MFLPlayer {
  // Basic information
  id: string;
  name: string;
  description?: string;
  thumbnail?: string;
  owner?: string;
  
  // Personal information
  age?: number;
  height?: number; // in centimeters
  foot?: 'Left' | 'Right' | 'Both';
  country?: string;
  
  // Ratings and statistics
  overallRating?: number;
  
  // Position information
  primaryPosition?: PlayerPosition;
  secondaryPositions?: PlayerPosition[];
  
  // Detailed position ratings
  positionRatings?: PositionRatings;
  
  // Legacy traits (for backward compatibility)
  traits?: PlayerTrait[];
}



