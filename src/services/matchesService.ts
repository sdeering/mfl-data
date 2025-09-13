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

  private getCacheKey(squadId: string, type: 'past' | 'upcoming'): string {
    return `matches_${squadId}_${type}`;
  }

  private isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < this.CACHE_DURATION;
  }

  async fetchPastMatches(squadId: string): Promise<MFLMatch[]> {
    const cacheKey = this.getCacheKey(squadId, 'past');
    const cached = this.cache.get(cacheKey);

    if (cached && this.isCacheValid(cached.timestamp)) {
      return cached.data;
    }

    try {
      const url = `https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/matches`;
      const params = {
        squadId,
        past: true,
        onlyCompetitions: true,
        limit: 15
      };
      
      console.log('Fetching past matches from:', url, 'with params:', params);
      
      const response = await axios.get(url, { params });
      
      console.log('Past matches response:', response.data);

      const data = response.data;
      this.cache.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    } catch (error) {
      console.error('Error fetching past matches:', error);
      throw new Error('Failed to fetch past matches');
    }
  }

  async fetchUpcomingMatches(squadId: string): Promise<MFLMatch[]> {
    const cacheKey = this.getCacheKey(squadId, 'upcoming');
    const cached = this.cache.get(cacheKey);

    if (cached && this.isCacheValid(cached.timestamp)) {
      return cached.data;
    }

    try {
      const url = `https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/matches`;
      const params = {
        squadId,
        upcoming: true,
        live: true,
        limit: 30
      };
      
      console.log('Fetching upcoming matches from:', url, 'with params:', params);
      
      const response = await axios.get(url, { params });
      
      console.log('Upcoming matches response:', response.data);

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
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'planned':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
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
