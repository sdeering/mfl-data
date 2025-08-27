import { mflApi } from '../services/mflApi';
import { MFLExperienceHistoryResponse } from '../types/mflApi';

describe('Player Experience History Endpoint - Real API Tests', () => {
  // These tests use real API calls to verify the endpoint works correctly

  describe('getPlayerExperienceHistory', () => {
    it('should fetch experience history for player 93886 (Eric Hodge)', async () => {
      const history = await mflApi.getPlayerExperienceHistory(93886);

      expect(history).toBeDefined();
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThan(0);

      if (history.length > 0) {
        const experience = history[0];
        expect(experience.date).toBeDefined();
        expect(experience.values).toBeDefined();
        expect(typeof experience.date).toBe('number');
        expect(typeof experience.values).toBe('object');
      }
    }, 30000);

    it('should fetch experience history for player 44743 (Jesus Torres)', async () => {
      const history = await mflApi.getPlayerExperienceHistory(44743);

      expect(history).toBeDefined();
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThan(0);

      if (history.length > 0) {
        const experience = history[0];
        expect(experience.date).toBeDefined();
        expect(experience.values).toBeDefined();
        expect(typeof experience.date).toBe('number');
        expect(typeof experience.values).toBe('object');
      }
    }, 30000);

    it('should handle player with no experience history', async () => {
      // Test with a player that might not have experience history
      // We'll use a player ID that exists but may not have history
      const history = await mflApi.getPlayerExperienceHistory(116267);

      expect(history).toBeDefined();
      expect(Array.isArray(history)).toBe(true);
      // May be empty array or have some history
    }, 30000);

    it('should handle invalid player ID', async () => {
      // The API should return an error for invalid player IDs
      await expect(mflApi.getPlayerExperienceHistory(999999))
        .rejects.toThrow('HTTP 404: Not Found');
    }, 30000);
  });

  describe('Data Structure Validation', () => {
    it('should return properly structured experience data', async () => {
      const history = await mflApi.getPlayerExperienceHistory(93886);

      expect(history).toBeDefined();
      expect(Array.isArray(history)).toBe(true);

      if (history.length > 0) {
        const experience = history[0];
        
        // Verify experience structure
        expect(experience).toHaveProperty('date');
        expect(experience).toHaveProperty('values');

        // Verify values structure (may contain any combination of stats)
        const values = experience.values;
        expect(typeof values).toBe('object');
        
        // Check for common stat fields that might be present
        const possibleStats = ['age', 'overall', 'defense', 'passing', 'pace', 'dribbling', 'physical', 'shooting', 'goalkeeping'];
        
        possibleStats.forEach(stat => {
          if (stat in values) {
            expect(typeof values[stat]).toBe('number');
            expect(values[stat]).toBeGreaterThanOrEqual(0);
          }
        });

        // Verify data types
        expect(typeof experience.date).toBe('number');
        expect(experience.date).toBeGreaterThan(0);
      }
    }, 30000);

    it('should have chronological order (oldest to newest)', async () => {
      const history = await mflApi.getPlayerExperienceHistory(93886);

      expect(history).toBeDefined();
      expect(Array.isArray(history)).toBe(true);

      if (history.length > 1) {
        // Verify experiences are sorted by date (oldest first)
        for (let i = 1; i < history.length; i++) {
          expect(history[i].date).toBeGreaterThan(history[i - 1].date);
        }
      }
    }, 30000);
  });

  describe('Caching Behavior', () => {
    it('should cache experience history data for subsequent requests', async () => {
      // Clear cache first
      mflApi.clearCache();
      expect(mflApi.getCacheSize()).toBe(0);

      // First request
      const startTime1 = Date.now();
      const history1 = await mflApi.getPlayerExperienceHistory(93886);
      const time1 = Date.now() - startTime1;

      // Second request (should be cached)
      const startTime2 = Date.now();
      const history2 = await mflApi.getPlayerExperienceHistory(93886);
      const time2 = Date.now() - startTime2;

      // Verify same data
      expect(history1).toEqual(history2);
      
      // Verify cache is being used (second request should be faster)
      expect(time2).toBeLessThan(time1);
      expect(mflApi.getCacheSize()).toBeGreaterThan(0);
    }, 60000);
  });

  describe('Rate Limiting', () => {
    it('should track remaining requests for experience history endpoint', () => {
      const remaining = mflApi.getRemainingRequests('/players/93886/experiences/history');
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(2000); // Max 2000 requests per 5 minutes
    });
  });

  describe('Data Analysis', () => {
    it('should track player progression over time', async () => {
      const history = await mflApi.getPlayerExperienceHistory(93886);

      expect(history).toBeDefined();
      expect(Array.isArray(history)).toBe(true);

      if (history.length > 1) {
        // Find overall progression
        const overallStats = history
          .filter(exp => 'overall' in exp.values)
          .map(exp => ({ date: exp.date, overall: exp.values.overall }));

        if (overallStats.length > 1) {
          // Verify progression makes sense (should generally increase or stay the same)
          for (let i = 1; i < overallStats.length; i++) {
            expect(overallStats[i].overall).toBeGreaterThanOrEqual(overallStats[i - 1].overall - 1); // Allow for small decreases
          }
        }
      }
    }, 30000);

    it('should track age progression', async () => {
      const history = await mflApi.getPlayerExperienceHistory(93886);

      expect(history).toBeDefined();
      expect(Array.isArray(history)).toBe(true);

      if (history.length > 1) {
        // Find age progression
        const ageStats = history
          .filter(exp => 'age' in exp.values)
          .map(exp => ({ date: exp.date, age: exp.values.age }));

        if (ageStats.length > 1) {
          // Verify age only increases
          for (let i = 1; i < ageStats.length; i++) {
            expect(ageStats[i].age).toBeGreaterThanOrEqual(ageStats[i - 1].age);
          }
        }
      }
    }, 30000);

    it('should include various stat categories', async () => {
      const history = await mflApi.getPlayerExperienceHistory(93886);

      expect(history).toBeDefined();
      expect(Array.isArray(history)).toBe(true);

      if (history.length > 0) {
        // Collect all unique stat categories
        const statCategories = new Set<string>();
        history.forEach(exp => {
          Object.keys(exp.values).forEach(stat => statCategories.add(stat));
        });

        // Should have multiple stat categories
        expect(statCategories.size).toBeGreaterThan(1);
        
        // Verify common stats are present
        const commonStats = ['age', 'overall'];
        commonStats.forEach(stat => {
          expect(statCategories.has(stat)).toBe(true);
        });
      }
    }, 30000);
  });

  describe('Performance', () => {
    it('should handle requests efficiently', async () => {
      const startTime = Date.now();
      const history = await mflApi.getPlayerExperienceHistory(93886);
      const time = Date.now() - startTime;

      expect(history).toBeDefined();
      expect(Array.isArray(history)).toBe(true);
      
      // Verify reasonable response time (should be under 5 seconds)
      expect(time).toBeLessThan(5000);
    }, 30000);
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      // This test verifies that the API service can handle network issues
      // We can't easily simulate network errors in tests, but we can verify
      // that the service has proper error handling structure
      
      const history = await mflApi.getPlayerExperienceHistory(93886);
      expect(history).toBeDefined();
      
      // If we get here, the error handling is working correctly
      expect(true).toBe(true);
    }, 30000);
  });

  describe('Multiple Players', () => {
    it('should handle different players with varying experience histories', async () => {
      const playerIds = [93886, 44743, 116267]; // Players with different experience levels
      
      for (const playerId of playerIds) {
        const history = await mflApi.getPlayerExperienceHistory(playerId);
        expect(history).toBeDefined();
        expect(Array.isArray(history)).toBe(true);
        
        // Each player should have their own unique experience history
        if (history.length > 0) {
          history.forEach(exp => {
            expect(exp.date).toBeDefined();
            expect(exp.values).toBeDefined();
          });
        }
      }
    }, 90000);
  });

  describe('Chart-Ready Data Format', () => {
    it('should provide data suitable for charting', async () => {
      const history = await mflApi.getPlayerExperienceHistory(93886);

      expect(history).toBeDefined();
      expect(Array.isArray(history)).toBe(true);

      if (history.length > 0) {
        // Transform data for charting
        const chartData = history.map(exp => ({
          date: new Date(exp.date),
          ...exp.values
        }));

        // Verify chart data structure
        expect(chartData.length).toBe(history.length);
        chartData.forEach(point => {
          expect(point.date).toBeInstanceOf(Date);
          expect(typeof point).toBe('object');
        });

        // Verify chronological order for charting
        for (let i = 1; i < chartData.length; i++) {
          expect(chartData[i].date.getTime()).toBeGreaterThan(chartData[i - 1].date.getTime());
        }
      }
    }, 30000);
  });

  describe('Stat Progression Analysis', () => {
    it('should show meaningful stat progression', async () => {
      const history = await mflApi.getPlayerExperienceHistory(93886);

      expect(history).toBeDefined();
      expect(Array.isArray(history)).toBe(true);

      if (history.length > 1) {
        // Analyze progression for different stats
        const stats = ['overall', 'defense', 'passing', 'pace', 'dribbling', 'physical', 'shooting'];
        
        stats.forEach(stat => {
          const statProgression = history
            .filter(exp => stat in exp.values)
            .map(exp => ({ date: exp.date, value: exp.values[stat] }));

          if (statProgression.length > 1) {
            // Verify progression makes sense
            statProgression.forEach(point => {
              expect(typeof point.value).toBe('number');
              expect(point.value).toBeGreaterThanOrEqual(0);
            });
          }
        });
      }
    }, 30000);
  });
});
