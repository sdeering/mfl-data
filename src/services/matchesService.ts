import axios from 'axios';
import { incrementUsage } from './apiUsage'

export interface MFLMatch {
  id: number;
  status: string;
  type: string;
  homeCoach: string;
  homeSquad: {
    id: number;
    club: {
      id: number;
      name: string;
      mainColor: string;
      secondaryColor: string;
      logoVersion: string;
    };
  };
  homeTeamName: string;
  homeScore: number;
  awayCoach: string;
  awaySquad: {
    id: number;
    club: {
      id: number;
      name: string;
      mainColor: string;
      secondaryColor: string;
      logoVersion: string;
    };
  };
  awayTeamName: string;
  awayScore: number;
  competition: {
    id: number;
    status: string;
    type: string;
    subType?: string;
    name: string;
    code: string;
    prizePool: string;
    hasPassword: boolean;
    featured: boolean;
    subtitle: string;
    primaryColor: string;
    inactiveClubsOnly: boolean;
    areRegistrationsOpen: boolean;
    withAlliances: boolean;
    noFatigue: boolean;
    withXp: boolean;
    maxParticipants?: number;
    startingDate: number;
    entryFeesAmount?: number;
  };
  createdDateTime: number;
  startDate: number;
  homeSeen: boolean;
  awaySeen: boolean;
}

class MatchesService {
  private cache = new Map<string, { data: MFLMatch[]; timestamp: number }>();
  private readonly CACHE_DURATION = 60 * 60 * 1000; // 1 hour
  private readonly OPPONENT_CACHE_DURATION = 12 * 60 * 60 * 1000; // 12 hours for opponent matches

  private getCacheKey(clubId: string, type: 'past' | 'upcoming'): string {
    return `matches_${clubId}_${type}`;
  }

  private isCacheValid(timestamp: number): boolean {
    const isValid = Date.now() - timestamp < this.CACHE_DURATION;
    console.log(`🔍 CACHE VALIDATION: timestamp: ${timestamp}, now: ${Date.now()}, diff: ${Date.now() - timestamp}, duration: ${this.CACHE_DURATION}, valid: ${isValid}`);
    return isValid;
  }

  private isOpponentCacheValid(timestamp: number): boolean {
    const isValid = Date.now() - timestamp < this.OPPONENT_CACHE_DURATION;
    console.log(`🔍 CACHE VALIDATION: timestamp: ${timestamp}, now: ${Date.now()}, diff: ${Date.now() - timestamp}, duration: ${this.OPPONENT_CACHE_DURATION}, valid: ${isValid}`);
    return isValid;
  }

  // Public method to check if opponent data is cached
  isOpponentDataCached(opponentSquadId: number, limit: number = 5): boolean {
    const cacheKey = `opponent_past_${opponentSquadId}_${limit}`;
    const cached = this.cache.get(cacheKey);
    const isValid = !!(cached && this.isOpponentCacheValid(cached.timestamp));
    console.log(`🔍 CACHE: Checking ${cacheKey} - cached: ${!!cached}, valid: ${isValid}, timestamp: ${cached?.timestamp}, now: ${Date.now()}`);
    return isValid;
  }

  // Public method to get cached opponent data synchronously
  getCachedOpponentData(opponentSquadId: number, limit: number = 5): MFLMatch[] | null {
    const cacheKey = `opponent_past_${opponentSquadId}_${limit}`;
    const cached = this.cache.get(cacheKey);
    if (cached && this.isOpponentCacheValid(cached.timestamp)) {
      console.log(`🎯 CACHE HIT: Returning cached data for ${cacheKey}`);
      return cached.data;
    }
    return null;
  }

  // Public method to get cached formation data synchronously
  getCachedFormationData(matchId: string): string | null {
    const cacheKey = `match_formation_${matchId}`;
    const cached = this.cache.get(cacheKey);
    if (cached && this.isOpponentCacheValid(cached.timestamp)) {
      console.log(`🎯 CACHE HIT: Returning cached formation for ${cacheKey}`);
      return cached.data;
    }
    return null;
  }

  async fetchClubDetails(clubId: string): Promise<any> {
    const cacheKey = `club_details_${clubId}`;
    const cached = this.cache.get(cacheKey);

    if (cached && this.isCacheValid(cached.timestamp)) {
      return cached.data;
    }

    try {
      const url = `https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/clubs/${clubId}`;
      
      const response = await axios.get(url);
      
      const data = response.data;
      this.cache.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    } catch (error) {
      console.error('Error fetching club details:', error);
      throw new Error('Failed to fetch club details');
    }
  }

  async fetchPastMatches(clubId: string): Promise<MFLMatch[]> {
    const cacheKey = this.getCacheKey(clubId, 'past');
    const cached = this.cache.get(cacheKey);

    console.log(`🔍 CACHE CHECK: ${cacheKey} - cached: ${!!cached}, timestamp: ${cached?.timestamp}, now: ${Date.now()}`);

    if (cached && this.isCacheValid(cached.timestamp)) {
      console.log(`🎯 CACHE HIT: Using cached past matches for ${cacheKey}`);
      return cached.data;
    }

    try {
      console.log(`🚀 CACHE MISS: Fetching past matches from API for ${cacheKey}`);
      // First get club details to find the squad ID
      const clubDetails = await this.fetchClubDetails(clubId);
      
      // Try different possible locations for squad ID
      let squadId = clubDetails.squad?.id || 
                   clubDetails.squads?.[0]?.id || 
                   clubDetails.id; // Sometimes the club ID is the squad ID
      
      console.log('Looking for squad ID in club details:', {
        'clubDetails.squad?.id': clubDetails.squad?.id,
        'clubDetails.squads?.[0]?.id': clubDetails.squads?.[0]?.id,
        'clubDetails.id': clubDetails.id,
        'final squadId': squadId
      });
      
      if (!squadId) {
        console.log('No squad ID found for club:', clubId);
        return [];
      }
      
      console.log('Found squad ID:', squadId, 'for club:', clubId);
      
      const url = `https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/matches`;
      const params = {
        squadId: squadId.toString(),
        past: true,
        onlyCompetitions: true,
        limit: 15
      };
      
      console.log('Fetching past matches from:', url, 'with params:', params);
      
      const response = await axios.get(url, { params });
      try { await incrementUsage('mfl', '/matches'); } catch {}
      
      console.log('Past matches response:', response.data);
      console.log('Past matches count:', response.data?.length);
      if (response.data?.length > 0) {
        console.log('First match details:', {
          homeTeam: response.data[0].homeTeamName,
          awayTeam: response.data[0].awayTeamName,
          status: response.data[0].status
        });
        
        // Log all unique team names in past matches
        const allTeamNames = new Set();
        response.data.forEach(match => {
          allTeamNames.add(match.homeTeamName);
          allTeamNames.add(match.awayTeamName);
        });
        console.log('All team names in past matches:', Array.from(allTeamNames).sort());
      }

      const data = response.data;
      this.cache.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    } catch (error) {
      console.error('Error fetching past matches:', error);
      throw new Error('Failed to fetch past matches');
    }
  }

  async fetchUpcomingMatches(clubId: string): Promise<MFLMatch[]> {
    const cacheKey = this.getCacheKey(clubId, 'upcoming');
    const cached = this.cache.get(cacheKey);

    console.log(`🔍 CACHE CHECK: ${cacheKey} - cached: ${!!cached}, timestamp: ${cached?.timestamp}, now: ${Date.now()}`);

    if (cached && this.isCacheValid(cached.timestamp)) {
      console.log(`🎯 CACHE HIT: Using cached upcoming matches for ${cacheKey}`);
      return cached.data;
    }

    try {
      console.log(`🚀 CACHE MISS: Fetching upcoming matches from API for ${cacheKey}`);
      // First get club details to find the squad ID
      const clubDetails = await this.fetchClubDetails(clubId);
      
      // Try different possible locations for squad ID
      let squadId = clubDetails.squad?.id || 
                   clubDetails.squads?.[0]?.id || 
                   clubDetails.id; // Sometimes the club ID is the squad ID
      
      console.log('Looking for squad ID in club details (upcoming):', {
        'clubDetails.squad?.id': clubDetails.squad?.id,
        'clubDetails.squads?.[0]?.id': clubDetails.squads?.[0]?.id,
        'clubDetails.id': clubDetails.id,
        'final squadId': squadId
      });
      
      if (!squadId) {
        console.log('No squad ID found for club:', clubId);
        return [];
      }
      
      console.log('Found squad ID:', squadId, 'for club:', clubId);
      
      const url = `https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/matches`;
      const params = {
        squadId: squadId.toString(),
        upcoming: true,
        live: true,
        limit: 30
      };
      
      console.log('Fetching upcoming matches from:', url, 'with params:', params);
      
      const response = await axios.get(url, { params });
      try { await incrementUsage('mfl', '/matches'); } catch {}
      
      console.log('Upcoming matches response:', response.data);
      console.log('Upcoming matches count:', response.data?.length);
      if (response.data?.length > 0) {
        console.log('First upcoming match details:', {
          homeTeam: response.data[0].homeTeamName,
          awayTeam: response.data[0].awayTeamName,
          status: response.data[0].status
        });
        
        // Log all unique team names in upcoming matches
        const allTeamNames = new Set();
        response.data.forEach(match => {
          allTeamNames.add(match.homeTeamName);
          allTeamNames.add(match.awayTeamName);
        });
        console.log('All team names in upcoming matches:', Array.from(allTeamNames).sort());
      }

      const data = response.data;
      this.cache.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    } catch (error) {
      console.error('Error fetching upcoming matches:', error);
      throw new Error('Failed to fetch upcoming matches');
    }
  }

  formatMatchDate(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getMatchStatusColor(status: string): string {
    switch (status.toLowerCase()) {
      case 'live':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'finished':
      case 'ended':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'planned':
      case 'upcoming':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  }

  formatMatchStatus(status: string): string {
    switch (status.toLowerCase()) {
      case 'planned':
        return 'UPCOMING';
      case 'ended':
        return 'ENDED';
      default:
        return status.toUpperCase();
    }
  }

  getCompetitionTypeColor(type: string): string {
    switch (type.toLowerCase()) {
      case 'league':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'cup':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  }

  async fetchOpponentPastMatches(opponentSquadId: number, limit: number = 7): Promise<MFLMatch[]> {
    const cacheKey = `opponent_past_${opponentSquadId}_${limit}`;
    const cached = this.cache.get(cacheKey);

    if (cached && this.isOpponentCacheValid(cached.timestamp)) {
      console.log(`🎯 CACHE HIT: Using cached data for ${cacheKey}`);
      return cached.data;
    }

    try {
      console.log(`🚀 CACHE MISS: Fetching from API for ${cacheKey}`);
      // Fetch past matches using the opponent's squad ID
      const url = `https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/matches`;
      const params = {
        squadId: opponentSquadId.toString(),
        past: true,
        onlyCompetitions: true,
        limit: limit
      };
      
      console.log('Fetching opponent past matches for squad ID:', opponentSquadId);
      
      const response = await axios.get(url, { params });
      try { await incrementUsage('mfl', '/matches'); } catch {}
      
      console.log(`Found ${response.data.length} past matches for squad ${opponentSquadId}`);

      this.cache.set(cacheKey, { data: response.data, timestamp: Date.now() });
      console.log(`🔍 CACHE: Set ${cacheKey} with timestamp ${Date.now()}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching opponent past matches:', error);
      return [];
    }
  }

  getMatchResult(match: MFLMatch, teamName: string): 'W' | 'L' | 'D' | null {
    if (match.status !== 'ENDED') return null;
    
    const isHome = match.homeTeamName === teamName;
    const homeScore = match.homeScore || 0;
    const awayScore = match.awayScore || 0;
    
    if (homeScore > awayScore) {
      return isHome ? 'W' : 'L';
    } else if (awayScore > homeScore) {
      return isHome ? 'L' : 'W';
    } else {
      return 'D';
    }
  }

  async fetchMatchFormation(matchId: string): Promise<string | null> {
    const cacheKey = `match_formation_${matchId}`;
    const cached = this.cache.get(cacheKey);

    if (cached && this.isOpponentCacheValid(cached.timestamp)) {
      return cached.data;
    }

    try {
      const url = `https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/matches/${matchId}?withFormations=true`;
      
      const response = await axios.get(url);
      try { await incrementUsage('mfl', '/clubs/:id'); } catch {}
      const matchData = response.data;
      
      // Extract formation type from the match data
      let formation = null;
      if (matchData.homeFormation?.type) {
        formation = matchData.homeFormation.type;
      } else if (matchData.awayFormation?.type) {
        formation = matchData.awayFormation.type;
      }
      
      this.cache.set(cacheKey, { data: formation, timestamp: Date.now() });
      return formation;
    } catch (error) {
      console.error('Error fetching match formation:', error);
      return null;
    }
  }

  /**
   * Database-aware method to fetch matches for a wallet address
   * This method checks the database first before falling back to API
   */
  async fetchMatchesForWallet(walletAddress: string, matchType: 'upcoming' | 'previous' | 'all' = 'all'): Promise<{ upcoming: MFLMatch[], previous: MFLMatch[] }> {
    try {
      console.log(`🔍 DB: Fetching ${matchType} matches from database for wallet: ${walletAddress}`);
      
      const { supabaseDataService } = await import('./supabaseDataService');
      const dbService = supabaseDataService;
      
      const matchesData = await dbService.getMatchesData(walletAddress, matchType === 'all' ? undefined : matchType);
      
      console.log(`📊 DB: Found ${matchesData.upcoming.length} upcoming and ${matchesData.previous.length} previous matches in database`);
      
      return matchesData;
    } catch (error) {
      console.error('Error fetching matches from database:', error);
      throw new Error('Failed to fetch matches from database');
    }
  }

  /**
   * Database-aware method to fetch previous matches for a wallet address
   * Previous matches never expire and should always come from database
   */
  async fetchPreviousMatchesForWallet(walletAddress: string): Promise<MFLMatch[]> {
    try {
      console.log(`🔍 DB: Fetching previous matches from database for wallet: ${walletAddress}`);
      
      const { supabaseDataService } = await import('./supabaseDataService');
      const dbService = supabaseDataService;
      
      const matches = await dbService.getPreviousMatches(walletAddress);
      
      console.log(`📊 DB: Found ${matches.length} previous matches in database`);
      
      return matches;
    } catch (error) {
      console.error('Error fetching previous matches from database:', error);
      throw new Error('Failed to fetch previous matches from database');
    }
  }

  /**
   * Database-aware method to fetch upcoming matches for a wallet address
   * Upcoming matches have a 12-hour cache duration
   */
  async fetchUpcomingMatchesForWallet(walletAddress: string): Promise<MFLMatch[]> {
    try {
      console.log(`🔍 DB: Fetching upcoming matches from database for wallet: ${walletAddress}`);
      
      const { supabaseDataService } = await import('./supabaseDataService');
      const dbService = supabaseDataService;
      
      const matches = await dbService.getUpcomingMatches(walletAddress);
      
      console.log(`📊 DB: Found ${matches.length} upcoming matches in database`);
      
      return matches;
    } catch (error) {
      console.error('Error fetching upcoming matches from database:', error);
      throw new Error('Failed to fetch upcoming matches from database');
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const matchesService = new MatchesService();
