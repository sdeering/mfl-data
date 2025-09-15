// Preload service for opponent match data
import { matchesService } from './matchesService';
import { clubsService } from './clubsService';

interface PreloadProgress {
  current: number;
  total: number;
  status: 'idle' | 'preloading' | 'completed' | 'error';
  message: string;
}

class PreloadService {
  private isPreloading = false;
  private preloadProgress: PreloadProgress = {
    current: 0,
    total: 0,
    status: 'idle',
    message: ''
  };
  private listeners: ((progress: PreloadProgress) => void)[] = [];

  // Subscribe to preload progress updates
  subscribe(listener: (progress: PreloadProgress) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  // Notify all listeners of progress updates
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.preloadProgress));
  }

  // Update progress and notify listeners
  private updateProgress(current: number, total: number, status: PreloadProgress['status'], message: string): void {
    this.preloadProgress = { current, total, status, message };
    this.notifyListeners();
  }

  // Get current progress
  getProgress(): PreloadProgress {
    return { ...this.preloadProgress };
  }

  // Check if preloading is in progress
  isPreloadingInProgress(): boolean {
    return this.isPreloading;
  }

  // Main preloading function
  async preloadOpponentData(walletAddress: string): Promise<void> {
    if (this.isPreloading) {
      console.log('Preloading already in progress, skipping...');
      return;
    }

    this.isPreloading = true;
    this.updateProgress(0, 0, 'preloading', 'Starting preload...');

    try {
      console.log('🚀 Starting opponent data preload...');
      
      // Get clubs for the wallet
      this.updateProgress(0, 0, 'preloading', 'Fetching clubs...');
      const clubs = await clubsService.fetchClubsForWallet(walletAddress);
      
      if (!clubs || clubs.length === 0) {
        throw new Error('No clubs found for this wallet');
      }

      console.log(`Found ${clubs.length} clubs for preloading`);

      // Get all upcoming matches for all clubs
      this.updateProgress(0, 0, 'preloading', 'Fetching upcoming matches...');
      const allMatches: any[] = [];
      
      for (const club of clubs) {
        try {
          const upcomingMatches = await matchesService.fetchUpcomingMatches(club.club.id.toString());
          const matchesWithClub = upcomingMatches.map(match => ({
            ...match,
            clubName: club.club.name,
            clubId: club.club.id
          }));
          allMatches.push(...matchesWithClub);
        } catch (error) {
          console.warn(`Failed to fetch matches for club ${club.club.name}:`, error);
        }
      }

      // Filter matches to next 48 hours
      const now = new Date();
      const fortyEightHoursFromNow = new Date(now.getTime() + 48 * 60 * 60 * 1000);
      
      const filteredMatches = allMatches.filter(match => {
        const matchDate = new Date(match.startDate);
        return matchDate >= now && matchDate <= fortyEightHoursFromNow;
      });

      console.log(`Found ${filteredMatches.length} matches in next 48 hours`);

      if (filteredMatches.length === 0) {
        this.updateProgress(0, 0, 'completed', 'No upcoming matches to preload');
        return;
      }

      // Get unique opponents
      const uniqueOpponents = new Set<string>();
      filteredMatches.forEach(match => {
        const opponentName = match.homeTeamName === match.clubName ? match.awayTeamName : match.homeTeamName;
        uniqueOpponents.add(opponentName);
      });

      const totalOpponents = uniqueOpponents.size;
      const totalMatchesToPreload = totalOpponents * 7; // 7 matches per opponent
      
      this.updateProgress(0, totalMatchesToPreload, 'preloading', `Preloading ${totalOpponents} opponents...`);

      console.log(`Preloading data for ${totalOpponents} unique opponents`);

      let currentMatchesPreloaded = 0;

      // Preload opponent data
      for (const match of filteredMatches) {
        const opponentName = match.homeTeamName === match.clubName ? match.awayTeamName : match.homeTeamName;
        const opponentSquadId = match.homeTeamName === match.clubName ? match.awaySquad.id : match.homeSquad.id;
        
        try {
          // Preload opponent's last 7 matches
          const opponentMatches = await matchesService.fetchOpponentPastMatches(opponentSquadId, 7);
          
          // Preload formations for each match
          for (const opponentMatch of opponentMatches) {
            await matchesService.fetchMatchFormation(opponentMatch.id.toString());
            currentMatchesPreloaded++;
            
            this.updateProgress(
              currentMatchesPreloaded, 
              totalMatchesToPreload, 
              'preloading', 
              `Preloading ${opponentName}... (${currentMatchesPreloaded}/${totalMatchesToPreload})`
            );
          }
        } catch (error) {
          console.warn(`Failed to preload data for opponent ${opponentName}:`, error);
          // Still count as processed to maintain progress
          currentMatchesPreloaded += 7; // Assume 7 matches even if failed
          this.updateProgress(
            currentMatchesPreloaded, 
            totalMatchesToPreload, 
            'preloading', 
            `Preloading ${opponentName}... (${currentMatchesPreloaded}/${totalMatchesToPreload})`
          );
        }
      }

      this.updateProgress(totalMatchesToPreload, totalMatchesToPreload, 'completed', 'Preload completed!');
      console.log('✅ Opponent data preload completed successfully');

    } catch (error) {
      console.error('❌ Error during preload:', error);
      this.updateProgress(0, 0, 'error', `Preload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      this.isPreloading = false;
    }
  }

  // Start preloading in background (non-blocking)
  startBackgroundPreload(walletAddress: string): void {
    // Don't await - let it run in background
    this.preloadOpponentData(walletAddress).catch(error => {
      console.error('Background preload failed:', error);
    });
  }
}

// Export singleton instance
export const preloadService = new PreloadService();
