/**
 * Player Experience History Types
 */

export interface PlayerExperienceEntry {
  date: number; // Unix timestamp
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

export interface PlayerExperienceHistory {
  success: boolean;
  data: PlayerExperienceEntry[];
  error?: string;
}

export interface ProgressionDataPoint {
  date: Date;
  overall: number;
  age?: number;
}
