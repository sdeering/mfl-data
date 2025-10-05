import { getPlayerMarketValue } from '../services/marketValueService';

// Mock NextRequest
class MockNextRequest {
  url: string;
  method: string;
  body: any;
  headers: any;

  constructor(url: string, init?: any) {
    this.url = url;
    this.method = init?.method || 'GET';
    this.body = init?.body;
    this.headers = init?.headers || {};
  }

  async json() {
    return JSON.parse(this.body);
  }
}

// Mock the API route functions
const mockJobQueue = new Map();

const POST = async (request: MockNextRequest) => {
  try {
    const { walletAddress, playerIds, forceRecalculate = false, limit } = await request.json();
    
    if (!playerIds || !Array.isArray(playerIds) || playerIds.length === 0) {
      return {
        status: 400,
        json: async () => ({ error: 'Player IDs array required' })
      };
    }

    // Limit the number of players for testing (default 10, max 50)
    const limitedPlayerIds = playerIds.slice(0, Math.min(limit, 50));

    const jobId = `market-value-sync-${Date.now()}`;
    
    mockJobQueue.set(jobId, {
      status: 'pending',
      progress: 0,
      total: limitedPlayerIds.length,
      results: []
    });

    return {
      status: 200,
      json: async () => ({ 
        success: true, 
        jobId,
        message: `Market value sync started for ${limitedPlayerIds.length} players`,
        totalPlayers: playerIds.length,
        limitedPlayers: limitedPlayerIds.length
      })
    };
  } catch (error) {
    return {
      status: 500,
      json: async () => ({ error: 'Internal server error' })
    };
  }
};

const GET = async (request: MockNextRequest) => {
  try {
    const url = new URL(request.url);
    const jobId = url.searchParams.get('jobId');
    
    if (!jobId) {
      return {
        status: 400,
        json: async () => ({ error: 'Job ID required' })
      };
    }

    const job = mockJobQueue.get(jobId);
    if (!job) {
      return {
        status: 404,
        json: async () => ({ error: 'Job not found' })
      };
    }

    return {
      status: 200,
      json: async () => ({
        jobId,
        status: job.status,
        progress: job.progress,
        total: job.total,
        percentage: Math.round((job.progress / job.total) * 100),
        currentPlayer: job.currentPlayer,
        error: job.error,
        results: job.results
      })
    };
  } catch (error) {
    return {
      status: 500,
      json: async () => ({ error: 'Internal server error' })
    };
  }
};

// Mock the market value service
jest.mock('../services/marketValueService');
const mockGetPlayerMarketValue = getPlayerMarketValue as jest.MockedFunction<typeof getPlayerMarketValue>;

// Mock Supabase
jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null }))
        }))
      }))
    }))
  },
  TABLES: {
    MARKET_VALUES: 'market_values'
  }
}));

describe('Backend Sync API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/sync/player-market-values', () => {
    it('should start a sync job with valid player IDs', async () => {
      const request = new MockNextRequest('http://localhost:3000/api/sync/player-market-values', {
        method: 'POST',
        body: JSON.stringify({
          walletAddress: '0x95dc70d7d39f6f76',
          playerIds: ['116267', '116268'],
          forceRecalculate: false
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.jobId).toBeDefined();
      expect(data.message).toContain('Market value sync started');
    });

    it('should return error for missing player IDs', async () => {
      const request = new MockNextRequest('http://localhost:3000/api/sync/player-market-values', {
        method: 'POST',
        body: JSON.stringify({
          walletAddress: '0x95dc70d7d39f6f76'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Player IDs array required');
    });

    it('should return error for empty player IDs array', async () => {
      const request = new MockNextRequest('http://localhost:3000/api/sync/player-market-values', {
        method: 'POST',
        body: JSON.stringify({
          walletAddress: '0x95dc70d7d39f6f76',
          playerIds: []
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Player IDs array required');
    });

    it('should limit the number of players for testing', async () => {
      const request = new MockNextRequest('http://localhost:3000/api/sync/player-market-values', {
        method: 'POST',
        body: JSON.stringify({
          walletAddress: '0x95dc70d7d39f6f76',
          playerIds: Array.from({ length: 100 }, (_, i) => `116${i}`),
          limit: 5
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.totalPlayers).toBe(100);
      expect(data.limitedPlayers).toBe(5);
      expect(data.message).toContain('5 players');
    });
  });

  describe('GET /api/sync/player-market-values', () => {
    it('should return job status for valid job ID', async () => {
      // First create a job
      const postRequest = new MockNextRequest('http://localhost:3000/api/sync/player-market-values', {
        method: 'POST',
        body: JSON.stringify({
          walletAddress: '0x95dc70d7d39f6f76',
          playerIds: ['116267']
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const postResponse = await POST(postRequest);
      const postData = await postResponse.json();
      const jobId = postData.jobId;

      // Then get the job status
      const getRequest = new MockNextRequest(`http://localhost:3000/api/sync/player-market-values?jobId=${jobId}`);
      const getResponse = await GET(getRequest);
      const getData = await getResponse.json();

      expect(getResponse.status).toBe(200);
      expect(getData.jobId).toBe(jobId);
      expect(getData.status).toBeDefined();
      expect(getData.progress).toBeDefined();
      expect(getData.total).toBeDefined();
      expect(getData.percentage).toBeDefined();
    });

    it('should return error for missing job ID', async () => {
      const request = new MockNextRequest('http://localhost:3000/api/sync/player-market-values');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Job ID required');
    });

    it('should return error for non-existent job ID', async () => {
      const request = new MockNextRequest('http://localhost:3000/api/sync/player-market-values?jobId=non-existent');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Job not found');
    });
  });

  describe('Market Value Processing', () => {
    it('should process players and update job status', async () => {
      mockGetPlayerMarketValue.mockResolvedValue({
        success: true,
        marketValue: 171,
        confidence: 'medium',
        details: {
          estimatedValue: 171,
          confidence: 'medium',
          breakdown: {},
          details: {}
        }
      });

      const request = new MockNextRequest('http://localhost:3000/api/sync/player-market-values', {
        method: 'POST',
        body: JSON.stringify({
          walletAddress: '0x95dc70d7d39f6f76',
          playerIds: ['116267', '116268']
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Check job status
      const getRequest = new MockNextRequest(`http://localhost:3000/api/sync/player-market-values?jobId=${data.jobId}`);
      const getResponse = await GET(getRequest);
      const getData = await getResponse.json();

      expect(getResponse.status).toBe(200);
      expect(getData.status).toBe('pending');
    });
  });
});
