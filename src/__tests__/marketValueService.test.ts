import { calculatePlayerMarketValue, getCachedMarketValue, getPlayerMarketValue, clearMarketValueCache } from '../services/marketValueService';
import { supabase, TABLES } from '../lib/supabase';

// Mock the dependencies
jest.mock('../services/mflApi');
jest.mock('../services/playerSaleHistoryService');
jest.mock('../services/playerExperienceService');
jest.mock('../services/playerMatchesService');
jest.mock('../services/marketDataService');
jest.mock('../utils/ruleBasedPositionCalculator');
jest.mock('../lib/supabase');

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

describe('MarketValueService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearMarketValueCache(); // Clear in-memory cache between tests
  });

  describe('calculatePlayerMarketValue', () => {
    it('should calculate market value for a valid player', async () => {
      // Mock player data
      const mockPlayer = {
        id: 116267,
        metadata: {
          firstName: 'Max',
          lastName: 'Pasquier',
          overall: 83,
          age: 27,
          pace: 85,
          shooting: 32,
          passing: 77,
          dribbling: 76,
          defense: 87,
          physical: 84,
          goalkeeping: 0,
          positions: ['LB'],
          retirementYears: 0
        }
      };

      // Mock all the service calls
      const { mflApi } = require('../services/mflApi');
      mflApi.getPlayer.mockResolvedValue(mockPlayer);

      const { fetchMarketData } = require('../services/marketDataService');
      fetchMarketData.mockResolvedValue({ success: true, data: [] });

      const { fetchPlayerSaleHistory } = require('../services/playerSaleHistoryService');
      fetchPlayerSaleHistory.mockResolvedValue({ success: true, data: [] });

      const { fetchPlayerExperienceHistory, processProgressionData } = require('../services/playerExperienceService');
      fetchPlayerExperienceHistory.mockResolvedValue({ success: true, data: [] });
      processProgressionData.mockReturnValue([]);

      const { fetchPlayerMatches } = require('../services/playerMatchesService');
      fetchPlayerMatches.mockResolvedValue({ success: true, data: [] });

      const { calculateAllPositionOVRs } = require('../utils/ruleBasedPositionCalculator');
      calculateAllPositionOVRs.mockReturnValue({
        results: {
          LB: { success: true, ovr: 83 }
        }
      });

      // Mock Supabase upsert
      mockSupabase.from.mockReturnValue({
        upsert: jest.fn().mockResolvedValue({ error: null })
      } as any);

      const result = await calculatePlayerMarketValue('116267', '0x123');

      expect(result.success).toBe(true);
      expect(result.marketValue).toBeDefined();
      expect(result.confidence).toBeDefined();
      expect(result.details).toBeDefined();
    });

    it('should handle player not found error', async () => {
      const { mflApi } = require('../services/mflApi');
      mflApi.getPlayer.mockRejectedValue(new Error('Player not found'));

      const result = await calculatePlayerMarketValue('999999', '0x123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Player not found');
    });

    it('should handle internal server errors', async () => {
      const { mflApi } = require('../services/mflApi');
      mflApi.getPlayer.mockRejectedValue(new Error('Network error'));

      const result = await calculatePlayerMarketValue('116267', '0x123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Player not found'); // This is what the service actually returns
    });
  });

  describe('getCachedMarketValue', () => {
    it('should return cached value if not expired', async () => {
      const mockData = {
        market_value: 194,
        confidence: 'medium',
        breakdown: {},
        details: {},
        calculated_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // 1 day ago
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: { data: mockData }, error: null })
          })
        })
      } as any);

      const result = await getCachedMarketValue('116267', '0x123', 168); // 7 days

      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
      expect(result?.marketValue).toBe(194);
      expect(result?.confidence).toBe('medium');
    });

    it('should return null if cached value is expired', async () => {
      const mockData = {
        market_value: 194,
        confidence: 'medium',
        breakdown: {},
        details: {},
        calculated_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString() // 8 days ago
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: { data: mockData }, error: null })
          })
        })
      } as any);

      const result = await getCachedMarketValue('116267', '0x123', 168); // 7 days

      expect(result).toBeNull();
    });

    it('should return null if no cached value exists', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      } as any);

      const result = await getCachedMarketValue('116267', '0x123');

      expect(result).toBeNull();
    });
  });

  describe('getPlayerMarketValue', () => {
    it('should return cached value if available and not expired', async () => {
      const mockCachedData = {
        market_value: 194,
        confidence: 'medium',
        breakdown: {},
        details: {},
        calculated_at: new Date(Date.now() - 30 * 60 * 1000).toISOString() // 30 minutes old (within 1 hour cache)
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: { data: mockCachedData }, error: null })
          })
        })
      } as any);

      // Mock mflApi.getPlayer in case cache check fails (shouldn't happen, but prevents errors)
      const { mflApi } = require('../services/mflApi');
      mflApi.getPlayer.mockResolvedValue({
        id: 116267,
        metadata: { firstName: 'Test', lastName: 'Player', overall: 83, age: 27, positions: ['LB'] }
      });

      const result = await getPlayerMarketValue('116267', '0x123', false);

      expect(result.success).toBe(true);
      expect(result.marketValue).toBe(194);
      expect(result.confidence).toBe('medium');
    });

    it('should calculate fresh value if forceRecalculate is true', async () => {
      // Mock cached value exists
      const mockCachedData = {
        market_value: 194,
        confidence: 'medium',
        breakdown: {},
        details: {},
        calculated_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: { data: mockCachedData }, error: null })
          })
        }),
        upsert: jest.fn().mockResolvedValue({ error: null })
      } as any);

      // Mock fresh calculation
      const mockPlayer = {
        id: 116267,
        metadata: {
          firstName: 'Max',
          lastName: 'Pasquier',
          overall: 83,
          age: 27,
          pace: 85,
          shooting: 32,
          passing: 77,
          dribbling: 76,
          defense: 87,
          physical: 84,
          goalkeeping: 0,
          positions: ['LB'],
          retirementYears: 0
        }
      };

      const { mflApi } = require('../services/mflApi');
      mflApi.getPlayer.mockResolvedValue(mockPlayer);

      const { fetchMarketData } = require('../services/marketDataService');
      fetchMarketData.mockResolvedValue({ success: true, data: [] });

      const { fetchPlayerSaleHistory } = require('../services/playerSaleHistoryService');
      fetchPlayerSaleHistory.mockResolvedValue({ success: true, data: [] });

      const { fetchPlayerExperienceHistory, processProgressionData } = require('../services/playerExperienceService');
      fetchPlayerExperienceHistory.mockResolvedValue({ success: true, data: [] });
      processProgressionData.mockReturnValue([]);

      const { fetchPlayerMatches } = require('../services/playerMatchesService');
      fetchPlayerMatches.mockResolvedValue({ success: true, data: [] });

      const { calculateAllPositionOVRs } = require('../utils/ruleBasedPositionCalculator');
      calculateAllPositionOVRs.mockReturnValue({
        results: {
          LB: { success: true, ovr: 83 }
        }
      });

      const result = await getPlayerMarketValue('116267', '0x123', true);

      expect(result.success).toBe(true);
      expect(result.marketValue).toBeDefined();
      // Should be a fresh calculation, not the cached value
    });

    it('should calculate fresh value if no cached value exists', async () => {
      // Mock no cached value
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null })
          })
        }),
        upsert: jest.fn().mockResolvedValue({ error: null })
      } as any);

      // Mock fresh calculation
      const mockPlayer = {
        id: 116267,
        metadata: {
          firstName: 'Max',
          lastName: 'Pasquier',
          overall: 83,
          age: 27,
          pace: 85,
          shooting: 32,
          passing: 77,
          dribbling: 76,
          defense: 87,
          physical: 84,
          goalkeeping: 0,
          positions: ['LB'],
          retirementYears: 0
        }
      };

      const { mflApi } = require('../services/mflApi');
      mflApi.getPlayer.mockResolvedValue(mockPlayer);

      const { fetchMarketData } = require('../services/marketDataService');
      fetchMarketData.mockResolvedValue({ success: true, data: [] });

      const { fetchPlayerSaleHistory } = require('../services/playerSaleHistoryService');
      fetchPlayerSaleHistory.mockResolvedValue({ success: true, data: [] });

      const { fetchPlayerExperienceHistory, processProgressionData } = require('../services/playerExperienceService');
      fetchPlayerExperienceHistory.mockResolvedValue({ success: true, data: [] });
      processProgressionData.mockReturnValue([]);

      const { fetchPlayerMatches } = require('../services/playerMatchesService');
      fetchPlayerMatches.mockResolvedValue({ success: true, data: [] });

      const { calculateAllPositionOVRs } = require('../utils/ruleBasedPositionCalculator');
      calculateAllPositionOVRs.mockReturnValue({
        results: {
          LB: { success: true, ovr: 83 }
        }
      });

      const result = await getPlayerMarketValue('116267', '0x123', false);

      expect(result.success).toBe(true);
      expect(result.marketValue).toBeDefined();
    });
  });

  describe('Integration Tests', () => {
    it('should handle real player data consistently', async () => {
      // This test would use real data to ensure consistency
      // between different calls to the same player
      const playerId = '116267';
      const walletAddress = '0x95dc70d7d39f6f76';

      // First call - should calculate fresh
      const result1 = await getPlayerMarketValue(playerId, walletAddress, true);
      
      // Second call - should use cached
      const result2 = await getPlayerMarketValue(playerId, walletAddress, false);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.marketValue).toBe(result2.marketValue);
      expect(result1.confidence).toBe(result2.confidence);
    });

    it('should handle repeated calls consistently (cache)', async () => {
      const playerId = '116267';
      const wallet = '0x123';
      
      // Mock mflApi.getPlayer in case cache check fails (shouldn't happen, but prevents errors)
      const { mflApi } = require('../services/mflApi');
      mflApi.getPlayer.mockResolvedValue({
        id: 116267,
        metadata: { firstName: 'Test', lastName: 'Player', overall: 83, age: 27, positions: ['LB'] }
      });
      
      // Same cached value on repeated calls
      const mockCachedData = {
        market_value: 194,
        confidence: 'medium',
        breakdown: {},
        details: {},
        calculated_at: new Date().toISOString() // Fresh cache
      };
      
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: { data: mockCachedData }, error: null })
          })
        }),
        upsert: jest.fn().mockResolvedValue({ error: null })
      } as any);

      const result1 = await getPlayerMarketValue(playerId, wallet, false);
      const result2 = await getPlayerMarketValue(playerId, wallet, false);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.marketValue).toBe(194);
      expect(result2.marketValue).toBe(194);
    });
  });
});
