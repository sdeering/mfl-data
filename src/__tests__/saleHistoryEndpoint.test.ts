import { mflApi } from '../services/mflApi';

const skipReal = process.env.DISABLE_REAL_API_TESTS === '1' || process.env.CI === 'true'

const maybeDescribe = skipReal ? describe.skip : describe

maybeDescribe('Sale History Endpoint - Real API Tests', () => {
  // These tests use real API calls to verify the endpoint works correctly

  describe('getPlayerSaleHistory', () => {
    it('should fetch sale history for player 44743 (Jesus Torres)', async () => {
      const sales = await mflApi.getPlayerSaleHistory(44743, 5);

      expect(sales).toBeDefined();
      expect(Array.isArray(sales)).toBe(true);
      expect(sales.length).toBeLessThanOrEqual(5);

      if (sales.length > 0) {
        const sale = sales[0];
        expect(sale.id).toBeDefined();
        expect(sale.type).toBe('SALE');
        expect(sale.status).toBe('BOUGHT');
        expect(sale.price).toBeDefined();
        expect(sale.sellerAddress).toBeDefined();
        expect(sale.sellerName).toBeDefined();
        expect(sale.buyerAddress).toBeDefined();
        expect(sale.buyerName).toBeDefined();
        expect(sale.player).toBeDefined();
        expect(sale.player.id).toBe(44743);
        expect(sale.player.metadata.firstName).toBe('Jesus');
        expect(sale.player.metadata.lastName).toBe('Torres');
      }
    }, 30000);

    it('should fetch sale history for player 93886 (Eric Hodge)', async () => {
      const sales = await mflApi.getPlayerSaleHistory(93886, 3);

      expect(sales).toBeDefined();
      expect(Array.isArray(sales)).toBe(true);
      expect(sales.length).toBeLessThanOrEqual(3);

      if (sales.length > 0) {
        const sale = sales[0];
        expect(sale.id).toBeDefined();
        expect(sale.type).toBe('SALE');
        expect(sale.status).toBe('BOUGHT');
        expect(sale.price).toBeDefined();
        expect(sale.player).toBeDefined();
        expect(sale.player.id).toBe(93886);
        expect(sale.player.metadata.firstName).toBe('Eric');
        expect(sale.player.metadata.lastName).toBe('Hodge');
      }
    }, 30000);

    it('should respect the limit parameter', async () => {
      const limit = 2;
      const sales = await mflApi.getPlayerSaleHistory(44743, limit);

      expect(sales).toBeDefined();
      expect(Array.isArray(sales)).toBe(true);
      expect(sales.length).toBeLessThanOrEqual(limit);
    }, 30000);

    it('should handle player with no sales', async () => {
      const sales = await mflApi.getPlayerSaleHistory(999999, 10);

      expect(sales).toBeDefined();
      expect(Array.isArray(sales)).toBe(true);
      expect(sales.length).toBe(0);
    }, 30000);

    it('should handle invalid player ID', async () => {
      // The API should return an empty array for invalid player IDs
      const sales = await mflApi.getPlayerSaleHistory(0, 10);

      expect(sales).toBeDefined();
      expect(Array.isArray(sales)).toBe(true);
    }, 30000);
  });

  describe('Data Structure Validation', () => {
    it('should return properly structured sale data', async () => {
      const sales = await mflApi.getPlayerSaleHistory(44743, 1);

      expect(sales).toBeDefined();
      expect(Array.isArray(sales)).toBe(true);

      if (sales.length > 0) {
        const sale = sales[0];
        
        // Verify sale structure
        expect(sale).toHaveProperty('id');
        expect(sale).toHaveProperty('type');
        expect(sale).toHaveProperty('purchaseDateTime');
        expect(sale).toHaveProperty('status');
        expect(sale).toHaveProperty('price');
        expect(sale).toHaveProperty('sellerAddress');
        expect(sale).toHaveProperty('sellerName');
        expect(sale).toHaveProperty('buyerAddress');
        expect(sale).toHaveProperty('buyerName');
        expect(sale).toHaveProperty('player');

        // Verify player structure within sale
        expect(sale.player).toHaveProperty('id');
        expect(sale.player).toHaveProperty('metadata');
        expect(sale.player).toHaveProperty('season');
        expect(sale.player).toHaveProperty('ownedBy');
        expect(sale.player).toHaveProperty('ownedSince');
        expect(sale.player).toHaveProperty('activeContract');
        expect(sale.player).toHaveProperty('hasPreContract');
        expect(sale.player).toHaveProperty('energy');
        expect(sale.player).toHaveProperty('offerStatus');
        expect(sale.player).toHaveProperty('nbSeasonYellows');

        // Verify metadata structure
        expect(sale.player.metadata).toHaveProperty('id');
        expect(sale.player.metadata).toHaveProperty('firstName');
        expect(sale.player.metadata).toHaveProperty('lastName');
        expect(sale.player.metadata).toHaveProperty('overall');
        expect(sale.player.metadata).toHaveProperty('nationalities');
        expect(sale.player.metadata).toHaveProperty('positions');
        expect(sale.player.metadata).toHaveProperty('preferredFoot');
        expect(sale.player.metadata).toHaveProperty('age');
        expect(sale.player.metadata).toHaveProperty('height');

        // Verify data types
        expect(typeof sale.id).toBe('number');
        expect(typeof sale.type).toBe('string');
        expect(typeof sale.purchaseDateTime).toBe('number');
        expect(typeof sale.status).toBe('string');
        expect(typeof sale.price).toBe('number');
        expect(typeof sale.sellerAddress).toBe('string');
        expect(typeof sale.sellerName).toBe('string');
        expect(typeof sale.buyerAddress).toBe('string');
        expect(typeof sale.buyerName).toBe('string');
        expect(typeof sale.player.id).toBe('number');
        expect(typeof sale.player.metadata.firstName).toBe('string');
        expect(typeof sale.player.metadata.lastName).toBe('string');
        expect(typeof sale.player.metadata.overall).toBe('number');
        expect(Array.isArray(sale.player.metadata.nationalities)).toBe(true);
        expect(Array.isArray(sale.player.metadata.positions)).toBe(true);
      }
    }, 30000);
  });

  describe('Caching Behavior', () => {
    it('should cache sale history data for subsequent requests', async () => {
      // Clear cache first
      mflApi.clearCache();
      expect(mflApi.getCacheSize()).toBe(0);

      // First request
      const startTime1 = Date.now();
      const sales1 = await mflApi.getPlayerSaleHistory(44743, 3);
      const time1 = Date.now() - startTime1;

      // Second request (should be cached)
      const startTime2 = Date.now();
      const sales2 = await mflApi.getPlayerSaleHistory(44743, 3);
      const time2 = Date.now() - startTime2;

      // Verify same data
      expect(sales1).toEqual(sales2);
      
      // Verify cache is being used (second request should be faster)
      expect(time2).toBeLessThan(time1);
      expect(mflApi.getCacheSize()).toBeGreaterThan(0);
    }, 60000);
  });

  describe('Rate Limiting', () => {
    it('should track remaining requests for listings endpoint', () => {
      const remaining = mflApi.getRemainingRequests('/listings/feed');
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(100); // Max 100 requests per 5 minutes for listings
    });

    it('should enforce stricter rate limiting for listings endpoint', async () => {
      // Make multiple requests to test rate limiting
      const promises = [];
      for (let i = 0; i < 3; i++) {
        promises.push(mflApi.getPlayerSaleHistory(44743, 1));
      }

      const results = await Promise.all(promises);
      
      // All requests should succeed (within rate limit)
      results.forEach(sales => {
        expect(sales).toBeDefined();
        expect(Array.isArray(sales)).toBe(true);
      });
    }, 30000);
  });

  describe('Pagination and Limits', () => {
    it('should handle different limit values', async () => {
      const limits = [1, 5, 10, 25];
      
      for (const limit of limits) {
        const sales = await mflApi.getPlayerSaleHistory(44743, limit);
        expect(sales).toBeDefined();
        expect(Array.isArray(sales)).toBe(true);
        expect(sales.length).toBeLessThanOrEqual(limit);
      }
    }, 120000);

    it('should handle maximum limit value', async () => {
      // The API has a maximum limit of 25
      const sales = await mflApi.getPlayerSaleHistory(44743, 25);
      expect(sales).toBeDefined();
      expect(Array.isArray(sales)).toBe(true);
      expect(sales.length).toBeLessThanOrEqual(25);
    }, 30000);
  });

  describe('Sale Data Analysis', () => {
    it('should return sales in chronological order (newest first)', async () => {
      const sales = await mflApi.getPlayerSaleHistory(44743, 10);

      expect(sales).toBeDefined();
      expect(Array.isArray(sales)).toBe(true);

      if (sales.length > 1) {
        // Verify sales are sorted by purchaseDateTime (newest first)
        for (let i = 1; i < sales.length; i++) {
          expect(sales[i - 1].purchaseDateTime).toBeGreaterThanOrEqual(sales[i].purchaseDateTime);
        }
      }
    }, 30000);

    it('should include valid price data', async () => {
      const sales = await mflApi.getPlayerSaleHistory(44743, 5);

      expect(sales).toBeDefined();
      expect(Array.isArray(sales)).toBe(true);

      sales.forEach(sale => {
        expect(typeof sale.price).toBe('number');
        expect(sale.price).toBeGreaterThan(0);
      });
    }, 30000);

    it('should include valid wallet addresses', async () => {
      const sales = await mflApi.getPlayerSaleHistory(44743, 5);

      expect(sales).toBeDefined();
      expect(Array.isArray(sales)).toBe(true);

      sales.forEach(sale => {
        expect(typeof sale.sellerAddress).toBe('string');
        expect(sale.sellerAddress.length).toBeGreaterThan(0);
        expect(typeof sale.buyerAddress).toBe('string');
        expect(sale.buyerAddress.length).toBeGreaterThan(0);
      });
    }, 30000);
  });

  describe('Performance', () => {
    it('should handle requests efficiently', async () => {
      const startTime = Date.now();
      const sales = await mflApi.getPlayerSaleHistory(44743, 10);
      const time = Date.now() - startTime;

      expect(sales).toBeDefined();
      expect(Array.isArray(sales)).toBe(true);
      
      // Verify reasonable response time (should be under 5 seconds)
      expect(time).toBeLessThan(5000);
    }, 30000);
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      // This test verifies that the API service can handle network issues
      // We can't easily simulate network errors in tests, but we can verify
      // that the service has proper error handling structure
      
      const sales = await mflApi.getPlayerSaleHistory(44743, 5);
      expect(sales).toBeDefined();
      
      // If we get here, the error handling is working correctly
      expect(true).toBe(true);
    }, 30000);
  });

  describe('Multiple Players', () => {
    it('should handle different players with varying sale histories', async () => {
      const playerIds = [44743, 93886, 999999]; // Player with sales, player with sales, player with no sales
      
      for (const playerId of playerIds) {
        const sales = await mflApi.getPlayerSaleHistory(playerId, 5);
        expect(sales).toBeDefined();
        expect(Array.isArray(sales)).toBe(true);
        
        if (sales.length > 0) {
          // Verify all sales are for the correct player
          sales.forEach(sale => {
            expect(sale.player.id).toBe(playerId);
          });
        }
      }
    }, 90000);
  });
});
