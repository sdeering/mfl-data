// MFL API Type Definitions
// Based on actual API responses from https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/

// ============================================================================
// BASE TYPES
// ============================================================================

export type MFLPosition = 'GK' | 'RB' | 'RWB' | 'LB' | 'LWB' | 'CB' | 'CDM' | 'CM' | 'CAM' | 'LM' | 'LW' | 'RM' | 'RW' | 'CF' | 'ST';

export type MFLInterval = '24H' | 'WEEK' | 'MONTH' | 'ALL' | 'CURRENT_SEASON';

export type MFLContractStatus = 'ACTIVE' | 'INACTIVE' | 'EXPIRED';

export type MFLContractKind = 'CONTRACT' | 'LOAN' | 'TRANSFER';

export type MFLListingType = 'SALE' | 'LOAN' | 'TRANSFER';

export type MFLListingStatus = 'BOUGHT' | 'SOLD' | 'CANCELLED' | 'EXPIRED';

// ============================================================================
// PLAYER METADATA
// ============================================================================

export interface MFLPlayerMetadata {
  id: number;
  firstName: string;
  lastName: string;
  overall: number;
  nationalities: string[];
  positions: MFLPosition[];
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
  retirementYears?: number;
}

// ============================================================================
// OWNERSHIP
// ============================================================================

export interface MFLOwner {
  walletAddress: string;
  name: string;
  twitter?: string;
  lastActive: number;
}

// ============================================================================
// CLUB/TEAM
// ============================================================================

export interface MFLClub {
  id: number;
  name: string;
  mainColor: string;
  secondaryColor: string;
  city: string;
  division: number;
  logoVersion: string;
  country: string;
  squads: unknown[]; // TODO: Define squad structure if needed
}

// ============================================================================
// CONTRACTS
// ============================================================================

export interface MFLContract {
  id: number;
  status: MFLContractStatus;
  kind: MFLContractKind;
  revenueShare: number;
  totalRevenueShareLocked: number;
  club: MFLClub;
  startSeason: number;
  nbSeasons: number;
  autoRenewal: boolean;
  createdDateTime: number;
  clauses: unknown[]; // TODO: Define clause structure if needed
}

// ============================================================================
// SEASON
// ============================================================================

export interface MFLSeason {
  id: number;
  name: string;
}

// ============================================================================
// MAIN PLAYER OBJECT
// ============================================================================

export interface MFLPlayer {
  id: number;
  metadata: MFLPlayerMetadata;
  ownedBy: MFLOwner;
  ownedSince: number;
  activeContract: MFLContract;
  hasPreContract: boolean;
  energy: number;
  offerStatus: number;
  nbSeasonYellows: number;
  season?: MFLSeason;
  jerseyNumber?: number;
}

// ============================================================================
// API RESPONSES
// ============================================================================

// Player Information Response
export interface MFLPlayerResponse {
  player: MFLPlayer;
}

// Player Progression Response
export interface MFLPlayerProgression {
  overall?: number;
  defense?: number;
  dribbling?: number;
  pace?: number;
  passing?: number;
  physical?: number;
  shooting?: number;
  goalkeeping?: number;
}

export interface MFLPlayerProgressionsResponse {
  [playerId: string]: MFLPlayerProgression;
}

// Owner Players Response
export type MFLOwnerPlayersResponse = MFLPlayer[];

// Sale History Response
export interface MFLSaleHistoryItem {
  id: number;
  type: MFLListingType;
  purchaseDateTime: number;
  status: MFLListingStatus;
  price: number;
  sellerAddress: string;
  sellerName: string;
  buyerAddress: string;
  buyerName: string;
  player: MFLPlayer;
}

export type MFLSaleHistoryResponse = MFLSaleHistoryItem[];

// Player Experience History Response
export interface MFLExperienceHistoryItem {
  date: number;
  values: {
    age?: number;
    overall?: number;
    defense?: number;
    passing?: number;
    pace?: number;
    dribbling?: number;
    physical?: number;
    shooting?: number;
    goalkeeping?: number;
  };
}

export type MFLExperienceHistoryResponse = MFLExperienceHistoryItem[];

// ============================================================================
// MATCH TYPES (Placeholder - need to test actual endpoints)
// ============================================================================

export interface MFLMatchDetails {
  id: string;
  // TODO: Define match details structure when we test the endpoint
}

export interface MFLMatchReport {
  id: string;
  // TODO: Define match report structure when we test the endpoint
}

// ============================================================================
// API REQUEST PARAMETERS
// ============================================================================

export interface MFLPlayerProgressionParams {
  playersIds: string | string[];
  interval: MFLInterval;
}

export interface MFLOwnerPlayersParams {
  ownerWalletAddress: string;
  limit?: number;
  isRetired?: boolean;
}

export interface MFLSaleHistoryParams {
  limit?: number;
  playerId: string;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type MFLPlayerId = string | number;

export interface MFLAPIError {
  error: string;
  message?: string;
  statusCode?: number;
}

// ============================================================================
// RESPONSE WRAPPERS
// ============================================================================

export interface MFLAPIResponse<T> {
  data: T;
  error?: MFLAPIError;
}

export interface MFLPaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
