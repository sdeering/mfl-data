import axios from 'axios';

export interface MFLClub {
  id: number;
  name: string;
  mainColor: string;
  secondaryColor: string;
  city: string;
  division: number;
  logoVersion: string;
  country: string;
  squads: any[];
}

export interface MFLCompetition {
  id: number;
  name: string;
  type: string;
  code: string;
}

export interface MFLClubData {
  title: string;
  club: MFLClub;
  tactics: boolean;
  competitions: MFLCompetition[];
}

class ClubsService {
  private cache = new Map<string, { data: MFLClubData[]; timestamp: number }>();
  private readonly CACHE_DURATION = 60 * 60 * 1000; // 1 hour

  private isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < this.CACHE_DURATION;
  }

  async fetchClubsForWallet(walletAddress: string): Promise<MFLClubData[]> {
    const cacheKey = `clubs_${walletAddress}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && this.isCacheValid(cached.timestamp)) {
      console.log(`🎯 CACHE HIT: Using cached clubs data for ${cacheKey}`);
      return cached.data;
    }

    try {
      const response = await axios.get<MFLClubData[]>(
        `https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/clubs?walletAddress=${walletAddress}`
      );

      const clubs = response.data;
      
      // Cache the result with timestamp
      this.cache.set(cacheKey, { data: clubs, timestamp: Date.now() });
      console.log(`🚀 CACHE MISS: Fetched clubs data from API for ${cacheKey}`);

      return clubs;
    } catch (error) {
      console.error('Error fetching clubs:', error);
      throw new Error('Failed to fetch clubs data');
    }
  }

  formatClubName(club: MFLClub): string {
    return club.name || 'Unknown Club';
  }

  formatCityCountry(club: MFLClub): string {
    return `${club.city}, ${club.country}`;
  }

  getDivisionName(division: number): string {
    // Based on the actual MFL data structure from the API
    const divisionNames: { [key: number]: string } = {
      1: 'Premier League',
      2: 'Championship', 
      3: 'League One',
      4: 'League Two',
      5: 'Bronze League',
      6: 'Iron League',
      7: 'Stone League',
      8: 'Ice League',
      9: 'County League',
      10: 'Local League'
    };
    
    return divisionNames[division] || `Division ${division}`;
  }

  getDivisionColor(division: number): string {
    // Based on the division color mapping from PlayerRecentMatches.tsx
    const divisionColors: { [key: number]: string } = {
      1: 'bg-red-600 text-white', // Premier League
      2: 'bg-blue-600 text-white', // Championship
      3: 'bg-green-600 text-white', // League One
      4: 'bg-purple-600 text-white', // League Two
      5: 'bg-amber-600 text-white', // Bronze League
      6: 'bg-gray-700 text-white', // Iron League
      7: 'bg-gray-500 text-white', // Stone League
      8: 'bg-cyan-400 text-gray-900', // Ice League
      9: 'bg-yellow-500 text-gray-900', // County League
      10: 'bg-gray-400 text-gray-900' // Local League
    };
    
    return divisionColors[division] || 'bg-gray-200 text-gray-700';
  }

  getCompetitionTypeIcon(type: string): string {
    switch (type) {
      case 'LEAGUE':
        return '🏆';
      case 'CUP':
        return '🥇';
      default:
        return '⚽';
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const clubsService = new ClubsService();
