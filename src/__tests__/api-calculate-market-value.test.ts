import { POST } from '../../app/api/calculate-market-value/[playerId]/route';
import { NextRequest } from 'next/server';

// Mock the market value service
jest.mock('../../../src/services/marketValueService');

describe('/api/calculate-market-value/[playerId]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should calculate market value successfully', async () => {
    const { getPlayerMarketValue } = require('../../../src/services/marketValueService');
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

    const request = new NextRequest('http://localhost:3000/api/calculate-market-value/116267', {
      method: 'POST',
      body: JSON.stringify({
        walletAddress: '0x95dc70d7d39f6f76',
        forceRecalculate: true
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const params = { playerId: '116267' };
    const response = await POST(request, { params: Promise.resolve(params) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.marketValue).toBe(194);
    expect(data.confidence).toBe('medium');
    expect(getPlayerMarketValue).toHaveBeenCalledWith('116267', '0x95dc70d7d39f6f76', true);
  });

  it('should handle player not found error', async () => {
    const { getPlayerMarketValue } = require('../../../src/services/marketValueService');
    getPlayerMarketValue.mockResolvedValue({
      success: false,
      error: 'Player not found'
    });

    const request = new NextRequest('http://localhost:3000/api/calculate-market-value/999999', {
      method: 'POST',
      body: JSON.stringify({
        walletAddress: '0x95dc70d7d39f6f76'
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const params = { playerId: '999999' };
    const response = await POST(request, { params: Promise.resolve(params) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Player not found');
  });

  it('should handle internal server error', async () => {
    const { getPlayerMarketValue } = require('../../../src/services/marketValueService');
    getPlayerMarketValue.mockResolvedValue({
      success: false,
      error: 'Internal server error'
    });

    const request = new NextRequest('http://localhost:3000/api/calculate-market-value/116267', {
      method: 'POST',
      body: JSON.stringify({
        walletAddress: '0x95dc70d7d39f6f76'
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const params = { playerId: '116267' };
    const response = await POST(request, { params: Promise.resolve(params) });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Internal server error');
  });

  it('should handle service throwing an error', async () => {
    const { getPlayerMarketValue } = require('../../../src/services/marketValueService');
    getPlayerMarketValue.mockRejectedValue(new Error('Service error'));

    const request = new NextRequest('http://localhost:3000/api/calculate-market-value/116267', {
      method: 'POST',
      body: JSON.stringify({
        walletAddress: '0x95dc70d7d39f6f76'
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const params = { playerId: '116267' };
    const response = await POST(request, { params: Promise.resolve(params) });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Internal server error');
  });

  it('should handle missing wallet address', async () => {
    const { getPlayerMarketValue } = require('../../../src/services/marketValueService');
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

    const request = new NextRequest('http://localhost:3000/api/calculate-market-value/116267', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const params = { playerId: '116267' };
    const response = await POST(request, { params: Promise.resolve(params) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(getPlayerMarketValue).toHaveBeenCalledWith('116267', undefined, false);
  });

  it('should handle forceRecalculate parameter', async () => {
    const { getPlayerMarketValue } = require('../../../src/services/marketValueService');
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

    const request = new NextRequest('http://localhost:3000/api/calculate-market-value/116267', {
      method: 'POST',
      body: JSON.stringify({
        walletAddress: '0x95dc70d7d39f6f76',
        forceRecalculate: true
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const params = { playerId: '116267' };
    const response = await POST(request, { params: Promise.resolve(params) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(getPlayerMarketValue).toHaveBeenCalledWith('116267', '0x95dc70d7d39f6f76', true);
  });
});
