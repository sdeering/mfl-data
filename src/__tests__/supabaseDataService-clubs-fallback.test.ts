import { supabaseDataService } from '../services/dataService';
import * as dbHelpers from '../lib/db-helpers';

// Mock the db-helpers module
jest.mock('../lib/db-helpers', () => ({
  selectAll: jest.fn(),
  selectOne: jest.fn(),
  selectMaybeOne: jest.fn(),
  upsertOne: jest.fn(),
  upsertMany: jest.fn(),
  insertOne: jest.fn(),
  updateWhere: jest.fn(),
  deleteWhere: jest.fn(),
  countWhere: jest.fn(),
  selectWithJoin: jest.fn(),
  executeRaw: jest.fn(),
  incrementApiUsage: jest.fn(),
  getApiUsage: jest.fn(),
}));

// Mock the cache service
jest.mock('../services/cacheService', () => ({
  cacheService: {
    get: jest.fn(),
    set: jest.fn()
  }
}));

const mockSelectAll = dbHelpers.selectAll as jest.MockedFunction<typeof dbHelpers.selectAll>;

describe('dataService.getClubsForWallet', () => {
  const mockWalletAddress = '0x95dc70d7d39f6f76';
  const mockClubsData = [
    {
      id: '1',
      mfl_club_id: 28,
      data: { club: { name: 'Test Club 1' } },
      last_synced: '2024-01-15T10:00:00Z'
    },
    {
      id: '2',
      mfl_club_id: 1032,
      data: { club: { name: 'Test Club 2' } },
      last_synced: '2024-01-15T09:00:00Z'
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear any cached data
    supabaseDataService.clearCache(`clubs_${mockWalletAddress}`);
  });

  it('should successfully fetch clubs for a wallet address', async () => {
    mockSelectAll.mockResolvedValue({
      data: mockClubsData,
      error: null
    });

    const result = await supabaseDataService.getClubsForWallet(mockWalletAddress);

    expect(result).toEqual(mockClubsData);
    expect(mockSelectAll).toHaveBeenCalledWith(
      'clubs',
      expect.objectContaining({
        where: { wallet_address: mockWalletAddress },
        orderBy: { column: 'last_synced', ascending: false }
      })
    );
  });

  it('should throw error on database error', async () => {
    const dbError = {
      code: '42P01',
      message: 'relation "clubs" does not exist',
    };

    mockSelectAll.mockResolvedValue({
      data: null,
      error: dbError
    });

    await expect(supabaseDataService.getClubsForWallet(mockWalletAddress))
      .rejects.toEqual(dbError);
  });

  it('should return empty array when no clubs found', async () => {
    mockSelectAll.mockResolvedValue({
      data: [],
      error: null
    });

    const result = await supabaseDataService.getClubsForWallet(mockWalletAddress);

    expect(result).toEqual([]);
  });

  it('should return empty array when data is null', async () => {
    mockSelectAll.mockResolvedValue({
      data: null,
      error: null
    });

    const result = await supabaseDataService.getClubsForWallet(mockWalletAddress);

    expect(result).toEqual([]);
  });
});
