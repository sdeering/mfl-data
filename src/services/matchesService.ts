import axios from 'axios';

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
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  private getCacheKey(clubId: string, type: 'past' | 'upcoming'): string {
    return `matches_${clubId}_${type}`;
  }

  private isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < this.CACHE_DURATION;
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

    if (cached && this.isCacheValid(cached.timestamp)) {
      return cached.data;
    }

    try {
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

    if (cached && this.isCacheValid(cached.timestamp)) {
      return cached.data;
    }

    try {
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
}

export const matchesService = new MatchesService();
