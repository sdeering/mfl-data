import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import MatchesTacticsPageSupabase from '../components/MatchesTacticsPageSupabase';

// Mock the wallet context
jest.mock('../contexts/WalletContext', () => ({
  useWallet: jest.fn(),
}));

// Mock the supabase data service
jest.mock('../services/supabaseDataService', () => ({
  supabaseDataService: {
    getClubsForWallet: jest.fn(),
    getMatchesData: jest.fn(),
    getUpcomingMatches: jest.fn(),
    getPreviousMatches: jest.fn(),
    getTacticsPageData: jest.fn(),
    getMatchFormation: jest.fn(),
  },
}));

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

describe('Supabase Migration Tests', () => {
  const mockUseWallet = require('../contexts/WalletContext').useWallet as jest.MockedFunction<any>;
  const mockSupabaseDataService = require('../services/supabaseDataService').supabaseDataService as jest.Mocked<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('MatchesTacticsPageSupabase', () => {
    it('should render loading state when wallet is not initialized', () => {
      mockUseWallet.mockReturnValue({
        isConnected: false,
        account: null,
        connect: jest.fn(),
        disconnect: jest.fn(),
        hasCheckedWallet: false,
      });

      render(<MatchesTacticsPageSupabase />);
      
      expect(screen.getByText('Initializing wallet connection...')).toBeInTheDocument();
    });

    it('should redirect when wallet is not connected', async () => {
      mockUseWallet.mockReturnValue({
        isConnected: false,
        account: null,
        connect: jest.fn(),
        disconnect: jest.fn(),
        hasCheckedWallet: true,
      });

      render(<MatchesTacticsPageSupabase />);
      
      await waitFor(() => {
        expect(screen.getByText('Wallet Not Connected')).toBeInTheDocument();
      }, { timeout: 10000 });
    });

    it('should load clubs when wallet is connected', async () => {
      const mockAccount = '0x1234567890abcdef';
      const mockClubs = [
        {
          club: {
            id: 1,
            name: 'Test Club 1',
          },
        },
        {
          club: {
            id: 2,
            name: 'Test Club 2',
          },
        },
      ];

      mockUseWallet.mockReturnValue({
        isConnected: true,
        account: mockAccount,
        connect: jest.fn(),
        disconnect: jest.fn(),
        hasCheckedWallet: true,
      });

      mockSupabaseDataService.getClubsForWallet.mockResolvedValue(mockClubs);
      mockSupabaseDataService.getUpcomingMatches.mockResolvedValue([]);

      render(<MatchesTacticsPageSupabase />);
      // advance wallet init timeout in component
      await Promise.resolve();
      jest.advanceTimersByTime(1600);
      await waitFor(() => {
        const clubs = screen.getAllByText('Test Club 1')
        expect(clubs.length).toBeGreaterThan(0)
        expect(screen.getByText('Test Club 2')).toBeInTheDocument();
      }, { timeout: 10000 });

      expect(mockSupabaseDataService.getClubsForWallet).toHaveBeenCalledWith(mockAccount);
    });

    it('should load upcoming matches when club is selected', async () => {
      const mockAccount = '0x1234567890abcdef';
      const mockClubs = [
        {
          club: {
            id: 1,
            name: 'Test Club 1',
          },
        },
      ];

      const mockMatches = [
        {
          id: 1,
          homeTeamName: 'Test Club 1',
          awayTeamName: 'Opponent Team',
          startDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          status: 'PLANNED',
          type: 'LEAGUE',
          homeSquad: { id: 1 },
          awaySquad: { id: 2 },
          competition: { name: 'League' },
        },
      ];

      mockUseWallet.mockReturnValue({
        isConnected: true,
        account: mockAccount,
        connect: jest.fn(),
        disconnect: jest.fn(),
        hasCheckedWallet: true,
      });

      mockSupabaseDataService.getClubsForWallet.mockResolvedValue(mockClubs);
      mockSupabaseDataService.getMatchesData.mockResolvedValue(mockMatches);
      mockSupabaseDataService.getUpcomingMatches.mockResolvedValue(mockMatches);

      render(<MatchesTacticsPageSupabase />);
      await Promise.resolve();
      jest.advanceTimersByTime(1600);
      await waitFor(() => {
        const clubs = screen.getAllByText('Test Club 1')
        expect(clubs.length).toBeGreaterThan(0)
      }, { timeout: 10000 });

      // Click on the club to select it
      const clubButton = screen.getAllByText('Test Club 1')[0];
      await Promise.resolve();
      clubButton.click();

      await waitFor(() => {
        expect(screen.getByText('Opponent Team')).toBeInTheDocument();
      });

      expect(mockSupabaseDataService.getMatchesData).toHaveBeenCalledWith('1', 'previous');
    });

    it('should handle errors gracefully', async () => {
      const mockAccount = '0x1234567890abcdef';

      mockUseWallet.mockReturnValue({
        isConnected: true,
        account: mockAccount,
        connect: jest.fn(),
        disconnect: jest.fn(),
        hasCheckedWallet: true,
      });

      mockSupabaseDataService.getClubsForWallet.mockRejectedValue(new Error('Database error'));

      render(<MatchesTacticsPageSupabase />);
      
      await waitFor(() => {
        expect(screen.getByText('Error')).toBeInTheDocument();
        expect(screen.getByText('Failed to load clubs')).toBeInTheDocument();
      }, { timeout: 10000 });
    });

    it('should display Supabase branding', async () => {
      const mockAccount = '0x1234567890abcdef';
      const mockClubs = [
        {
          club: {
            id: 1,
            name: 'Test Club 1',
          },
        },
      ];

      mockUseWallet.mockReturnValue({
        isConnected: true,
        account: mockAccount,
        connect: jest.fn(),
        disconnect: jest.fn(),
        hasCheckedWallet: true,
      });

      mockSupabaseDataService.getClubsForWallet.mockResolvedValue(mockClubs);

      render(<MatchesTacticsPageSupabase />);
      jest.advanceTimersByTime(1600);
      await waitFor(() => {
        expect(screen.getByText('Powered by Database')).toBeInTheDocument();
      }, { timeout: 10000 });
    });
  });

  describe('Data Service Integration', () => {
    it('should call supabaseDataService methods with correct parameters', async () => {
      const mockAccount = '0x1234567890abcdef';
      const mockClubs = [
        {
          club: {
            id: 1,
            name: 'Test Club 1',
          },
        },
      ];

      mockUseWallet.mockReturnValue({
        isConnected: true,
        account: mockAccount,
        connect: jest.fn(),
        disconnect: jest.fn(),
        hasCheckedWallet: true,
      });

      mockSupabaseDataService.getClubsForWallet.mockResolvedValue(mockClubs);

      render(<MatchesTacticsPageSupabase />);
      
      await waitFor(() => {
        expect(mockSupabaseDataService.getClubsForWallet).toHaveBeenCalledWith(mockAccount);
      });
    });
  });
});
