import { calculateMarketValue } from '../utils/marketValueCalculator';
import { fetchMarketData } from '../services/marketDataService';

// Mock the market data service
jest.mock('../services/marketDataService');
const mockFetchMarketData = fetchMarketData as jest.MockedFunction<typeof fetchMarketData>;

describe('Market Value Calculation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('with real market data', () => {
    it('should calculate market value using real market data for Eric Hodge', async () => {
      // Mock real market data similar to what we saw in the API
      const mockMarketData = {
        success: true,
        data: [
          {
            listingResourceId: 26388281127393,
            status: "AVAILABLE",
            price: 295,
            player: {
              id: 1475,
              metadata: {
                id: 1481,
                firstName: "Sebastian",
                lastName: "Marczewski",
                overall: 86,
                age: 27,
                positions: ["ST"]
              }
            }
          },
          {
            listingResourceId: 123456789,
            status: "AVAILABLE", 
            price: 350,
            player: {
              id: 9999,
              metadata: {
                id: 9999,
                firstName: "Test",
                lastName: "Player",
                overall: 87,
                age: 27,
                positions: ["CAM"]
              }
            }
          }
        ]
      };

      mockFetchMarketData.mockResolvedValue(mockMarketData);

      // Eric Hodge's data
      const player = {
        id: 93886,
        firstName: 'Eric',
        lastName: 'Hodge',
        overall: 87,
        age: 27,
        positions: ['CAM', 'ST'],
        pace: 85,
        shooting: 89,
        passing: 71,
        dribbling: 87,
        defense: 40,
        physical: 79,
        goalkeeping: 0
      };

      const result = await calculateMarketValue(player);

      expect(result.success).toBe(true);
      expect(result.estimatedValue).toBeGreaterThan(0);
      expect(result.estimatedValue).toBeLessThan(1000); // Should be reasonable
      expect(result.confidence).toBe('high');
      expect(result.details.comparableListings.length).toBeGreaterThan(0);
      expect(result.details.comparableAverage).toBeGreaterThan(0);
    });

    it('should return N/A when no market data is available', async () => {
      // Mock no market data
      const mockMarketData = {
        success: true,
        data: []
      };

      mockFetchMarketData.mockResolvedValue(mockMarketData);

      const player = {
        id: 12345,
        firstName: 'Test',
        lastName: 'Player',
        overall: 75,
        age: 25,
        positions: ['CB'],
        pace: 70,
        shooting: 30,
        passing: 60,
        dribbling: 50,
        defense: 85,
        physical: 80,
        goalkeeping: 0
      };

      const result = await calculateMarketValue(player);

      expect(result.success).toBe(true);
      expect(result.estimatedValue).toBe('N/A');
      expect(result.confidence).toBe('low');
    });

    it('should handle market data API failures gracefully', async () => {
      // Mock API failure
      const mockMarketData = {
        success: false,
        data: [],
        error: 'API unavailable'
      };

      mockFetchMarketData.mockResolvedValue(mockMarketData);

      const player = {
        id: 12345,
        firstName: 'Test',
        lastName: 'Player',
        overall: 80,
        age: 26,
        positions: ['CM'],
        pace: 75,
        shooting: 60,
        passing: 80,
        dribbling: 70,
        defense: 70,
        physical: 75,
        goalkeeping: 0
      };

      const result = await calculateMarketValue(player);

      expect(result.success).toBe(true);
      expect(result.estimatedValue).toBe('N/A');
      expect(result.confidence).toBe('low');
    });
  });

  describe('market data service integration', () => {
    it('should call market data service with correct parameters', async () => {
      const mockMarketData = {
        success: true,
        data: [
          {
            listingResourceId: 123,
            status: "AVAILABLE",
            price: 300,
            player: {
              id: 456,
              metadata: {
                id: 456,
                firstName: "Test",
                lastName: "Player",
                overall: 85,
                age: 26,
                positions: ["ST"]
              }
            }
          }
        ]
      };

      mockFetchMarketData.mockResolvedValue(mockMarketData);

      const player = {
        id: 93886,
        firstName: 'Eric',
        lastName: 'Hodge',
        overall: 87,
        age: 27,
        positions: ['CAM', 'ST'],
        pace: 85,
        shooting: 89,
        passing: 71,
        dribbling: 87,
        defense: 40,
        physical: 79,
        goalkeeping: 0
      };

      await calculateMarketValue(player);

      expect(mockFetchMarketData).toHaveBeenCalledWith({
        positions: ['CAM', 'ST'],
        ageMin: 25, // 27 - 2
        ageMax: 29, // 27 + 2
        overallMin: 82, // 87 - 5
        overallMax: 92, // 87 + 5
        limit: 20
      });
    });
  });

  describe('market value ranges', () => {
    it('should return reasonable market values for different overall ratings', async () => {
      const testCases = [
        { overall: 90, expectedRange: [800, 1300] },
        { overall: 85, expectedRange: [400, 800] },
        { overall: 80, expectedRange: [200, 400] },
        { overall: 75, expectedRange: [100, 200] }
      ];

      for (const testCase of testCases) {
        const mockMarketData = {
          success: true,
          data: [
            {
              listingResourceId: 123,
              status: "AVAILABLE",
              price: testCase.expectedRange[0] + 50, // Mid-range price
              player: {
                id: 456,
                metadata: {
                  id: 456,
                  firstName: "Test",
                  lastName: "Player",
                  overall: testCase.overall,
                  age: 26,
                  positions: ["ST"]
                }
              }
            }
          ]
        };

        mockFetchMarketData.mockResolvedValue(mockMarketData);

        const player = {
          id: 12345,
          firstName: 'Test',
          lastName: 'Player',
          overall: testCase.overall,
          age: 26,
          positions: ['ST'],
          pace: 80,
          shooting: 80,
          passing: 80,
          dribbling: 80,
          defense: 80,
          physical: 80,
          goalkeeping: 0
        };

        const result = await calculateMarketValue(player);

        expect(result.success).toBe(true);
        expect(typeof result.estimatedValue).toBe('number');
        expect(result.estimatedValue).toBeGreaterThanOrEqual(testCase.expectedRange[0] * 0.8); // Allow 20% variance
        expect(result.estimatedValue).toBeLessThanOrEqual(testCase.expectedRange[1] * 1.2); // Allow 20% variance
      }
    });
  });
});
