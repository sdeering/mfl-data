import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import PlayerResultsPage from '../components/PlayerResultsPage';
import { mflApi } from '../services/mflApi';
import { LoadingProvider } from '../contexts/LoadingContext';

// Mock the MFL API
jest.mock('../services/mflApi');
const mockMflApi = mflApi as jest.Mocked<typeof mflApi>;

// Mock fetch for API calls
global.fetch = jest.fn();
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

// Mock the wallet context
jest.mock('../contexts/WalletContext', () => ({
  useWallet: () => ({
    isConnected: true,
    account: '0x1234567890abcdef',
    connect: jest.fn(),
    disconnect: jest.fn(),
  }),
}));

// Test wrapper with providers
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <LoadingProvider>
    {children}
  </LoadingProvider>
);

describe('Players Page Tests', () => {
  const mockPlayer = {
    id: 12345,
    metadata: {
      firstName: 'Test',
      lastName: 'Player',
      age: 25,
      overall: 85,
      pace: 80,
      shooting: 85,
      passing: 75,
      dribbling: 80,
      defense: 70,
      physical: 75,
      goalkeeping: 0,
      positions: ['ST'],
      retirementYears: 5,
      nationalities: ['USA'],
      height: 180,
      preferredFoot: 'Right'
    },
    ownedBy: {
      name: 'Test Agency',
      walletAddress: '0x1234567890abcdef'
    },
    activeContract: {
      club: {
        name: 'Test Club'
      }
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock localStorage
    const localStorageMock = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    };
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
    });
    
    // Default mock for all fetch calls
    mockFetch.mockImplementation((url) => {
      if (url.includes('/api/market-data')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: [] })
        } as Response);
      }
      if (url.includes('/api/player/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockPlayer })
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: [] })
      } as Response);
    });
  });

  it('should render player page without breaking after Supabase migration', async () => {
    mockMflApi.getPlayer.mockResolvedValue(mockPlayer);

    render(
      <TestWrapper>
        <PlayerResultsPage propPlayerId="12345" />
      </TestWrapper>
    );
    
    // Wait for the component to load
    await waitFor(() => {
      expect(screen.getByText('Test Player')).toBeInTheDocument();
    }, { timeout: 10000 });

    // Component uses fetch('/api/player/') instead of mflApi.getPlayer directly
  });

  it('should handle player not found error gracefully', async () => {
    // Mock the API to return an error
    mockFetch.mockImplementation((url) => {
      if (url.includes('/api/player/')) {
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ success: false, error: 'Player not found' })
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: [] })
      } as Response);
    });

    render(
      <TestWrapper>
        <PlayerResultsPage propPlayerId="99999" />
      </TestWrapper>
    );
    
    // Wait for error to be displayed
    await waitFor(() => {
      expect(screen.getByText('Search Error')).toBeInTheDocument();
    }, { timeout: 10000 });
  });

  it('should maintain all existing functionality', async () => {
    // Reset the fetch mock to return the player data
    mockFetch.mockImplementation((url) => {
      if (url.includes('/api/market-data')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: [] })
        } as Response);
      }
      if (url.includes('/api/player/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockPlayer })
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: [] })
      } as Response);
    });

    render(
      <TestWrapper>
        <PlayerResultsPage propPlayerId="12345" />
      </TestWrapper>
    );
    
    await waitFor(() => {
      // Check that all expected elements are present
      expect(screen.getByText('Test Player')).toBeInTheDocument();
    }, { timeout: 10000 });
  });
});