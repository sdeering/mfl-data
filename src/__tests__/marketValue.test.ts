import { calculateMarketValue } from '../utils/marketValueCalculator';
import type { MarketListing } from '../services/marketDataService';
import type { PlayerSaleHistoryEntry } from '../types/playerSaleHistory';
import type { MFLPlayerMetadata } from '../types/mflApi';

describe('Market Value Calculation', () => {
  const mockPlayer: MFLPlayerMetadata = {
    id: 12345,
    firstName: 'Test',
    lastName: 'Player',
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

  const mockMarketListings: MarketListing[] = [
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
          positions: ['CAM', 'ST'],
          pace: 85,
          shooting: 89,
          passing: 71,
          dribbling: 87,
          defense: 40,
          physical: 79,
          goalkeeping: 0
        }
      }
    },
    {
      listingResourceId: 26388281127394,
      status: "AVAILABLE",
      price: 320,
      player: {
        id: 1476,
        metadata: {
          id: 1482,
          firstName: "Another",
          lastName: "Player",
          overall: 88,
          age: 26,
          positions: ['CAM', 'ST'],
          pace: 87,
          shooting: 91,
          passing: 73,
          dribbling: 89,
          defense: 42,
          physical: 81,
          goalkeeping: 0
        }
      }
    }
  ];

  const mockRecentSales: PlayerSaleHistoryEntry[] = [
    {
      id: 1,
      playerId: 12345,
      price: 300,
      timestamp: new Date().toISOString(),
      buyerWallet: '0x123',
      sellerWallet: '0x456'
    }
  ];

  describe('with market data', () => {
    it('should calculate market value using comparable listings', () => {
      const result = calculateMarketValue(mockPlayer, mockMarketListings, mockRecentSales, []);

      expect(result.estimatedValue).toBeGreaterThan(0);
      expect(result.confidence).toBe('low');
      expect(result.details.comparableListings.length).toBe(2);
      expect(result.details.comparableAverage).toBeGreaterThan(0);
      expect(result.breakdown.comparableListings).toBe(2);
    });

    it('should return low confidence when no market data is available', () => {
      const result = calculateMarketValue(mockPlayer, [], [], []);

      expect(result.estimatedValue).toBe(0); // Should return 0 for insufficient data
      expect(result.confidence).toBe('unknown');
      expect(result.details.comparableListings.length).toBe(0);
    });

    it('should handle progression data', () => {
      const progressionData = [
        {
          timestamp: new Date().toISOString(),
          overall: 85,
          pace: 84,
          shooting: 88,
          passing: 70,
          dribbling: 86,
          defense: 39,
          physical: 78
        }
      ];

      const result = calculateMarketValue(mockPlayer, mockMarketListings, mockRecentSales, progressionData);

      expect(result.estimatedValue).toBeGreaterThan(0);
      expect(result.breakdown.progressionPremium).toBeDefined();
    });

    it('should apply position ratings when provided', () => {
      const positionRatings = {
        'CAM': 87,
        'ST': 89
      };

      const result = calculateMarketValue(mockPlayer, mockMarketListings, mockRecentSales, [], positionRatings);

      expect(result.estimatedValue).toBeGreaterThan(0);
      expect(result.breakdown.positionPremium).toBeDefined();
    });

    it('should handle retirement penalty', () => {
      const result = calculateMarketValue(mockPlayer, mockMarketListings, mockRecentSales, [], undefined, 2);

      expect(result.estimatedValue).toBeGreaterThan(0);
      expect(result.breakdown.retirementPenalty).toBeDefined();
    });
  });

  describe('market value ranges', () => {
    it('should return reasonable market values for different overall ratings', () => {
      const lowRatedPlayer = { ...mockPlayer, overall: 70 };
      const highRatedPlayer = { ...mockPlayer, overall: 95 };

      const lowResult = calculateMarketValue(lowRatedPlayer, mockMarketListings, mockRecentSales, []);
      const highResult = calculateMarketValue(highRatedPlayer, mockMarketListings, mockRecentSales, []);

      expect(lowResult.estimatedValue).toBeGreaterThan(0);
      expect(highResult.estimatedValue).toBeGreaterThan(0);
      expect(highResult.estimatedValue).toBeGreaterThan(lowResult.estimatedValue);
    });
  });
});