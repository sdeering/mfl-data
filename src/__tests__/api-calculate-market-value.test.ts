jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: any, init?: any) => ({
      status: init?.status ?? 200,
      json: async () => data,
    }),
  },
}));

import { POST } from '../../app/api/calculate-market-value/[playerId]/route';

// Mock the market value service
jest.mock('../services/marketValueService', () => ({
  getPlayerMarketValue: jest.fn(),
  getCachedMarketValue: jest.fn(),
}));

describe('/api/calculate-market-value/[playerId]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should calculate market value successfully', async () => {
    const { getPlayerMarketValue } = require('../services/marketValueService');
    getPlayerMarketValue.mockResolvedValue({
      success: true,
      marketValue: 194,
      confidence: 'medium',
      details: {
        market_value: 194,
        confidence: 'medium',
        breakdown: {},
        details: {}
      }
    });

    const request: any = {
      json: async () => ({ walletAddress: '0x95dc70d7d39f6f76', forceRecalculate: true }),
    };

    const params = { playerId: '116267' };
    const response = await POST(request, { params: Promise.resolve(params) } as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.marketValue).toBe(194);
    expect(data.confidence).toBe('medium');
    expect(getPlayerMarketValue).toHaveBeenCalledWith('116267', '0x95dc70d7d39f6f76', true);
  });

  it('should handle player not found error', async () => {
    const { getPlayerMarketValue } = require('../services/marketValueService');
    getPlayerMarketValue.mockResolvedValue({
      success: false,
      error: 'Player not found'
    });

    const request: any = { json: async () => ({ walletAddress: '0x95dc70d7d39f6f76' }) };

    const params = { playerId: '999999' };
    const response = await POST(request, { params: Promise.resolve(params) } as any);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Player not found');
  });

  it('should handle internal server error', async () => {
    const { getPlayerMarketValue } = require('../services/marketValueService');
    getPlayerMarketValue.mockResolvedValue({
      success: false,
      error: 'Internal server error'
    });

    const request: any = { json: async () => ({ walletAddress: '0x95dc70d7d39f6f76' }) };

    const params = { playerId: '116267' };
    const response = await POST(request, { params: Promise.resolve(params) } as any);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Internal server error');
  });

  it('should handle service throwing an error', async () => {
    const { getPlayerMarketValue } = require('../services/marketValueService');
    getPlayerMarketValue.mockRejectedValue(new Error('Service error'));

    const request: any = { json: async () => ({ walletAddress: '0x95dc70d7d39f6f76' }) };

    const params = { playerId: '116267' };
    const response = await POST(request, { params: Promise.resolve(params) } as any);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Internal server error');
  });

  it('should handle missing wallet address', async () => {
    const { getPlayerMarketValue } = require('../services/marketValueService');
    getPlayerMarketValue.mockResolvedValue({
      success: true,
      marketValue: 194,
      confidence: 'medium',
      details: {
        market_value: 194,
        confidence: 'medium',
        breakdown: {},
        details: {}
      }
    });

    const request: any = { json: async () => ({}) };

    const params = { playerId: '116267' };
    const response = await POST(request, { params: Promise.resolve(params) } as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(getPlayerMarketValue).toHaveBeenCalledWith('116267', undefined, false);
  });

  it('should handle forceRecalculate parameter', async () => {
    const { getPlayerMarketValue } = require('../services/marketValueService');
    getPlayerMarketValue.mockResolvedValue({
      success: true,
      marketValue: 194,
      confidence: 'medium',
      details: {
        market_value: 194,
        confidence: 'medium',
        breakdown: {},
        details: {}
      }
    });

    const request: any = { json: async () => ({ walletAddress: '0x95dc70d7d39f6f76', forceRecalculate: true }) };

    const params = { playerId: '116267' };
    const response = await POST(request, { params: Promise.resolve(params) } as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(getPlayerMarketValue).toHaveBeenCalledWith('116267', '0x95dc70d7d39f6f76', true);
  });
});
