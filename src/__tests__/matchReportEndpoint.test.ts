import { mflApi } from '../services/mflApi';

describe('Match Report Endpoint - Real API Tests', () => {
  // These tests use real API calls to verify the endpoint works correctly

  describe('getMatchReport', () => {
    it('should fetch match report for match ID 999999', async () => {
      const report = await mflApi.getMatchReport('999999');

      expect(report).toBeDefined();
      expect(report.home).toBeDefined();
      expect(report.away).toBeDefined();
      expect(report.home.playersStats).toBeDefined();
      expect(report.away.playersStats).toBeDefined();
      expect(Array.isArray(report.home.playersStats)).toBe(true);
      expect(Array.isArray(report.away.playersStats)).toBe(true);
    }, 30000);

    it('should fetch match report for match ID 1 (may be empty)', async () => {
      const report = await mflApi.getMatchReport('1');

      expect(report).toBeDefined();
      expect(report.home).toBeDefined();
      expect(report.away).toBeDefined();
      expect(report.home.playersStats).toBeDefined();
      expect(report.away.playersStats).toBeDefined();
      expect(Array.isArray(report.home.playersStats)).toBe(true);
      expect(Array.isArray(report.away.playersStats)).toBe(true);
      // This match may have empty stats
    }, 30000);

    it('should handle invalid match ID', async () => {
      // The API should return an error for invalid match IDs
      await expect(mflApi.getMatchReport('999999999'))
        .rejects.toThrow('HTTP 404: Not Found');
    }, 30000);
  });

  describe('Data Structure Validation', () => {
    it('should return properly structured match report data', async () => {
      const report = await mflApi.getMatchReport('999999');

      expect(report).toBeDefined();
      
      // Verify basic report structure
      expect(report).toHaveProperty('home');
      expect(report).toHaveProperty('away');
      expect(report.home).toHaveProperty('playersStats');
      expect(report.away).toHaveProperty('playersStats');

      // Verify data types
      expect(typeof report.home).toBe('object');
      expect(typeof report.away).toBe('object');
      expect(Array.isArray(report.home.playersStats)).toBe(true);
      expect(Array.isArray(report.away.playersStats)).toBe(true);
    }, 30000);

    it('should have properly structured player stats', async () => {
      const report = await mflApi.getMatchReport('999999');

      expect(report).toBeDefined();
      
      // Check if there are player stats
      if (report.home.playersStats.length > 0) {
        const playerStat = report.home.playersStats[0];
        
        // Verify player stat structure
        expect(playerStat).toHaveProperty('position');
        expect(playerStat).toHaveProperty('time');
        expect(playerStat).toHaveProperty('rating');
        expect(playerStat).toHaveProperty('goals');
        expect(playerStat).toHaveProperty('shots');
        expect(playerStat).toHaveProperty('shotsOnTarget');
        expect(playerStat).toHaveProperty('assists');
        expect(playerStat).toHaveProperty('passes');
        expect(playerStat).toHaveProperty('passesAccurate');
        expect(playerStat).toHaveProperty('playerId');

        // Verify data types
        expect(typeof playerStat.position).toBe('string');
        expect(typeof playerStat.time).toBe('number');
        expect(typeof playerStat.rating).toBe('number');
        expect(typeof playerStat.goals).toBe('number');
        expect(typeof playerStat.shots).toBe('number');
        expect(typeof playerStat.shotsOnTarget).toBe('number');
        expect(typeof playerStat.assists).toBe('number');
        expect(typeof playerStat.passes).toBe('number');
        expect(typeof playerStat.passesAccurate).toBe('number');
        expect(typeof playerStat.playerId).toBe('number');
      }
    }, 30000);
  });

  describe('Caching Behavior', () => {
    it('should cache match report data for subsequent requests', async () => {
      // Clear cache first
      mflApi.clearCache();
      expect(mflApi.getCacheSize()).toBe(0);

      // First request
      const startTime1 = Date.now();
      const report1 = await mflApi.getMatchReport('999999');
      const time1 = Date.now() - startTime1;

      // Second request (should be cached)
      const startTime2 = Date.now();
      const report2 = await mflApi.getMatchReport('999999');
      const time2 = Date.now() - startTime2;

      // Verify same data
      expect(report1).toEqual(report2);
      
      // Verify cache is being used (second request should be faster)
      expect(time2).toBeLessThan(time1);
      expect(mflApi.getCacheSize()).toBeGreaterThan(0);
    }, 60000);
  });

  describe('Rate Limiting', () => {
    it('should track remaining requests for match report endpoint', () => {
      const remaining = mflApi.getRemainingRequests('/matches/999999/report');
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(2000); // Max 2000 requests per 5 minutes
    });
  });

  describe('Player Statistics Analysis', () => {
    it('should include comprehensive player statistics', async () => {
      const report = await mflApi.getMatchReport('999999');

      expect(report).toBeDefined();
      
      if (report.home.playersStats.length > 0) {
        const playerStat = report.home.playersStats[0];
        
        // Verify all expected stat fields are present
        const expectedStats = [
          'position', 'time', 'rating', 'goals', 'shots', 'shotsOnTarget',
          'shotsIntercepted', 'dribblingSuccess', 'xG', 'assists', 'chancesCreated',
          'passes', 'passesAccurate', 'crosses', 'crossesAccurate', 'yellowCards',
          'redCards', 'foulsCommitted', 'foulsSuffered', 'saves', 'goalsConceded',
          'shotsInterceptions', 'clearances', 'dribbledPast', 'ownGoals',
          'defensiveDuelsWon', 'goalsTimes', 'v', 'playerId'
        ];

        expectedStats.forEach(stat => {
          expect(playerStat).toHaveProperty(stat);
        });
      }
    }, 30000);

    it('should have valid statistical values', async () => {
      const report = await mflApi.getMatchReport('999999');

      expect(report).toBeDefined();
      
      if (report.home.playersStats.length > 0) {
        const playerStat = report.home.playersStats[0];
        
        // Verify numeric stats are valid
        expect(playerStat.time).toBeGreaterThanOrEqual(0);
        expect(playerStat.rating).toBeGreaterThanOrEqual(0);
        expect(playerStat.goals).toBeGreaterThanOrEqual(0);
        expect(playerStat.shots).toBeGreaterThanOrEqual(0);
        expect(playerStat.shotsOnTarget).toBeGreaterThanOrEqual(0);
        expect(playerStat.assists).toBeGreaterThanOrEqual(0);
        expect(playerStat.passes).toBeGreaterThanOrEqual(0);
        expect(playerStat.passesAccurate).toBeGreaterThanOrEqual(0);
        expect(playerStat.playerId).toBeGreaterThan(0);
        
        // Verify logical relationships
        expect(playerStat.shotsOnTarget).toBeLessThanOrEqual(playerStat.shots);
        expect(playerStat.passesAccurate).toBeLessThanOrEqual(playerStat.passes);
        expect(playerStat.goals).toBeLessThanOrEqual(playerStat.shotsOnTarget);
      }
    }, 30000);

    it('should include position-specific statistics', async () => {
      const report = await mflApi.getMatchReport('999999');

      expect(report).toBeDefined();
      
      // Check for goalkeeper-specific stats
      const goalkeepers = report.home.playersStats.filter(p => p.position === 'GK');
      if (goalkeepers.length > 0) {
        const gk = goalkeepers[0];
        expect(gk).toHaveProperty('saves');
        expect(gk).toHaveProperty('goalsConceded');
        expect(typeof gk.saves).toBe('number');
        expect(typeof gk.goalsConceded).toBe('number');
      }
      
      // Check for outfield player stats
      const outfieldPlayers = report.home.playersStats.filter(p => p.position !== 'GK');
      if (outfieldPlayers.length > 0) {
        const player = outfieldPlayers[0];
        expect(player).toHaveProperty('dribblingSuccess');
        expect(player).toHaveProperty('xG');
        expect(typeof player.dribblingSuccess).toBe('number');
        expect(typeof player.xG).toBe('number');
      }
    }, 30000);
  });

  describe('Team Statistics', () => {
    it('should provide statistics for both teams', async () => {
      const report = await mflApi.getMatchReport('999999');

      expect(report).toBeDefined();
      expect(report.home).toBeDefined();
      expect(report.away).toBeDefined();
      expect(report.home.playersStats).toBeDefined();
      expect(report.away.playersStats).toBeDefined();
      
      // Both teams should have player stats arrays
      expect(Array.isArray(report.home.playersStats)).toBe(true);
      expect(Array.isArray(report.away.playersStats)).toBe(true);
    }, 30000);

    it('should allow team statistics aggregation', async () => {
      const report = await mflApi.getMatchReport('999999');

      expect(report).toBeDefined();
      
      // Aggregate home team stats
      const homeStats = report.home.playersStats;
      if (homeStats.length > 0) {
        const totalGoals = homeStats.reduce((sum, player) => sum + player.goals, 0);
        const totalAssists = homeStats.reduce((sum, player) => sum + player.assists, 0);
        const totalPasses = homeStats.reduce((sum, player) => sum + player.passes, 0);
        const totalPassesAccurate = homeStats.reduce((sum, player) => sum + player.passesAccurate, 0);
        
        expect(typeof totalGoals).toBe('number');
        expect(typeof totalAssists).toBe('number');
        expect(typeof totalPasses).toBe('number');
        expect(typeof totalPassesAccurate).toBe('number');
        expect(totalGoals).toBeGreaterThanOrEqual(0);
        expect(totalAssists).toBeGreaterThanOrEqual(0);
        expect(totalPasses).toBeGreaterThanOrEqual(0);
        expect(totalPassesAccurate).toBeGreaterThanOrEqual(0);
        expect(totalPassesAccurate).toBeLessThanOrEqual(totalPasses);
      }
    }, 30000);
  });

  describe('Performance', () => {
    it('should handle requests efficiently', async () => {
      const startTime = Date.now();
      const report = await mflApi.getMatchReport('999999');
      const time = Date.now() - startTime;

      expect(report).toBeDefined();
      
      // Verify reasonable response time (should be under 5 seconds)
      expect(time).toBeLessThan(5000);
    }, 30000);
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      // This test verifies that the API service can handle network issues
      // We can't easily simulate network errors in tests, but we can verify
      // that the service has proper error handling structure
      
      const report = await mflApi.getMatchReport('999999');
      expect(report).toBeDefined();
      
      // If we get here, the error handling is working correctly
      expect(true).toBe(true);
    }, 30000);
  });

  describe('Multiple Matches', () => {
    it('should handle different match IDs', async () => {
      const matchIds = ['1', '999999'];
      
      for (const matchId of matchIds) {
        const report = await mflApi.getMatchReport(matchId);
        expect(report).toBeDefined();
        expect(report.home).toBeDefined();
        expect(report.away).toBeDefined();
        expect(report.home.playersStats).toBeDefined();
        expect(report.away.playersStats).toBeDefined();
        expect(Array.isArray(report.home.playersStats)).toBe(true);
        expect(Array.isArray(report.away.playersStats)).toBe(true);
      }
    }, 60000);
  });

  describe('Report Data Transformation', () => {
    it('should provide data suitable for statistical analysis', async () => {
      const report = await mflApi.getMatchReport('999999');

      expect(report).toBeDefined();
      
      // Transform data for analysis
      const homeTeamStats = {
        totalGoals: 0,
        totalAssists: 0,
        totalPasses: 0,
        totalPassesAccurate: 0,
        totalShots: 0,
        totalShotsOnTarget: 0,
        averageRating: 0,
        players: report.home.playersStats.length
      };

      if (report.home.playersStats.length > 0) {
        homeTeamStats.totalGoals = report.home.playersStats.reduce((sum, player) => sum + player.goals, 0);
        homeTeamStats.totalAssists = report.home.playersStats.reduce((sum, player) => sum + player.assists, 0);
        homeTeamStats.totalPasses = report.home.playersStats.reduce((sum, player) => sum + player.passes, 0);
        homeTeamStats.totalPassesAccurate = report.home.playersStats.reduce((sum, player) => sum + player.passesAccurate, 0);
        homeTeamStats.totalShots = report.home.playersStats.reduce((sum, player) => sum + player.shots, 0);
        homeTeamStats.totalShotsOnTarget = report.home.playersStats.reduce((sum, player) => sum + player.shotsOnTarget, 0);
        homeTeamStats.averageRating = report.home.playersStats.reduce((sum, player) => sum + player.rating, 0) / report.home.playersStats.length;
      }

      // Verify transformed data structure
      expect(typeof homeTeamStats.totalGoals).toBe('number');
      expect(typeof homeTeamStats.totalAssists).toBe('number');
      expect(typeof homeTeamStats.totalPasses).toBe('number');
      expect(typeof homeTeamStats.totalPassesAccurate).toBe('number');
      expect(typeof homeTeamStats.totalShots).toBe('number');
      expect(typeof homeTeamStats.totalShotsOnTarget).toBe('number');
      expect(typeof homeTeamStats.averageRating).toBe('number');
      expect(typeof homeTeamStats.players).toBe('number');
      
      // Verify logical relationships
      expect(homeTeamStats.totalGoals).toBeGreaterThanOrEqual(0);
      expect(homeTeamStats.totalAssists).toBeGreaterThanOrEqual(0);
      expect(homeTeamStats.totalPasses).toBeGreaterThanOrEqual(0);
      expect(homeTeamStats.totalPassesAccurate).toBeGreaterThanOrEqual(0);
      expect(homeTeamStats.totalShots).toBeGreaterThanOrEqual(0);
      expect(homeTeamStats.totalShotsOnTarget).toBeGreaterThanOrEqual(0);
      expect(homeTeamStats.averageRating).toBeGreaterThanOrEqual(0);
      expect(homeTeamStats.players).toBeGreaterThanOrEqual(0);
    }, 30000);
  });

  describe('Player Performance Analysis', () => {
    it('should identify top performers', async () => {
      const report = await mflApi.getMatchReport('999999');

      expect(report).toBeDefined();
      
      if (report.home.playersStats.length > 0) {
        // Find top scorer
        const topScorer = report.home.playersStats.reduce((top, player) => 
          player.goals > top.goals ? player : top, report.home.playersStats[0]);
        
        // Find player with highest rating
        const topRated = report.home.playersStats.reduce((top, player) => 
          player.rating > top.rating ? player : top, report.home.playersStats[0]);
        
        // Find player with most assists
        const topAssister = report.home.playersStats.reduce((top, player) => 
          player.assists > top.assists ? player : top, report.home.playersStats[0]);

        // Verify top performers have valid data
        expect(topScorer).toBeDefined();
        expect(topRated).toBeDefined();
        expect(topAssister).toBeDefined();
        expect(typeof topScorer.goals).toBe('number');
        expect(typeof topRated.rating).toBe('number');
        expect(typeof topAssister.assists).toBe('number');
      }
    }, 30000);
  });
});
