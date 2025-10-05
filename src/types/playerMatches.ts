export interface PlayerMatchStats {
  id: number;
  side: 'home' | 'away';
  match: {
    id: number;
    status: string;
    type: string;
    homeTeamName: string;
    awayTeamName: string;
    homeScore: number;
    awayScore: number;
    competition: {
      name: string;
      code: string;
    };
    startDate: number;
  };
  stats: {
    position: string;
    time: number; // in seconds
    rating: number;
    goals: number;
    assists: number;
    shots: number;
    shotsOnTarget: number;
    passes: number;
    passesAccurate: number;
    crosses: number;
    crossesAccurate: number;
    dribblingSuccess: number;
    chancesCreated: number;
    xG: number;
    yellowCards: number;
    redCards: number;
    foulsCommitted: number;
    foulsSuffered: number;
    saves: number;
    goalsConceded: number;
    shotsInterceptions: number;
    clearances: number;
    dribbledPast: number;
    ownGoals: number;
    defensiveDuelsWon: number;
  };
}

export interface PlayerMatchesResponse {
  success: boolean;
  data: PlayerMatchStats[];
  error?: string;
}

export interface PositionSummary {
  position: string;
  matches: number;
  averageRating: number;
  totalMinutes: number;
  totalGoals: number;
  totalAssists: number;
  averageGoals: number;
  averageAssists: number;
}
