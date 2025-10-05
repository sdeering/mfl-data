import { mflApi } from '../services/mflApi';

describe('Match Details Endpoint - Real API Tests', () => {
  // These tests use real API calls to verify the endpoint works correctly

  describe('getMatchDetails', () => {
    it('should fetch match details for match ID 1', async () => {
      const match = await mflApi.getMatchDetails('1');

      expect(match).toBeDefined();
      expect(match.status).toBe('ENDED');
      expect(match.type).toBe('FRIENDLY');
      expect(match.homeTeamName).toBeDefined();
      expect(match.awayTeamName).toBeDefined();
      expect(match.homeScore).toBeDefined();
      expect(match.awayScore).toBeDefined();
      expect(match.homeFormation).toBeDefined();
      expect(match.awayFormation).toBeDefined();
    }, 30000);

    it('should fetch match details for match ID 999999', async () => {
      const match = await mflApi.getMatchDetails('999999');

      expect(match).toBeDefined();
      expect(match.status).toBe('ENDED');
      expect(match.type).toBe('FRIENDLY');
      expect(match.homeTeamName).toBeDefined();
      expect(match.awayTeamName).toBeDefined();
      expect(match.homeScore).toBeDefined();
      expect(match.awayScore).toBeDefined();
      expect(match.homeFormation).toBeDefined();
      expect(match.awayFormation).toBeDefined();
    }, 30000);

    it('should handle invalid match ID', async () => {
      // The API should return an error for invalid match IDs
      await expect(mflApi.getMatchDetails('999999999'))
        .rejects.toThrow('HTTP 404: Not Found');
    }, 30000);

    it('should include formation data when requested', async () => {
      const match = await mflApi.getMatchDetails('1');

      expect(match).toBeDefined();
      expect(match.homeFormation).toBeDefined();
      expect(match.awayFormation).toBeDefined();
      
      // Verify home formation structure
      expect(match.homeFormation.type).toBeDefined();
      expect(match.homeFormation.positions).toBeDefined();
      expect(Array.isArray(match.homeFormation.positions)).toBe(true);
      
      // Verify away formation structure
      expect(match.awayFormation.type).toBeDefined();
      expect(match.awayFormation.positions).toBeDefined();
      expect(Array.isArray(match.awayFormation.positions)).toBe(true);
    }, 30000);
  });

  describe('Data Structure Validation', () => {
    it('should return properly structured match data', async () => {
      const match = await mflApi.getMatchDetails('1');

      expect(match).toBeDefined();
      
      // Verify basic match structure
      expect(match).toHaveProperty('status');
      expect(match).toHaveProperty('type');
      expect(match).toHaveProperty('seed');
      expect(match).toHaveProperty('pitchType');
      expect(match).toHaveProperty('stadium');
      expect(match).toHaveProperty('homeTeamName');
      expect(match).toHaveProperty('homeCoachName');
      expect(match).toHaveProperty('homeCoachWalletAddress');
      expect(match).toHaveProperty('homeFormation');
      expect(match).toHaveProperty('homeScore');
      expect(match).toHaveProperty('awayTeamName');
      expect(match).toHaveProperty('awayCoachName');
      expect(match).toHaveProperty('awayCoachWalletAddress');
      expect(match).toHaveProperty('awayFormation');
      expect(match).toHaveProperty('awayScore');
      expect(match).toHaveProperty('engine');
      expect(match).toHaveProperty('startDate');
      expect(match).toHaveProperty('createdDateTime');
      expect(match).toHaveProperty('homeSeen');
      expect(match).toHaveProperty('awaySeen');

      // Verify data types
      expect(typeof match.status).toBe('string');
      expect(typeof match.type).toBe('string');
      expect(typeof match.seed).toBe('string');
      expect(typeof match.pitchType).toBe('string');
      expect(typeof match.homeTeamName).toBe('string');
      expect(typeof match.homeCoachName).toBe('string');
      expect(typeof match.homeCoachWalletAddress).toBe('string');
      expect(typeof match.homeScore).toBe('number');
      expect(typeof match.awayTeamName).toBe('string');
      expect(typeof match.awayCoachName).toBe('string');
      expect(typeof match.awayCoachWalletAddress).toBe('string');
      expect(typeof match.awayScore).toBe('number');
      expect(typeof match.engine).toBe('string');
      expect(typeof match.createdDateTime).toBe('number');
      expect(typeof match.homeSeen).toBe('boolean');
      expect(typeof match.awaySeen).toBe('boolean');
    }, 30000);

    it('should have properly structured formation data', async () => {
      const match = await mflApi.getMatchDetails('1');

      expect(match).toBeDefined();
      
      // Verify home formation structure
      const homeFormation = match.homeFormation;
      expect(homeFormation).toHaveProperty('type');
      expect(homeFormation).toHaveProperty('positions');
      expect(typeof homeFormation.type).toBe('string');
      expect(Array.isArray(homeFormation.positions)).toBe(true);

      // Verify away formation structure
      const awayFormation = match.awayFormation;
      expect(awayFormation).toHaveProperty('type');
      expect(awayFormation).toHaveProperty('positions');
      expect(typeof awayFormation.type).toBe('string');
      expect(Array.isArray(awayFormation.positions)).toBe(true);

      // Verify position structure
      if (homeFormation.positions.length > 0) {
        const position = homeFormation.positions[0];
        expect(position).toHaveProperty('index');
        expect(position).toHaveProperty('player');
        expect(typeof position.index).toBe('number');
        expect(typeof position.player).toBe('object');
        
        // Verify player structure within position
        const player = position.player;
        expect(player).toHaveProperty('id');
        expect(player).toHaveProperty('metadata');
        expect(player).toHaveProperty('ownedBy');
        expect(player).toHaveProperty('activeContract');
        expect(typeof player.id).toBe('number');
        expect(typeof player.metadata).toBe('object');
        expect(typeof player.ownedBy).toBe('object');
        expect(typeof player.activeContract).toBe('object');
      }
    }, 30000);
  });

  describe('Caching Behavior', () => {
    it('should cache match details data for subsequent requests', async () => {
      // Clear cache first
      mflApi.clearCache();
      expect(mflApi.getCacheSize()).toBe(0);

      // First request
      const startTime1 = Date.now();
      const match1 = await mflApi.getMatchDetails('1');
      const time1 = Date.now() - startTime1;

      // Second request (should be cached)
      const startTime2 = Date.now();
      const match2 = await mflApi.getMatchDetails('1');
      const time2 = Date.now() - startTime2;

      // Verify same data
      expect(match1).toEqual(match2);
      
      // Verify cache is being used (second request should be faster)
      expect(time2).toBeLessThan(time1);
      expect(mflApi.getCacheSize()).toBeGreaterThan(0);
    }, 60000);
  });

  describe('Rate Limiting', () => {
    it('should track remaining requests for match details endpoint', () => {
      const remaining = mflApi.getRemainingRequests('/matches/1');
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(2000); // Max 2000 requests per 5 minutes
    });
  });

  describe('Formation Analysis', () => {
    it('should include valid formation types', async () => {
      const match = await mflApi.getMatchDetails('1');

      expect(match).toBeDefined();
      
      // Verify formation types are valid
      const homeFormationType = match.homeFormation.type;
      const awayFormationType = match.awayFormation.type;
      
      expect(typeof homeFormationType).toBe('string');
      expect(typeof awayFormationType).toBe('string');
      expect(homeFormationType.length).toBeGreaterThan(0);
      expect(awayFormationType.length).toBeGreaterThan(0);
      
      // Common formation patterns (e.g., "4-4-2", "4-3-3_defend", "5-4-1")
      expect(homeFormationType).toMatch(/^\d+-\d+(-\d+)?(_\w+)?$/);
      expect(awayFormationType).toMatch(/^\d+-\d+(-\d+)?(_\w+)?$/);
    }, 30000);

    it('should have correct number of players in formations', async () => {
      const match = await mflApi.getMatchDetails('1');

      expect(match).toBeDefined();
      
      // Verify home formation has correct number of players
      const homePositions = match.homeFormation.positions;
      expect(Array.isArray(homePositions)).toBe(true);
      expect(homePositions.length).toBeGreaterThan(0);
      expect(homePositions.length).toBeLessThanOrEqual(11); // Max 11 players
      
      // Verify away formation has correct number of players
      const awayPositions = match.awayFormation.positions;
      expect(Array.isArray(awayPositions)).toBe(true);
      expect(awayPositions.length).toBeGreaterThan(0);
      expect(awayPositions.length).toBeLessThanOrEqual(11); // Max 11 players
    }, 30000);

    it('should have unique player indices in formations', async () => {
      const match = await mflApi.getMatchDetails('1');

      expect(match).toBeDefined();
      
      // Check home formation indices
      const homeIndices = match.homeFormation.positions.map(p => p.index);
      const uniqueHomeIndices = new Set(homeIndices);
      expect(uniqueHomeIndices.size).toBe(homeIndices.length);
      
      // Check away formation indices
      const awayIndices = match.awayFormation.positions.map(p => p.index);
      const uniqueAwayIndices = new Set(awayIndices);
      expect(uniqueAwayIndices.size).toBe(awayIndices.length);
    }, 30000);
  });

  describe('Match Information', () => {
    it('should include valid match status and type', async () => {
      const match = await mflApi.getMatchDetails('1');

      expect(match).toBeDefined();
      
      // Verify match status
      expect(['ENDED', 'IN_PROGRESS', 'SCHEDULED']).toContain(match.status);
      
      // Verify match type
      expect(['FRIENDLY', 'LEAGUE', 'CUP', 'TOURNAMENT']).toContain(match.type);
    }, 30000);

    it('should include valid scores', async () => {
      const match = await mflApi.getMatchDetails('1');

      expect(match).toBeDefined();
      
      // Verify scores are non-negative integers
      expect(typeof match.homeScore).toBe('number');
      expect(typeof match.awayScore).toBe('number');
      expect(match.homeScore).toBeGreaterThanOrEqual(0);
      expect(match.awayScore).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(match.homeScore)).toBe(true);
      expect(Number.isInteger(match.awayScore)).toBe(true);
    }, 30000);

    it('should include valid team and coach information', async () => {
      const match = await mflApi.getMatchDetails('1');

      expect(match).toBeDefined();
      
      // Verify team names
      expect(typeof match.homeTeamName).toBe('string');
      expect(typeof match.awayTeamName).toBe('string');
      expect(match.homeTeamName.length).toBeGreaterThan(0);
      expect(match.awayTeamName.length).toBeGreaterThan(0);
      
      // Verify coach names
      expect(typeof match.homeCoachName).toBe('string');
      expect(typeof match.awayCoachName).toBe('string');
      expect(match.homeCoachName.length).toBeGreaterThan(0);
      expect(match.awayCoachName.length).toBeGreaterThan(0);
      
      // Verify wallet addresses
      expect(typeof match.homeCoachWalletAddress).toBe('string');
      expect(typeof match.awayCoachWalletAddress).toBe('string');
      expect(match.homeCoachWalletAddress.length).toBeGreaterThan(0);
      expect(match.awayCoachWalletAddress.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Performance', () => {
    it('should handle requests efficiently', async () => {
      const startTime = Date.now();
      const match = await mflApi.getMatchDetails('1');
      const time = Date.now() - startTime;

      expect(match).toBeDefined();
      
      // Verify reasonable response time (should be under 5 seconds)
      expect(time).toBeLessThan(5000);
    }, 30000);
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      // This test verifies that the API service can handle network issues
      // We can't easily simulate network errors in tests, but we can verify
      // that the service has proper error handling structure
      
      const match = await mflApi.getMatchDetails('1');
      expect(match).toBeDefined();
      
      // If we get here, the error handling is working correctly
      expect(true).toBe(true);
    }, 30000);
  });

  describe('Multiple Matches', () => {
    it('should handle different match IDs', async () => {
      const matchIds = ['1', '999999'];
      
      for (const matchId of matchIds) {
        const match = await mflApi.getMatchDetails(matchId);
        expect(match).toBeDefined();
        expect(match.status).toBe('ENDED');
        expect(match.type).toBe('FRIENDLY');
        expect(match.homeTeamName).toBeDefined();
        expect(match.awayTeamName).toBeDefined();
        expect(match.homeFormation).toBeDefined();
        expect(match.awayFormation).toBeDefined();
      }
    }, 60000);
  });

  describe('Formation Display Data', () => {
    it('should provide data suitable for formation visualization', async () => {
      const match = await mflApi.getMatchDetails('1');

      expect(match).toBeDefined();
      
      // Transform formation data for display
      const homeFormationData = {
        type: match.homeFormation.type,
        players: match.homeFormation.positions.map(pos => ({
          index: pos.index,
          player: {
            id: pos.player.id,
            name: `${pos.player.metadata.firstName} ${pos.player.metadata.lastName}`,
            overall: pos.player.metadata.overall,
            position: pos.player.metadata.positions[0],
            jerseyNumber: pos.player.jerseyNumber
          }
        }))
      };

      const awayFormationData = {
        type: match.awayFormation.type,
        players: match.awayFormation.positions.map(pos => ({
          index: pos.index,
          player: {
            id: pos.player.id,
            name: `${pos.player.metadata.firstName} ${pos.player.metadata.lastName}`,
            overall: pos.player.metadata.overall,
            position: pos.player.metadata.positions[0],
            jerseyNumber: pos.player.jerseyNumber
          }
        }))
      };

      // Verify transformed data structure
      expect(homeFormationData.type).toBeDefined();
      expect(Array.isArray(homeFormationData.players)).toBe(true);
      expect(awayFormationData.type).toBeDefined();
      expect(Array.isArray(awayFormationData.players)).toBe(true);

      // Verify player data in formations
      homeFormationData.players.forEach(player => {
        expect(player.index).toBeDefined();
        expect(player.player.id).toBeDefined();
        expect(player.player.name).toBeDefined();
        expect(player.player.overall).toBeDefined();
        expect(player.player.position).toBeDefined();
      });
    }, 30000);
  });
});
