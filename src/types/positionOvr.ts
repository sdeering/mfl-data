// Position OVR Calculation Type Definitions
// For calculating player Overall Rating (OVR) for different positions

// ============================================================================
// BASE TYPES
// ============================================================================

/**
 * All possible positions in MFL
 */
export type MFLPosition = 'GK' | 'RB' | 'RWB' | 'LB' | 'LWB' | 'CB' | 'CDM' | 'CM' | 'CAM' | 'LM' | 'LW' | 'RM' | 'RW' | 'CF' | 'ST';

/**
 * Player attributes structure
 */
export interface PlayerAttributes {
  PAC: number;  // Pace (0-99)
  SHO: number;  // Shooting (0-99)
  PAS: number;  // Passing (0-99)
  DRI: number;  // Dribbling (0-99)
  DEF: number;  // Defense (0-99)
  PHY: number;  // Physical (0-99)
  GK: number;   // Goalkeeping (0-99)
}

/**
 * Player position data - simplified to array format
 */
export type PlayerPositions = MFLPosition[];

/**
 * Position familiarity levels for new algorithm
 */
export type PositionFamiliarity = 'PRIMARY' | 'SECONDARY' | 'FAMILIAR' | 'UNFAMILIAR';

/**
 * Position categories for UI grouping
 */
export type PositionCategory = 'GK' | 'Defense' | 'Midfield' | 'Attack';

// ============================================================================
// POSITION CATEGORIES
// ============================================================================

/**
 * Position category mapping
 */
export const POSITION_CATEGORIES: Record<MFLPosition, PositionCategory> = {
  GK: 'GK',
  CB: 'Defense',
  LB: 'Defense',
  RB: 'Defense',
  LWB: 'Defense',
  RWB: 'Defense',
  CDM: 'Midfield',
  CM: 'Midfield',
  CAM: 'Midfield',
  LM: 'Midfield',
  RM: 'Midfield',
  LW: 'Midfield',
  RW: 'Midfield',
  CF: 'Attack',
  ST: 'Attack'
} as const;

/**
 * Position groups for familiarity detection
 */
export const POSITION_GROUPS = {
  GK: ['GK'],
  Defense: ['CB', 'LB', 'RB', 'LWB', 'RWB'],
  DefensiveMidfield: ['CDM'],
  CentralMidfield: ['CM', 'CAM'],
  WideMidfield: ['LM', 'RM', 'LW', 'RW'],
  Attack: ['CF', 'ST']
} as const;

// ============================================================================
// FAMILIARITY PENALTIES
// ============================================================================

/**
 * Attribute penalties for each familiarity level
 */
export const FAMILIARITY_PENALTIES: Record<PositionFamiliarity, number> = {
  PRIMARY: 0,      // No penalty
  SECONDARY: -2,   // -2 penalty for secondary positions
  FAMILIAR: -6,    // -6 penalty for familiar positions
  UNFAMILIAR: -46  // -46 penalty for unfamiliar positions
} as const;

// ============================================================================
// POSITION WEIGHT MATRIX
// ============================================================================

/**
 * Weight distribution for each position
 * Each position has weights that sum to 1.0
 */
export interface PositionWeights {
  PAC: number;  // Pace weight
  SHO: number;  // Shooting weight
  PAS: number;  // Passing weight
  DRI: number;  // Dribbling weight
  DEF: number;  // Defense weight
  PHY: number;  // Physical weight
}

/**
 * Complete position weight matrix for all 15 positions
 */
export type PositionWeightMatrix = Record<MFLPosition, PositionWeights>;

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Error types for OVR calculation
 */
export type OVRCalculationError = 'CALCULATION_ERROR' | 'INVALID_ATTRIBUTES' | 'INVALID_POSITION';

/**
 * Standardized error structure
 */
export interface OVRError {
  type: OVRCalculationError;
  message: string;
  details?: Record<string, unknown>;
}

// ============================================================================
// CALCULATION RESULTS
// ============================================================================

/**
 * Single position OVR calculation result with success/error handling
 */
export interface PositionOVRResult {
  success: boolean;
  position: MFLPosition;
  ovr: number;
  weightedAverage: number;
  penalty: number;
  familiarity: PositionFamiliarity;
  playerId?: number;
  playerName?: string;
  error?: OVRError;
}

/**
 * Complete OVR calculation results for all positions with success/error handling
 */
export interface AllPositionOVRResults {
  success: boolean;
  playerId: number;
  playerName: string;
  results: Record<MFLPosition, PositionOVRResult>;
  error?: OVRError;
}

// ============================================================================
// INPUT DATA STRUCTURES
// ============================================================================

/**
 * Player data structure for OVR calculations
 */
export interface PlayerForOVRCalculation {
  id: number;
  name: string;
  attributes: PlayerAttributes;
  positions: PlayerPositions; // Array of positions, first is primary
  overall?: number; // Optional overall rating from MFL data
}

/**
 * Extended player data including metadata from MFL API
 */
export interface ExtendedPlayerForOVRCalculation extends PlayerForOVRCalculation {
  metadata: {
    overall: number;
    nationalities: string[];
    preferredFoot: 'LEFT' | 'RIGHT';
    age: number;
    height: number;
  };
}

// ============================================================================
// CALCULATION OPTIONS
// ============================================================================

/**
 * Options for OVR calculation
 */
export interface OVRCalculationOptions {
  /**
   * Whether to validate input data before calculation
   */
  validateInput?: boolean;

  /**
   * Whether to apply familiarity penalties
   */
  applyPenalties?: boolean;

  /**
   * Whether to round the final result
   */
  roundResult?: boolean;

  /**
   * Whether to include detailed breakdown in results
   */
  includeBreakdown?: boolean;
}

/**
 * Default calculation options
 */
export const DEFAULT_OVR_OPTIONS: OVRCalculationOptions = {
  validateInput: true,
  applyPenalties: true,
  roundResult: true,
  includeBreakdown: false
};

// ============================================================================
// VALIDATION CONSTANTS
// ============================================================================

/**
 * Valid attribute range
 */
export const ATTRIBUTE_RANGE = {
  MIN: 0,
  MAX: 99
} as const;

/**
 * Valid OVR range
 */
export const OVR_RANGE = {
  MIN: 0,
  MAX: 99
} as const;

/**
 * All positions array
 */
export const ALL_POSITIONS: MFLPosition[] = [
  'GK', 'RB', 'RWB', 'LB', 'LWB', 'CB', 'CDM', 'CM', 'CAM', 'LM', 'LW', 'RM', 'RW', 'CF', 'ST'
];

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Check if attributes are valid
 */
export function isValidAttributes(attributes: PlayerAttributes): boolean {
  return (
    typeof attributes.PAC === 'number' && attributes.PAC >= ATTRIBUTE_RANGE.MIN && attributes.PAC <= ATTRIBUTE_RANGE.MAX &&
    typeof attributes.SHO === 'number' && attributes.SHO >= ATTRIBUTE_RANGE.MIN && attributes.SHO <= ATTRIBUTE_RANGE.MAX &&
    typeof attributes.PAS === 'number' && attributes.PAS >= ATTRIBUTE_RANGE.MIN && attributes.PAS <= ATTRIBUTE_RANGE.MAX &&
    typeof attributes.DRI === 'number' && attributes.DRI >= ATTRIBUTE_RANGE.MIN && attributes.DRI <= ATTRIBUTE_RANGE.MAX &&
    typeof attributes.DEF === 'number' && attributes.DEF >= ATTRIBUTE_RANGE.MIN && attributes.DEF <= ATTRIBUTE_RANGE.MAX &&
    typeof attributes.PHY === 'number' && attributes.PHY >= ATTRIBUTE_RANGE.MIN && attributes.PHY <= ATTRIBUTE_RANGE.MAX
  );
}

/**
 * Check if position is valid
 */
export function isMFLPosition(position: string): position is MFLPosition {
  return ALL_POSITIONS.includes(position as MFLPosition);
}

// ============================================================================
// LEGACY SUPPORT
// ============================================================================

/**
 * Legacy position structure for backward compatibility
 */
export interface LegacyPlayerPositions {
  primary: MFLPosition;
  secondary: MFLPosition[];
}

/**
 * Legacy OVR result for backward compatibility
 */
export interface LegacyPositionOVRResult {
  position: MFLPosition;
  ovr: number;
  familiarity: PositionFamiliarity;
  category: PositionCategory;
  penalties: {
    applied: number;
    attributes: Partial<PlayerAttributes>;
  };
  weights: PositionWeights;
  calculation: {
    weightedSum: number;
    finalOVR: number;
  };
}

/**
 * Legacy all positions result for backward compatibility
 */
export interface LegacyAllPositionOVRResults {
  playerId: number;
  playerName: string;
  primaryPosition: MFLPosition;
  secondaryPositions: MFLPosition[];
  positions: Record<MFLPosition, LegacyPositionOVRResult>;
  categories: {
    GK?: LegacyPositionOVRResult[];
    Defense?: LegacyPositionOVRResult[];
    Midfield?: LegacyPositionOVRResult[];
    Attack?: LegacyPositionOVRResult[];
  };
  summary: {
    bestPosition: MFLPosition;
    bestOVR: number;
    worstPosition: MFLPosition;
    worstOVR: number;
    averageOVR: number;
  };
}

// ============================================================================
// SCRAPING TYPES
// ============================================================================

/**
 * Scraped position rating from external source
 */
export interface ScrapedPositionRating {
  position: string;
  familiarity: 'PRIMARY' | 'SECONDARY' | 'UNFAMILIAR';
  difference: number;
  rating: number;
}

/**
 * Scraped player data structure
 */
export interface ScrapedPlayerData {
  playerId: string;
  positionRatings: ScrapedPositionRating[];
  success: boolean;
  error?: string;
}
