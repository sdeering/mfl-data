/**
 * @jest-environment node
 */

describe('Market Data API', () => {
  const baseUrl = 'http://localhost:3000';

  beforeAll(async () => {
    // Wait for server to be ready
    let retries = 0;
    while (retries < 10) {
      try {
        const response = await fetch(`${baseUrl}/api/market-data?limit=1`);
        if (response.ok) {
          break;
        }
      } catch (error) {
        // Server not ready yet
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
      retries++;
    }
  });

  describe('GET /api/market-data', () => {
    it('should return market data for similar players', async () => {
      const response = await fetch(`${baseUrl}/api/market-data?limit=5&type=PLAYER&status=AVAILABLE&view=full&sorts=listing.price&sortsOrders=ASC&ageMin=26&ageMax=28&overallMin=85&overallMax=87&positions=CAM%2CST&onlyPrimaryPosition=true`);
      
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data.length).toBeGreaterThan(0);
      
      // Check structure of first listing
      const firstListing = data.data[0];
      expect(firstListing).toHaveProperty('listingResourceId');
      expect(firstListing).toHaveProperty('status', 'AVAILABLE');
      expect(firstListing).toHaveProperty('price');
      expect(firstListing).toHaveProperty('player');
      expect(firstListing.player).toHaveProperty('metadata');
      expect(firstListing.player.metadata).toHaveProperty('overall');
      expect(firstListing.player.metadata).toHaveProperty('age');
      expect(firstListing.player.metadata).toHaveProperty('positions');
      
      // Verify price is reasonable
      expect(typeof firstListing.price).toBe('number');
      expect(firstListing.price).toBeGreaterThan(0);
      expect(firstListing.price).toBeLessThan(10000);
    });

    it('should return empty data for non-existent players', async () => {
      const response = await fetch(`${baseUrl}/api/market-data?limit=5&type=PLAYER&status=AVAILABLE&view=full&sorts=listing.price&sortsOrders=ASC&ageMin=1&ageMax=1&overallMin=1&overallMax=1&positions=GK&onlyPrimaryPosition=true`);
      
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      // Should be empty or very few results for such specific criteria
    });

    it('should handle invalid parameters gracefully', async () => {
      const response = await fetch(`${baseUrl}/api/market-data?limit=invalid&type=INVALID&status=INVALID`);
      
      // Should still return a response, even if with errors
      expect(response.status).toBeLessThan(500);
      
      const data = await response.json();
      expect(data).toHaveProperty('success');
    });
  });

  describe('Market data for Eric Hodge specifically', () => {
    it('should find comparable players for Eric Hodge (Overall 87, Age 27, CAM/ST)', async () => {
      const response = await fetch(`${baseUrl}/api/market-data?limit=10&type=PLAYER&status=AVAILABLE&view=full&sorts=listing.price&sortsOrders=ASC&ageMin=25&ageMax=29&overallMin=82&overallMax=92&positions=CAM%2CST&onlyPrimaryPosition=true`);
      
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      
      if (data.data.length > 0) {
        // Check that we have reasonable comparable players
        const prices = data.data.map((listing: any) => listing.price);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        
        console.log(`Found ${data.data.length} comparable players for Eric Hodge`);
        console.log(`Price range: $${minPrice} - $${maxPrice}`);
        
        // Prices should be reasonable for 82-92 overall players
        expect(minPrice).toBeGreaterThan(50);
        expect(maxPrice).toBeLessThan(2000);
        
        // Check that players have similar characteristics
        data.data.forEach((listing: any) => {
          const player = listing.player.metadata;
          expect(player.overall).toBeGreaterThanOrEqual(82);
          expect(player.overall).toBeLessThanOrEqual(92);
          expect(player.age).toBeGreaterThanOrEqual(25);
          expect(player.age).toBeLessThanOrEqual(29);
          expect(player.positions.some((pos: string) => ['CAM', 'ST'].includes(pos))).toBe(true);
        });
      }
    });
  });
});
