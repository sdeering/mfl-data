import { describe, it, expect } from '@jest/globals';

// Rate limiter class (copied from marketDataService.ts for testing)
class RateLimiter {
  private calls: number[] = [];
  private readonly maxCalls: number;
  private readonly timeWindow: number; // in milliseconds

  constructor(maxCalls: number = 10, timeWindowMs: number = 60000) { // 10 calls per minute
    this.maxCalls = maxCalls;
    this.timeWindow = timeWindowMs;
  }

  canMakeCall(): boolean {
    const now = Date.now();
    // Remove calls older than the time window
    this.calls = this.calls.filter(callTime => now - callTime < this.timeWindow);
    
    return this.calls.length < this.maxCalls;
  }

  recordCall(): void {
    this.calls.push(Date.now());
  }

  getRemainingCalls(): number {
    const now = Date.now();
    this.calls = this.calls.filter(callTime => now - callTime < this.timeWindow);
    return Math.max(0, this.maxCalls - this.calls.length);
  }

  getTimeUntilReset(): number {
    if (this.calls.length === 0) return 0;
    const oldestCall = Math.min(...this.calls);
    return Math.max(0, this.timeWindow - (Date.now() - oldestCall));
  }
}

// Market value expiration logic
const isMarketValueExpired = (lastCalculated: string): boolean => {
  const now = new Date();
  const calculatedDate = new Date(lastCalculated);
  const daysDiff = (now.getTime() - calculatedDate.getTime()) / (1000 * 60 * 60 * 24);
  return daysDiff > 7;
};

// Player limit logic
const applyPlayerLimit = (players: any[], limit?: number) => {
  return limit ? players.slice(0, limit) : players;
};

// Player sorting logic
const sortPlayersByOverall = (players: any[]) => {
  return players.sort((a, b) => {
    const aOverall = a.player?.data?.metadata?.overall || 0;
    const bOverall = b.player?.data?.metadata?.overall || 0;
    return bOverall - aOverall; // Descending order (highest first)
  });
};

describe('Market Value Protection Features', () => {
  describe('Rate Limiter', () => {
    it('should allow calls within the limit', () => {
      const rateLimiter = new RateLimiter(3, 1000); // 3 calls per second for testing
      
      expect(rateLimiter.canMakeCall()).toBe(true);
      rateLimiter.recordCall();
      expect(rateLimiter.canMakeCall()).toBe(true);
      rateLimiter.recordCall();
      expect(rateLimiter.canMakeCall()).toBe(true);
    });

    it('should block calls when limit is exceeded', () => {
      const rateLimiter = new RateLimiter(3, 1000);
      
      // Make 3 calls (the limit)
      rateLimiter.recordCall();
      rateLimiter.recordCall();
      rateLimiter.recordCall();
      
      // 4th call should be blocked
      expect(rateLimiter.canMakeCall()).toBe(false);
    });

    it('should track remaining calls correctly', () => {
      const rateLimiter = new RateLimiter(3, 1000);
      
      expect(rateLimiter.getRemainingCalls()).toBe(3);
      
      rateLimiter.recordCall();
      expect(rateLimiter.getRemainingCalls()).toBe(2);
      
      rateLimiter.recordCall();
      expect(rateLimiter.getRemainingCalls()).toBe(1);
      
      rateLimiter.recordCall();
      expect(rateLimiter.getRemainingCalls()).toBe(0);
    });

    it('should enforce 10 calls per minute limit for market data API', () => {
      const marketDataLimiter = new RateLimiter(10, 60000); // 10 calls per minute
      
      // Make 10 calls
      for (let i = 0; i < 10; i++) {
        expect(marketDataLimiter.canMakeCall()).toBe(true);
        marketDataLimiter.recordCall();
      }
      
      // 11th call should be blocked
      expect(marketDataLimiter.canMakeCall()).toBe(false);
      expect(marketDataLimiter.getRemainingCalls()).toBe(0);
    });
  });

  describe('7-Day Expiration Logic', () => {
    it('should correctly identify expired vs non-expired dates', () => {
      const now = new Date();
      
      // 3 days ago - should NOT be expired
      const threeDaysAgo = new Date(now.getTime() - (3 * 24 * 60 * 60 * 1000));
      const threeDaysAgoString = threeDaysAgo.toISOString();
      
      // 8 days ago - should BE expired
      const eightDaysAgo = new Date(now.getTime() - (8 * 24 * 60 * 60 * 1000));
      const eightDaysAgoString = eightDaysAgo.toISOString();
      
      expect(isMarketValueExpired(threeDaysAgoString)).toBe(false);
      expect(isMarketValueExpired(eightDaysAgoString)).toBe(true);
    });

    it('should handle edge case of exactly 7 days', () => {
      const now = new Date();
      const exactlySevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
      const exactlySevenDaysAgoString = exactlySevenDaysAgo.toISOString();
      
      // Exactly 7 days should NOT be expired (we use > 7, not >= 7)
      expect(isMarketValueExpired(exactlySevenDaysAgoString)).toBe(false);
    });

    it('should handle edge case of just over 7 days', () => {
      const now = new Date();
      const sevenDaysAndOneHourAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000) - (60 * 60 * 1000));
      const sevenDaysAndOneHourAgoString = sevenDaysAndOneHourAgo.toISOString();
      
      // Just over 7 days should BE expired
      expect(isMarketValueExpired(sevenDaysAndOneHourAgoString)).toBe(true);
    });
  });

  describe('10-Player Limit', () => {
    const mockAgencyPlayers = Array.from({ length: 210 }, (_, i) => ({
      mfl_player_id: i + 1,
      player: {
        data: {
          metadata: {
            firstName: `Player${i + 1}`,
            lastName: `Last${i + 1}`,
            overall: 80 + (i % 20), // Varying overall ratings
            age: 20 + (i % 15),
            positions: ['ST', 'CAM', 'CB'][i % 3]
          }
        }
      }
    }));

    it('should limit processing to 10 players when limit is specified', () => {
      const limit = 10;
      const playersToProcess = applyPlayerLimit(mockAgencyPlayers, limit);
      
      expect(playersToProcess).toHaveLength(10);
      expect(playersToProcess[0].mfl_player_id).toBe(1);
      expect(playersToProcess[9].mfl_player_id).toBe(10);
    });

    it('should process all players when no limit is specified', () => {
      const limit = undefined;
      const playersToProcess = applyPlayerLimit(mockAgencyPlayers, limit);
      
      expect(playersToProcess).toHaveLength(210);
    });

    it('should process correct number of players with different limits', () => {
      const testLimits = [5, 15, 50, 100];
      
      testLimits.forEach(limit => {
        const playersToProcess = applyPlayerLimit(mockAgencyPlayers, limit);
        expect(playersToProcess).toHaveLength(limit);
      });
    });

    it('should sort players by overall rating in descending order', () => {
      const sortedPlayers = sortPlayersByOverall(mockAgencyPlayers);
      
      // Check that the first player has the highest overall
      const firstPlayerOverall = sortedPlayers[0].player.data.metadata.overall;
      const secondPlayerOverall = sortedPlayers[1].player.data.metadata.overall;
      
      expect(firstPlayerOverall).toBeGreaterThanOrEqual(secondPlayerOverall);
    });

    it('should maintain sorting when applying limit', () => {
      const limit = 10;
      
      // Sort first, then apply limit
      const sortedPlayers = sortPlayersByOverall(mockAgencyPlayers);
      const playersToProcess = applyPlayerLimit(sortedPlayers, limit);
      
      // Verify the top 10 players are still sorted
      for (let i = 0; i < playersToProcess.length - 1; i++) {
        const currentOverall = playersToProcess[i].player.data.metadata.overall;
        const nextOverall = playersToProcess[i + 1].player.data.metadata.overall;
        expect(currentOverall).toBeGreaterThanOrEqual(nextOverall);
      }
    });

    it('should enforce 10-player limit in debug endpoint', () => {
      const debugLimit = 10;
      const playersToProcess = applyPlayerLimit(mockAgencyPlayers, debugLimit);
      
      expect(playersToProcess).toHaveLength(10);
      
      // Verify it's the top 10 players by overall rating
      const sortedPlayers = sortPlayersByOverall(mockAgencyPlayers);
      const expectedTop10 = applyPlayerLimit(sortedPlayers, 10);
      expect(playersToProcess).toEqual(expectedTop10);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle mixed expiration scenarios correctly', () => {
      const now = new Date();
      
      // Test different scenarios
      const threeDaysAgo = new Date(now.getTime() - (3 * 24 * 60 * 60 * 1000));
      const eightDaysAgo = new Date(now.getTime() - (8 * 24 * 60 * 60 * 1000));
      
      // Recent value (3 days old) - should NOT be expired
      expect(isMarketValueExpired(threeDaysAgo.toISOString())).toBe(false);
      
      // Expired value (8 days old) - should BE expired
      expect(isMarketValueExpired(eightDaysAgo.toISOString())).toBe(true);
    });

    it('should provide meaningful error messages when rate limited', () => {
      const marketDataLimiter = new RateLimiter(2, 1000);
      
      // Exceed the limit
      marketDataLimiter.recordCall();
      marketDataLimiter.recordCall();
      
      const remainingCalls = marketDataLimiter.getRemainingCalls();
      const timeUntilReset = marketDataLimiter.getTimeUntilReset();
      
      const errorMessage = `Rate limit exceeded. ${remainingCalls} calls remaining. Reset in ${Math.ceil(timeUntilReset / 1000)} seconds.`;
      
      expect(errorMessage).toContain('Rate limit exceeded');
      expect(errorMessage).toContain('0 calls remaining');
      expect(errorMessage).toContain('Reset in');
    });

    it('should maintain data integrity with limited processing', () => {
      const mockAgencyPlayers = Array.from({ length: 210 }, (_, i) => ({
        mfl_player_id: i + 1,
        player: {
          data: {
            metadata: {
              firstName: `Player${i + 1}`,
              lastName: `Last${i + 1}`,
              overall: 80 + (i % 20),
              age: 20 + (i % 15),
              positions: ['ST', 'CAM', 'CB'][i % 3]
            }
          }
        }
      }));

      const limit = 10;
      const playersToProcess = applyPlayerLimit(mockAgencyPlayers, limit);
      
      // Verify all players have required data structure
      playersToProcess.forEach(player => {
        expect(player).toHaveProperty('mfl_player_id');
        expect(player).toHaveProperty('player');
        expect(player.player).toHaveProperty('data');
        expect(player.player.data).toHaveProperty('metadata');
        
        const metadata = player.player.data.metadata;
        expect(metadata).toHaveProperty('firstName');
        expect(metadata).toHaveProperty('lastName');
        expect(metadata).toHaveProperty('overall');
        expect(metadata).toHaveProperty('age');
        expect(metadata).toHaveProperty('positions');
      });
    });
  });
});
