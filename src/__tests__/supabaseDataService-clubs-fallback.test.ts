import { supabaseDataService } from '../services/supabaseDataService';
import { supabase } from '../lib/supabase';

// Mock the supabase client and TABLES
jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => ({
            // This will be overridden in individual tests
          }))
        }))
      }))
    }))
  },
  TABLES: {
    USERS: 'users',
    PLAYERS: 'players',
    AGENCY_PLAYERS: 'agency_players',
    CLUBS: 'clubs',
    MATCHES: 'matches',
    OPPONENT_MATCHES: 'opponent_matches',
    PLAYER_SALE_HISTORY: 'player_sale_history',
    PLAYER_PROGRESSION: 'player_progression',
    SQUAD_IDS: 'squad_ids',
    SYNC_STATUS: 'sync_status',
    MARKET_VALUES: 'market_values',
    POSITION_RATINGS: 'position_ratings'
  }
}));

// Mock the cache service
jest.mock('../services/cacheService', () => ({
  cacheService: {
    get: jest.fn(),
    set: jest.fn()
  }
}));

describe('supabaseDataService.getClubsForWallet fallback logic', () => {
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

  it('should successfully fetch clubs when wallet_address column exists (new schema)', async () => {
    // Mock successful query with wallet_address filter
    const mockQuery = {
      eq: jest.fn(() => ({
        order: jest.fn(() => Promise.resolve({
          data: mockClubsData,
          error: null
        }))
      }))
    };

    const mockSelect = jest.fn(() => mockQuery);
    const mockFrom = jest.fn(() => ({ select: mockSelect }));

    (supabase.from as jest.Mock).mockImplementation(mockFrom);

    const result = await supabaseDataService.getClubsForWallet(mockWalletAddress);

    expect(result).toEqual(mockClubsData);
    expect(mockFrom).toHaveBeenCalledWith('clubs');
    expect(mockSelect).toHaveBeenCalledWith('*');
    expect(mockQuery.eq).toHaveBeenCalledWith('wallet_address', mockWalletAddress);
  });

  it('should fall back to old schema when wallet_address column does not exist', async () => {
    // Mock first query failing with wallet_address column error
    const walletAddressError = {
      code: '42703',
      message: 'column clubs.wallet_address does not exist',
      details: null,
      hint: null
    };

    const mockQueryWithError = {
      eq: jest.fn(() => ({
        order: jest.fn(() => Promise.resolve({
          data: null,
          error: walletAddressError
        }))
      }))
    };

    // Mock fallback query succeeding without wallet_address filter
    const mockFallbackQuery = {
      order: jest.fn(() => Promise.resolve({
        data: mockClubsData,
        error: null
      }))
    };

    const mockSelect = jest.fn()
      .mockReturnValueOnce(mockQueryWithError) // First call fails
      .mockReturnValueOnce(mockFallbackQuery); // Second call succeeds

    const mockFrom = jest.fn(() => ({ select: mockSelect }));

    (supabase.from as jest.Mock).mockImplementation(mockFrom);

    const result = await supabaseDataService.getClubsForWallet(mockWalletAddress);

    expect(result).toEqual(mockClubsData);
    
    // Verify both queries were attempted
    expect(mockFrom).toHaveBeenCalledTimes(2);
    expect(mockSelect).toHaveBeenCalledTimes(2);
    
    // First call should try with wallet_address filter
    expect(mockQueryWithError.eq).toHaveBeenCalledWith('wallet_address', mockWalletAddress);
    
    // Second call should be without wallet_address filter
    expect(mockFallbackQuery.order).toHaveBeenCalledWith('last_synced', { ascending: false });
  });

  it('should fall back to old schema when wallet_address column error has quotes', async () => {
    // Mock first query failing with quoted column name error
    const walletAddressError = {
      code: '42703',
      message: 'column "wallet_address" does not exist',
      details: null,
      hint: null
    };

    const mockQueryWithError = {
      eq: jest.fn(() => ({
        order: jest.fn(() => Promise.resolve({
          data: null,
          error: walletAddressError
        }))
      }))
    };

    const mockFallbackQuery = {
      order: jest.fn(() => Promise.resolve({
        data: mockClubsData,
        error: null
      }))
    };

    const mockSelect = jest.fn()
      .mockReturnValueOnce(mockQueryWithError)
      .mockReturnValueOnce(mockFallbackQuery);

    const mockFrom = jest.fn(() => ({ select: mockSelect }));

    (supabase.from as jest.Mock).mockImplementation(mockFrom);

    const result = await supabaseDataService.getClubsForWallet(mockWalletAddress);

    expect(result).toEqual(mockClubsData);
    expect(mockFrom).toHaveBeenCalledTimes(2);
  });

  it('should throw error if fallback query also fails', async () => {
    const walletAddressError = {
      code: '42703',
      message: 'column clubs.wallet_address does not exist',
      details: null,
      hint: null
    };

    const fallbackError = {
      code: '42P01',
      message: 'relation "clubs" does not exist',
      details: null,
      hint: null
    };

    const mockQueryWithError = {
      eq: jest.fn(() => ({
        order: jest.fn(() => Promise.resolve({
          data: null,
          error: walletAddressError
        }))
      }))
    };

    const mockFallbackQuery = {
      order: jest.fn(() => Promise.resolve({
        data: null,
        error: fallbackError
      }))
    };

    const mockSelect = jest.fn()
      .mockReturnValueOnce(mockQueryWithError)
      .mockReturnValueOnce(mockFallbackQuery);

    const mockFrom = jest.fn(() => ({ select: mockSelect }));

    (supabase.from as jest.Mock).mockImplementation(mockFrom);

    await expect(supabaseDataService.getClubsForWallet(mockWalletAddress))
      .rejects.toEqual(fallbackError);
  });

  it('should not fall back for non-wallet_address column errors', async () => {
    const otherError = {
      code: '42P01',
      message: 'relation "clubs" does not exist',
      details: null,
      hint: null
    };

    const mockQueryWithError = {
      eq: jest.fn(() => ({
        order: jest.fn(() => Promise.resolve({
          data: null,
          error: otherError
        }))
      }))
    };

    const mockSelect = jest.fn(() => mockQueryWithError);
    const mockFrom = jest.fn(() => ({ select: mockSelect }));

    (supabase.from as jest.Mock).mockImplementation(mockFrom);

    await expect(supabaseDataService.getClubsForWallet(mockWalletAddress))
      .rejects.toEqual(otherError);

    // Should only call once, no fallback
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it('should return empty array when no clubs found', async () => {
    const mockQuery = {
      eq: jest.fn(() => ({
        order: jest.fn(() => Promise.resolve({
          data: [],
          error: null
        }))
      }))
    };

    const mockSelect = jest.fn(() => mockQuery);
    const mockFrom = jest.fn(() => ({ select: mockSelect }));

    (supabase.from as jest.Mock).mockImplementation(mockFrom);

    const result = await supabaseDataService.getClubsForWallet(mockWalletAddress);

    expect(result).toEqual([]);
  });

  it('should handle null data response', async () => {
    const mockQuery = {
      eq: jest.fn(() => ({
        order: jest.fn(() => Promise.resolve({
          data: null,
          error: null
        }))
      }))
    };

    const mockSelect = jest.fn(() => mockQuery);
    const mockFrom = jest.fn(() => ({ select: mockSelect }));

    (supabase.from as jest.Mock).mockImplementation(mockFrom);

    const result = await supabaseDataService.getClubsForWallet(mockWalletAddress);

    expect(result).toEqual([]);
  });
});
