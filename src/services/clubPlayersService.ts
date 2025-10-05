/**
 * Club Players Service for MFL Club Player Management
 * 
 * This service provides access to MFL club player data from the official API.
 * It fetches real player data for specific clubs with caching.
 */

import axios from 'axios';

export interface ClubPlayer {
  id: number;
  metadata: {
    id: number;
    firstName: string;
    lastName: string;
    overall: number;
    nationalities: string[];
    positions: string[];
    preferredFoot: string;
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
  ownedBy: {
    walletAddress: string;
    name: string;
    twitter: string;
    lastActive: number;
  };
  ownedSince: number;
  activeContract?: {
    id: number;
    status: string;
    kind: string;
    revenueShare: number;
    totalRevenueShareLocked: number;
    club: {
      id: number;
      name: string;
      mainColor: string;
      secondaryColor: string;
      city: string;
      division: number;
      logoVersion: string;
      country: string;
      squads: any[];
    };
    startSeason: number;
    nbSeasons: number;
    autoRenewal: boolean;
    createdDateTime: number;
    clauses: any[];
  };
  hasPreContract: boolean;
  energy: number;
  offerStatus: number;
  stats?: {
    nbMatches: number;
    time: number;
    goals: number;
    shots: number;
    shotsOnTarget: number;
    shotsIntercepted: number;
    dribblingSuccess: number;
    assists: number;
    yellowCards: number;
    redCards: number;
    saves: number;
    goalsConceded: number;
    wins: number;
    draws: number;
    losses: number;
    foulsCommitted: number;
    foulsSuffered: number;
    rating: number;
    xG: number;
    chancesCreated: number;
    passes: number;
    passesAccurate: number;
    crosses: number;
    crossesAccurate: number;
    shotsInterceptions: number;
    clearances: number;
    dribbledPast: number;
    ownGoals: number;
    defensiveDuelsWon: number;
    v: number;
  };
  nbSeasonYellows: number;
}

class ClubPlayersService {
  private cache = new Map<string, { data: ClubPlayer[]; timestamp: number }>();
  private readonly CACHE_DURATION = 60 * 60 * 1000; // 1 hour

  private isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < this.CACHE_DURATION;
  }

  async fetchPlayersForClub(clubId: string): Promise<ClubPlayer[]> {
    const cacheKey = `club_players_${clubId}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && this.isCacheValid(cached.timestamp)) {
      console.log(`🎯 CACHE HIT: Using cached club players data for ${cacheKey}`);
      return cached.data;
    }

    try {
      const response = await axios.get<ClubPlayer[]>(
        `https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/clubs/${clubId}/players`
      );

      const players = response.data;
      
      // Cache the result with timestamp
      this.cache.set(cacheKey, { data: players, timestamp: Date.now() });
      console.log(`🚀 CACHE MISS: Fetched club players data from API for ${cacheKey}`);

      return players;
    } catch (error) {
      console.error('Error fetching club players:', error);
      throw new Error('Failed to fetch club players data');
    }
  }

  /**
   * Clear cache for a specific club or all cache
   */
  clearCache(clubId?: string): void {
    if (clubId) {
      const cacheKey = `club_players_${clubId}`;
      this.cache.delete(cacheKey);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get cache size
   */
  getCacheSize(): number {
    return this.cache.size;
  }
}

export const clubPlayersService = new ClubPlayersService();
