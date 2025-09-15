import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import PlayerResultsPage from '../components/PlayerResultsPage';
import { mflApi } from '../services/mflApi';
import { LoadingProvider } from '../contexts/LoadingContext';

// Mock the MFL API
jest.mock('../services/mflApi');
const mockMflApi = mflApi as jest.Mocked<typeof mflApi>;

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
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render player page without breaking after Supabase migration', async () => {
    const mockPlayer = {
      id: 12345,
      name: 'Test Player',
      position: 'ST',
      age: 25,
      overall: 85,
      // Add other player properties as needed
    };

    mockMflApi.getPlayer.mockResolvedValue(mockPlayer);

    render(
      <TestWrapper>
        <PlayerResultsPage propPlayerId="12345" />
      </TestWrapper>
    );
    
    // Wait for the component to load
    await waitFor(() => {
      expect(screen.getByText('Test Player')).toBeInTheDocument();
    });

    expect(mockMflApi.getPlayer).toHaveBeenCalledWith('12345');
  });

  it('should handle player not found error gracefully', async () => {
    mockMflApi.getPlayer.mockRejectedValue(new Error('Player not found'));

    render(
      <TestWrapper>
        <PlayerResultsPage propPlayerId="99999" />
      </TestWrapper>
    );
    
    // Should handle error gracefully without crashing
    await waitFor(() => {
      // The component should still render, even if player is not found
      expect(screen.getByText(/not found|error/i)).toBeInTheDocument();
    });
  });

  it('should maintain all existing functionality', async () => {
    const mockPlayer = {
      id: 12345,
      name: 'Test Player',
      position: 'ST',
      age: 25,
      overall: 85,
      // Add comprehensive player data
    };

    mockMflApi.getPlayer.mockResolvedValue(mockPlayer);

    render(
      <TestWrapper>
        <PlayerResultsPage propPlayerId="12345" />
      </TestWrapper>
    );
    
    await waitFor(() => {
      // Check that all expected elements are present
      expect(screen.getByText('Test Player')).toBeInTheDocument();
      expect(screen.getByText('ST')).toBeInTheDocument();
      expect(screen.getByText('25')).toBeInTheDocument();
      expect(screen.getByText('85')).toBeInTheDocument();
    });
  });
});
