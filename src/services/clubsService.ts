import axios from 'axios';
import { incrementUsage } from './apiUsage'

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
      console.log(`🚀 Fetching clubs from MFL API for wallet: ${walletAddress}`);
      
      // Use server-side API route to avoid CORS issues
      const baseUrl = typeof window !== 'undefined' 
        ? '' // Frontend context - use relative URL
        : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'; // Backend context
      
      const apiUrl = `${baseUrl}/api/clubs?walletAddress=${walletAddress}`;
      const startTime = Date.now();
      
      const response = await axios.get<{ success: boolean; data: MFLClubData[]; error?: string }>(
        apiUrl,
        {
          timeout: 10000 // 10 second timeout
        }
      );

      const elapsed = Date.now() - startTime;
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to fetch clubs from API');
      }

      console.log(`✅ API response received after ${elapsed}ms`);
      const clubs = response.data.data || [];
      
      // Cache the result with timestamp
      this.cache.set(cacheKey, { data: clubs, timestamp: Date.now() });
      console.log(`✅ Successfully fetched ${clubs.length} clubs from API for ${cacheKey}`);

      return clubs;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          console.error('❌ Timeout fetching clubs from API route');
          throw new Error('Request timeout - API is slow or unreachable');
        } else if (error.response) {
          const errorData = error.response.data as any;
          const errorMessage = errorData?.error || `HTTP ${error.response.status}: ${error.response.statusText}`;
          console.error('❌ Error response from API route:', error.response.status, errorMessage);
          throw new Error(errorMessage);
        } else if (error.request) {
          console.error('❌ No response from API route (network error)');
          throw new Error('Network error - unable to reach API');
        }
      }
      console.error('❌ Error fetching clubs:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to fetch clubs data: ${errorMessage}`);
    }
  }

  formatClubName(club: Pick<MFLClub, 'name'>): string {
    return club.name || 'Unknown Club';
  }

  formatCityCountry(club: Pick<MFLClub, 'city' | 'country'>): string {
    return `${club.city}, ${club.country}`;
  }

  getDivisionName(division: number | null | undefined): string {
    // MFL's divisions, top first, as its league names show them ("Silver – League 4")
    const divisionNames: { [key: number]: string } = {
      1: 'Diamond',
      2: 'Platinum',
      3: 'Gold',
      4: 'Silver',
      5: 'Bronze',
      6: 'Iron',
      7: 'Stone',
      8: 'Ice',
      9: 'Spark',
      10: 'Flint'
    };

    if (!division) return 'No division';
    return divisionNames[division] || `Division ${division}`;
  }

  getDivisionColor(division: number | null | undefined): string {
    // The same colours as the division badges in PlayerRecentMatches.tsx
    const divisionColors: { [key: number]: string } = {
      1: 'bg-purple-500 text-white', // Diamond
      2: 'bg-blue-400 text-white', // Platinum
      3: 'bg-yellow-500 text-gray-900', // Gold
      4: 'bg-gray-400 text-gray-900', // Silver
      5: 'bg-amber-600 text-white', // Bronze
      6: 'bg-gray-700 text-white', // Iron
      7: 'bg-gray-500 text-white', // Stone
      8: 'bg-cyan-400 text-gray-900', // Ice
      9: 'bg-yellow-400 text-gray-900', // Spark
      10: 'bg-orange-600 text-white' // Flint
    };

    return (division && divisionColors[division]) || 'bg-gray-200 text-gray-700';
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
