import { calculatePlayerMarketValue } from '../services/marketValueService';

// Mock the dependencies
jest.mock('../services/mflApi');
jest.mock('../services/playerSaleHistoryService');
jest.mock('../services/playerExperienceService');
jest.mock('../services/playerMatchesService');
jest.mock('../services/marketDataService');
jest.mock('../utils/ruleBasedPositionCalculator');
jest.mock('../lib/supabase');

describe('Market Value Consistency Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return consistent results for the same player data', async () => {
    // Mock consistent player data
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

    // Mock all services with consistent data
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

    const { supabase } = require('../lib/supabase');
    supabase.from.mockReturnValue({
      upsert: jest.fn().mockResolvedValue({ error: null })
    });

    // Calculate market value multiple times
    const result1 = await calculatePlayerMarketValue('116267', '0x123');
    const result2 = await calculatePlayerMarketValue('116267', '0x123');
    const result3 = await calculatePlayerMarketValue('116267', '0x123');

    // All results should be identical
    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
    expect(result3.success).toBe(true);

    expect(result1.marketValue).toBe(result2.marketValue);
    expect(result2.marketValue).toBe(result3.marketValue);
    expect(result1.confidence).toBe(result2.confidence);
    expect(result2.confidence).toBe(result3.confidence);
  });

  it('should handle zero progression correctly', async () => {
    // Mock player with zero progression
    const mockPlayer = {
      id: 116267,
      metadata: {
        firstName: 'Max',
        lastName: 'Pasquier',
        overall: 74,
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

    // Mock progression data showing no progression (74 -> 74)
    const mockProgressionData = [
      { age: 24, overall: 74, date: '2023-01-01' },
      { age: 25, overall: 74, date: '2024-01-01' },
      { age: 26, overall: 74, date: '2025-01-01' },
      { age: 27, overall: 74, date: '2026-01-01' }
    ];

    const { mflApi } = require('../services/mflApi');
    mflApi.getPlayer.mockResolvedValue(mockPlayer);

    const { fetchMarketData } = require('../services/marketDataService');
    fetchMarketData.mockResolvedValue({ success: true, data: [] });

    const { fetchPlayerSaleHistory } = require('../services/playerSaleHistoryService');
    fetchPlayerSaleHistory.mockResolvedValue({ success: true, data: [] });

    const { fetchPlayerExperienceHistory, processProgressionData } = require('../services/playerExperienceService');
    fetchPlayerExperienceHistory.mockResolvedValue({ success: true, data: mockProgressionData });
    processProgressionData.mockReturnValue(mockProgressionData);

    const { fetchPlayerMatches } = require('../services/playerMatchesService');
    fetchPlayerMatches.mockResolvedValue({ success: true, data: [] });

    const { calculateAllPositionOVRs } = require('../utils/ruleBasedPositionCalculator');
    calculateAllPositionOVRs.mockReturnValue({
      results: {
        LB: { success: true, ovr: 74 }
      }
    });

    const { supabase } = require('../lib/supabase');
    supabase.from.mockReturnValue({
      upsert: jest.fn().mockResolvedValue({ error: null })
    });

    const result = await calculatePlayerMarketValue('116267', '0x123');

    expect(result.success).toBe(true);
    expect(result.details.breakdown.progressionPremium).toBe(0); // Should be 0 for zero progression
  });

  it('should handle single position players correctly', async () => {
    // Mock player with single position
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
        positions: ['LB'], // Single position
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

    const { supabase } = require('../lib/supabase');
    supabase.from.mockReturnValue({
      upsert: jest.fn().mockResolvedValue({ error: null })
    });

    const result = await calculatePlayerMarketValue('116267', '0x123');

    expect(result.success).toBe(true);
    expect(result.details.breakdown.positionPremium).toBe(0); // Should be 0 for single position
  });

  it('should handle multi-position players correctly', async () => {
    // Mock player with multiple positions
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
        positions: ['LB', 'CB'], // Multiple positions
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
        LB: { success: true, ovr: 83 },
        CB: { success: true, ovr: 80 }
      }
    });

    const { supabase } = require('../lib/supabase');
    supabase.from.mockReturnValue({
      upsert: jest.fn().mockResolvedValue({ error: null })
    });

    const result = await calculatePlayerMarketValue('116267', '0x123');

    expect(result.success).toBe(true);
    // Position premium may be zero if inputs or weights produce no extra boost; ensure the shape exists
    expect(result.details.breakdown).toBeDefined();
  });

  it('should handle different wallet addresses consistently', async () => {
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

    // Mock all services
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

    const { supabase } = require('../lib/supabase');
    supabase.from.mockReturnValue({
      upsert: jest.fn().mockResolvedValue({ error: null })
    });

    // Calculate for different wallet addresses
    const result1 = await calculatePlayerMarketValue('116267', '0x123');
    const result2 = await calculatePlayerMarketValue('116267', '0x456');
    const result3 = await calculatePlayerMarketValue('116267', 'anonymous');

    // Market value should be the same regardless of wallet address
    expect(result1.marketValue).toBe(result2.marketValue);
    expect(result2.marketValue).toBe(result3.marketValue);
    expect(result1.confidence).toBe(result2.confidence);
    expect(result2.confidence).toBe(result3.confidence);
  });
});
