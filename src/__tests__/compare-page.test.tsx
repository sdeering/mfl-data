import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ComparePage from '../../app/compare/page';
import { mflApi } from '../services/mflApi';
import { fetchMarketData } from '../services/marketDataService';
import { fetchPlayerSaleHistory } from '../services/playerSaleHistoryService';
import { fetchPlayerExperienceHistory } from '../services/playerExperienceService';
import { fetchPlayerMatches } from '../services/playerMatchesService';

// Mock all the services
jest.mock('../services/mflApi');
jest.mock('../services/marketDataService');
jest.mock('../services/playerSaleHistoryService');
jest.mock('../services/playerExperienceService');
jest.mock('../services/playerMatchesService');

const mockMflApi = mflApi as jest.Mocked<typeof mflApi>;
const mockFetchMarketData = fetchMarketData as jest.MockedFunction<typeof fetchMarketData>;
const mockFetchPlayerSaleHistory = fetchPlayerSaleHistory as jest.MockedFunction<typeof fetchPlayerSaleHistory>;
const mockFetchPlayerExperienceHistory = fetchPlayerExperienceHistory as jest.MockedFunction<typeof fetchPlayerExperienceHistory>;
const mockFetchPlayerMatches = fetchPlayerMatches as jest.MockedFunction<typeof fetchPlayerMatches>;

// Mock the loading context
jest.mock('../contexts/LoadingContext', () => ({
  useLoading: () => ({
    setIsLoading: jest.fn(),
  }),
}));

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({
    replace: jest.fn(),
  }),
}));

describe('Compare Page Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render compare page without breaking after Supabase migration', async () => {
    render(<ComparePage />);
    
    await waitFor(() => {
      expect(screen.getByText('Compare Players')).toBeInTheDocument();
      expect(screen.getByText('Enter player IDs to compare their stats and ratings')).toBeInTheDocument();
    });
  });

  it('should handle player search functionality', async () => {
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
      },
    };

    mockMflApi.getPlayer.mockResolvedValue(mockPlayer);
    mockFetchMarketData.mockResolvedValue({ success: true, data: [] });
    mockFetchPlayerSaleHistory.mockResolvedValue({ success: true, data: [] });
    mockFetchPlayerExperienceHistory.mockResolvedValue({ success: true, data: [] });
    mockFetchPlayerMatches.mockResolvedValue({ success: true, data: [] });

    render(<ComparePage />);
    
    // Find the player 1 input
    const player1Input = screen.getByLabelText('Player 1 ID');
    const searchButtons = screen.getAllByRole('button', { name: /search/i });
    const player1SearchButton = searchButtons[0];

    // Enter player ID and search
    fireEvent.change(player1Input, { target: { value: '12345' } });
    fireEvent.click(player1SearchButton);

    await waitFor(() => {
      expect(screen.getByText('Test Player')).toBeInTheDocument();
    });

    expect(mockMflApi.getPlayer).toHaveBeenCalledWith('12345');
  });

  it('should handle paste functionality for player IDs', async () => {
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
      },
    };

    mockMflApi.getPlayer.mockResolvedValue(mockPlayer);
    mockFetchMarketData.mockResolvedValue({ success: true, data: [] });
    mockFetchPlayerSaleHistory.mockResolvedValue({ success: true, data: [] });
    mockFetchPlayerExperienceHistory.mockResolvedValue({ success: true, data: [] });
    mockFetchPlayerMatches.mockResolvedValue({ success: true, data: [] });

    render(<ComparePage />);
    
    const player1Input = screen.getByLabelText('Player 1 ID');

    // Simulate paste event
    fireEvent.paste(player1Input, {
      clipboardData: {
        getData: () => '12345',
      },
    });

    await waitFor(() => {
      expect(screen.getByText('Test Player')).toBeInTheDocument();
    });
  });

  it('should handle errors gracefully', async () => {
    mockMflApi.getPlayer.mockRejectedValue(new Error('Player not found'));

    render(<ComparePage />);
    
    const player1Input = screen.getByLabelText('Player 1 ID');
    const searchButtons = screen.getAllByRole('button', { name: /search/i });
    const player1SearchButton = searchButtons[0];

    fireEvent.change(player1Input, { target: { value: '99999' } });
    fireEvent.click(player1SearchButton);

    await waitFor(() => {
      expect(screen.getByText('Player not found')).toBeInTheDocument();
    });
  });

  it('should maintain all existing functionality', async () => {
    const mockPlayer1 = {
      id: 12345,
      metadata: {
        firstName: 'Test',
        lastName: 'Player1',
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
      },
    };

    const mockPlayer2 = {
      id: 67890,
      metadata: {
        firstName: 'Test',
        lastName: 'Player2',
        age: 27,
        overall: 82,
        pace: 75,
        shooting: 80,
        passing: 85,
        dribbling: 75,
        defense: 80,
        physical: 70,
        goalkeeping: 0,
        positions: ['CM'],
        retirementYears: 3,
      },
    };

    mockMflApi.getPlayer
      .mockResolvedValueOnce(mockPlayer1)
      .mockResolvedValueOnce(mockPlayer2);
    
    mockFetchMarketData.mockResolvedValue({ success: true, data: [] });
    mockFetchPlayerSaleHistory.mockResolvedValue({ success: true, data: [] });
    mockFetchPlayerExperienceHistory.mockResolvedValue({ success: true, data: [] });
    mockFetchPlayerMatches.mockResolvedValue({ success: true, data: [] });

    render(<ComparePage />);
    
    // Search for player 1
    const player1Input = screen.getByLabelText('Player 1 ID');
    const searchButtons = screen.getAllByRole('button', { name: /search/i });
    const player1SearchButton = searchButtons[0];

    fireEvent.change(player1Input, { target: { value: '12345' } });
    fireEvent.click(player1SearchButton);

    await waitFor(() => {
      expect(screen.getByText('Test Player1')).toBeInTheDocument();
    });

    // Search for player 2
    const player2Input = screen.getByLabelText('Player 2 ID');
    const player2SearchButton = screen.getAllByRole('button', { name: /search/i })[1];

    fireEvent.change(player2Input, { target: { value: '67890' } });
    fireEvent.click(player2SearchButton);

    await waitFor(() => {
      expect(screen.getByText('Test Player2')).toBeInTheDocument();
    });

    // Check that both players are displayed
    expect(screen.getByText('Test Player1')).toBeInTheDocument();
    expect(screen.getByText('Test Player2')).toBeInTheDocument();
  });

  it('should handle keyboard events (Enter key)', async () => {
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
      },
    };

    mockMflApi.getPlayer.mockResolvedValue(mockPlayer);
    mockFetchMarketData.mockResolvedValue({ success: true, data: [] });
    mockFetchPlayerSaleHistory.mockResolvedValue({ success: true, data: [] });
    mockFetchPlayerExperienceHistory.mockResolvedValue({ success: true, data: [] });
    mockFetchPlayerMatches.mockResolvedValue({ success: true, data: [] });

    render(<ComparePage />);
    
    const player1Input = screen.getByLabelText('Player 1 ID');

    fireEvent.change(player1Input, { target: { value: '12345' } });
    fireEvent.keyDown(player1Input, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('Test Player')).toBeInTheDocument();
    }, { timeout: 5000 });
  });
});
