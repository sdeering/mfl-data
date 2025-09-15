/**
 * NFT Service for MFL Player Management
 * 
 * This service provides access to MFL player data from the official API.
 * It fetches real player data for connected wallet addresses.
 */

export interface MFLPlayer {
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
  nbSeasonYellows: number;
}

export interface NFTServiceConfig {
  apiBaseUrl?: string;
}

class NFTService {
  private config: NFTServiceConfig;
  private cache: Map<string, MFLPlayer[]> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_DURATION = 60 * 60 * 1000; // 1 hour

  constructor(config: NFTServiceConfig = {}) {
    this.config = {
      apiBaseUrl: 'https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod',
      ...config
    };
  }

  /**
   * Fetch MFL players for a given wallet address
   */
  async fetchNFTsForWallet(walletAddress: string): Promise<MFLPlayer[]> {
    const cacheKey = `players_${walletAddress}`;
    
    // Check cache first
    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey) || [];
    }

    try {
      // Fetch real player data from MFL API
      const response = await fetch(
        `${this.config.apiBaseUrl}/players?ownerWalletAddress=${walletAddress}&limit=1200`
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch players: ${response.status} ${response.statusText}`);
      }
      
      const players: MFLPlayer[] = await response.json();
      
      // Cache the results
      this.cache.set(cacheKey, players);
      this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_DURATION);
      
      return players;
    } catch (error) {
      console.error('Error fetching MFL players:', error);
      throw new Error('Failed to fetch MFL player collection');
    }
  }

  /**
   * Get player metadata for a specific player ID
   */
  async getPlayerMetadata(playerId: number): Promise<MFLPlayer | null> {
    try {
      // This would typically make an API call to get specific player metadata
      // For now, we'll need to fetch all players and filter
      // In a real implementation, you might have a specific endpoint for individual players
      return null;
    } catch (error) {
      console.error('Error fetching player metadata:', error);
      return null;
    }
  }

  /**
   * Validate wallet address format (Flow addresses are 16 hex characters)
   */
  private isValidFlowAddress(address: string): boolean {
    return /^[0-9a-f]{16}$/.test(address);
  }

  /**
   * Check if cache is still valid
   */
  private isCacheValid(key: string): boolean {
    const expiry = this.cacheExpiry.get(key);
    return expiry ? Date.now() < expiry : false;
  }

  /**
   * Clear cache for a specific wallet or all cache
   */
  clearCache(walletAddress?: string): void {
    if (walletAddress) {
      const cacheKey = `players_${walletAddress}`;
      this.cache.delete(cacheKey);
      this.cacheExpiry.delete(cacheKey);
    } else {
      this.cache.clear();
      this.cacheExpiry.clear();
    }
  }

  /**
   * Format player name for display
   */
  formatPlayerName(player: MFLPlayer): string {
    return `${player.metadata.firstName} ${player.metadata.lastName}`;
  }

  /**
   * Format positions for display
   */
  formatPositions(player: MFLPlayer): string {
    return player.metadata.positions.join(', ');
  }

  /**
   * Format nationalities for display
   */
  formatNationalities(player: MFLPlayer): string {
    return player.metadata.nationalities.join(', ');
  }

  /**
   * Get club name from active contract
   */
  getClubName(player: MFLPlayer): string {
    return player.activeContract?.club.name || 'No Club';
  }

  /**
   * Get division from active contract
   */
  getDivision(player: MFLPlayer): number | null {
    return player.activeContract?.club.division || null;
  }
}

// Export singleton instance
export const nftService = new NFTService();

// Export class for custom configurations
export default NFTService;