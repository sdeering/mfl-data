import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ComparePage from '../../app/compare/page';

// Mock the necessary modules
jest.mock('../../src/services/mflApi', () => ({
  mflApi: {
    getPlayer: jest.fn()
  }
}));

jest.mock('../../src/services/marketDataService', () => ({
  fetchMarketData: jest.fn()
}));

jest.mock('../../src/services/playerSaleHistoryService', () => ({
  fetchPlayerSaleHistory: jest.fn()
}));

jest.mock('../../src/services/playerExperienceService', () => ({
  fetchPlayerExperienceHistory: jest.fn(),
  processProgressionData: jest.fn()
}));

jest.mock('../../src/services/playerMatchesService', () => ({
  fetchPlayerMatches: jest.fn()
}));

jest.mock('../../src/utils/marketValueCalculator', () => ({
  calculateMarketValue: jest.fn()
}));

jest.mock('../../src/utils/ruleBasedPositionCalculator', () => ({
  calculateAllPositionOVRs: jest.fn()
}));

jest.mock('../../src/contexts/LoadingContext', () => ({
  useLoading: () => ({
    setIsLoading: jest.fn()
  })
}));

// Mock Next.js navigation
const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace
  })
}));

// Mock components to avoid complex rendering
jest.mock('../../src/components/PlayerImage', () => {
  return function MockPlayerImage({ player }: { player: any }) {
    return <div data-testid="player-image">{player?.metadata?.firstName} {player?.metadata?.lastName}</div>;
  };
});

jest.mock('../../src/components/PlayerStatsGrid', () => {
  return function MockPlayerStatsGrid({ player }: { player: any }) {
    return <div data-testid="player-stats-grid">{player?.metadata?.overall}</div>;
  };
});

jest.mock('../../src/components/PositionRatingsDisplay', () => {
  return function MockPositionRatingsDisplay({ player }: { player: any }) {
    return <div data-testid="position-ratings">{player?.metadata?.positions?.join(', ')}</div>;
  };
});

jest.mock('../../src/components/PlayerProgressionGraph', () => {
  return function MockPlayerProgressionGraph({ playerId }: { playerId: string }) {
    return <div data-testid="progression-graph">Progression for {playerId}</div>;
  };
});

jest.mock('../../src/components/PlayerSaleHistory', () => {
  return function MockPlayerSaleHistory({ playerId, marketValueEstimate }: { playerId: string; marketValueEstimate?: any }) {
    return (
      <div data-testid="sale-history">
        Sale History for {playerId}
        {marketValueEstimate && <div data-testid="market-value">Market Value: {marketValueEstimate.estimate}</div>}
      </div>
    );
  };
});

jest.mock('../../src/components/PlayerRecentMatches', () => {
  return function MockPlayerRecentMatches({ playerId }: { playerId: string }) {
    return <div data-testid="recent-matches">Recent Matches for {playerId}</div>;
  };
});

describe('ComparePage', () => {
  const mockPlayer1 = {
    id: 12345,
    metadata: {
      firstName: 'John',
      lastName: 'Doe',
      overall: 85,
      positions: ['ST', 'CF'],
      age: 25,
      pace: 80,
      shooting: 85,
      passing: 70,
      dribbling: 75,
      defense: 40,
      physical: 75,
      goalkeeping: 0,
      retirementYears: 5
    }
  };

  const mockPlayer2 = {
    id: 67890,
    metadata: {
      firstName: 'Jane',
      lastName: 'Smith',
      overall: 82,
      positions: ['CM', 'CAM'],
      age: 23,
      pace: 75,
      shooting: 70,
      passing: 85,
      dribbling: 80,
      defense: 65,
      physical: 70,
      goalkeeping: 0,
      retirementYears: 7
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful API responses
    const { mflApi } = require('../../src/services/mflApi');
    mflApi.getPlayer.mockResolvedValue(mockPlayer1);
    
    const { fetchMarketData } = require('../../src/services/marketDataService');
    fetchMarketData.mockResolvedValue({ success: true, data: [] });
    
    const { fetchPlayerSaleHistory } = require('../../src/services/playerSaleHistoryService');
    fetchPlayerSaleHistory.mockResolvedValue({ success: true, data: [] });
    
    const { fetchPlayerExperienceHistory } = require('../../src/services/playerExperienceService');
    fetchPlayerExperienceHistory.mockResolvedValue({ success: true, data: [] });
    
    const { fetchPlayerMatches } = require('../../src/services/playerMatchesService');
    fetchPlayerMatches.mockResolvedValue({ success: true, data: [] });
    
    const { calculateMarketValue } = require('../../src/utils/marketValueCalculator');
    calculateMarketValue.mockReturnValue({
      estimate: 1000000,
      confidence: 0.85,
      breakdown: {}
    });
    
    const { calculateAllPositionOVRs } = require('../../src/utils/ruleBasedPositionCalculator');
    calculateAllPositionOVRs.mockReturnValue({
      results: {
        ST: { success: true, ovr: 85 },
        CF: { success: true, ovr: 82 }
      }
    });
  });

  it('renders compare page with search inputs', () => {
    render(<ComparePage />);
    
    expect(screen.getByText('Compare Players')).toBeInTheDocument();
    expect(screen.getByText('Enter player IDs to compare their stats and ratings')).toBeInTheDocument();
    expect(screen.getByLabelText('Player 1 ID')).toBeInTheDocument();
    expect(screen.getByLabelText('Player 2 ID')).toBeInTheDocument();
  });

  it('allows entering player IDs', () => {
    render(<ComparePage />);
    
    const player1Input = screen.getByLabelText('Player 1 ID');
    const player2Input = screen.getByLabelText('Player 2 ID');
    
    fireEvent.change(player1Input, { target: { value: '12345' } });
    fireEvent.change(player2Input, { target: { value: '67890' } });
    
    expect(player1Input).toHaveValue('12345');
    expect(player2Input).toHaveValue('67890');
  });

  it('shows loading state when searching for player 1', async () => {
    const { mflApi } = require('../../src/services/mflApi');
    mflApi.getPlayer.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(mockPlayer1), 100)));
    
    render(<ComparePage />);
    
    const player1Input = screen.getByLabelText('Player 1 ID');
    const searchButtons = screen.getAllByText('Search');
    
    fireEvent.change(player1Input, { target: { value: '12345' } });
    fireEvent.click(searchButtons[0]);
    
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('displays player 1 data after successful search', async () => {
    render(<ComparePage />);
    
    const player1Input = screen.getByLabelText('Player 1 ID');
    const searchButtons = screen.getAllByText('Search');
    
    fireEvent.change(player1Input, { target: { value: '12345' } });
    fireEvent.click(searchButtons[0]);
    
    await waitFor(() => {
      const johnDoeElements = screen.getAllByText('John Doe');
      expect(johnDoeElements.length).toBeGreaterThan(0);
    });
    
    expect(screen.getAllByTestId('player-image')).toHaveLength(1);
    expect(screen.getAllByTestId('player-stats-grid')).toHaveLength(1);
    expect(screen.getAllByTestId('position-ratings')).toHaveLength(1);
    expect(screen.getAllByTestId('progression-graph')).toHaveLength(1);
    expect(screen.getAllByTestId('sale-history')).toHaveLength(1);
    expect(screen.getAllByTestId('recent-matches')).toHaveLength(1);
  });

  it('displays player 2 data after successful search', async () => {
    const { mflApi } = require('../../src/services/mflApi');
    mflApi.getPlayer
      .mockResolvedValueOnce(mockPlayer1)
      .mockResolvedValueOnce(mockPlayer2);
    
    render(<ComparePage />);
    
    const player1Input = screen.getByLabelText('Player 1 ID');
    const player2Input = screen.getByLabelText('Player 2 ID');
    const searchButtons = screen.getAllByText('Search');
    
    // Search for player 1
    fireEvent.change(player1Input, { target: { value: '12345' } });
    fireEvent.click(searchButtons[0]);
    
    await waitFor(() => {
      const johnDoeElements = screen.getAllByText('John Doe');
      expect(johnDoeElements.length).toBeGreaterThan(0);
    });
    
    // Search for player 2
    fireEvent.change(player2Input, { target: { value: '67890' } });
    fireEvent.click(searchButtons[1]);
    
    await waitFor(() => {
      const janeSmithElements = screen.getAllByText('Jane Smith');
      expect(janeSmithElements.length).toBeGreaterThan(0);
    });
    
    expect(screen.getAllByTestId('player-image')).toHaveLength(2);
    expect(screen.getAllByTestId('player-stats-grid')).toHaveLength(2);
    expect(screen.getAllByTestId('position-ratings')).toHaveLength(2);
    expect(screen.getAllByTestId('progression-graph')).toHaveLength(2);
    expect(screen.getAllByTestId('sale-history')).toHaveLength(2);
    expect(screen.getAllByTestId('recent-matches')).toHaveLength(2);
  });

  it('displays market value estimates for both players', async () => {
    const { calculateMarketValue } = require('../../src/utils/marketValueCalculator');
    calculateMarketValue
      .mockReturnValueOnce({
        estimate: 1000000,
        confidence: 0.85,
        breakdown: {}
      })
      .mockReturnValueOnce({
        estimate: 800000,
        confidence: 0.78,
        breakdown: {}
      });
    
    render(<ComparePage />);
    
    const player1Input = screen.getByLabelText('Player 1 ID');
    const player2Input = screen.getByLabelText('Player 2 ID');
    const searchButtons = screen.getAllByText('Search');
    
    // Search for both players
    fireEvent.change(player1Input, { target: { value: '12345' } });
    fireEvent.change(player2Input, { target: { value: '67890' } });
    fireEvent.click(searchButtons[0]);
    fireEvent.click(searchButtons[1]);
    
    await waitFor(() => {
      expect(screen.getAllByTestId('market-value')).toHaveLength(2);
    });
    
    const marketValues = screen.getAllByTestId('market-value');
    expect(marketValues[0]).toHaveTextContent('Market Value: 1000000');
    expect(marketValues[1]).toHaveTextContent('Market Value: 800000');
  });

  it('handles search errors gracefully', async () => {
    const { mflApi } = require('../../src/services/mflApi');
    mflApi.getPlayer.mockRejectedValue(new Error('Player not found'));
    
    render(<ComparePage />);
    
    const player1Input = screen.getByLabelText('Player 1 ID');
    const searchButtons = screen.getAllByText('Search');
    
    fireEvent.change(player1Input, { target: { value: '99999' } });
    fireEvent.click(searchButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText('Player not found')).toBeInTheDocument();
    });
  });

  it.skip('supports keyboard navigation with Enter key', async () => {
    const { mflApi } = require('../../src/services/mflApi');
    mflApi.getPlayer.mockResolvedValue(mockPlayer1);
    
    render(<ComparePage />);
    
    const player1Input = screen.getByLabelText('Player 1 ID');
    
    fireEvent.change(player1Input, { target: { value: '12345' } });
    
    // Try keyDown event
    fireEvent.keyDown(player1Input, { key: 'Enter', code: 'Enter' });
    
    // Wait for the API call to complete and player data to be displayed
    await waitFor(() => {
      expect(mflApi.getPlayer).toHaveBeenCalledWith('12345');
    });
    
    await waitFor(() => {
      const johnDoeElements = screen.getAllByText('John Doe');
      expect(johnDoeElements.length).toBeGreaterThan(0);
    });
  });

  it('does not search when pasting non-numeric text', async () => {
    const { mflApi } = require('../../src/services/mflApi');
    
    render(<ComparePage />);
    
    const player1Input = screen.getByLabelText('Player 1 ID');
    
    // Simulate pasting non-numeric text
    const pasteEvent = new Event('paste', { bubbles: true });
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: {
        getData: () => 'abc123'
      }
    });
    
    fireEvent(player1Input, pasteEvent);
    
    // Wait a bit to ensure no API call is made
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Verify no API call was made
    expect(mflApi.getPlayer).not.toHaveBeenCalled();
  });

  it('does not duplicate values when pasting player IDs', async () => {
    const { mflApi } = require('../../src/services/mflApi');
    mflApi.getPlayer.mockResolvedValue(mockPlayer1);
    
    render(<ComparePage />);
    
    const player1Input = screen.getByLabelText('Player 1 ID');
    
    // Simulate pasting a player ID
    const pasteEvent = new Event('paste', { bubbles: true });
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: {
        getData: () => '9123'
      }
    });
    
    fireEvent(player1Input, pasteEvent);
    
    // Wait for the state to update
    await waitFor(() => {
      expect(player1Input).toHaveValue('9123');
    });
    
    // Verify the value is exactly what was pasted, not duplicated
    expect(player1Input).toHaveValue('9123');
    expect(player1Input).not.toHaveValue('91239123');
    
    // Verify the API was called with the correct value
    await waitFor(() => {
      expect(mflApi.getPlayer).toHaveBeenCalledWith('9123');
    });
  });

  it('automatically searches when pasting a valid player ID into player 1 input', async () => {
    const { mflApi } = require('../../src/services/mflApi');
    mflApi.getPlayer.mockResolvedValue(mockPlayer1);
    
    render(<ComparePage />);
    
    const player1Input = screen.getByLabelText('Player 1 ID');
    
    // Simulate pasting a player ID
    const pasteEvent = new Event('paste', { bubbles: true });
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: {
        getData: () => '12345'
      }
    });
    
    fireEvent(player1Input, pasteEvent);
    
    // Wait for the API call to complete
    await waitFor(() => {
      expect(mflApi.getPlayer).toHaveBeenCalledWith('12345');
    });
    
    // Verify the input is populated
    expect(player1Input).toHaveValue('12345');
  });

  it('automatically searches when pasting a valid player ID into player 2 input', async () => {
    const { mflApi } = require('../../src/services/mflApi');
    mflApi.getPlayer.mockResolvedValue(mockPlayer2);
    
    render(<ComparePage />);
    
    const player2Input = screen.getByLabelText('Player 2 ID');
    
    // Simulate pasting a player ID
    const pasteEvent = new Event('paste', { bubbles: true });
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: {
        getData: () => '67890'
      }
    });
    
    fireEvent(player2Input, pasteEvent);
    
    // Wait for the API call to complete
    await waitFor(() => {
      expect(mflApi.getPlayer).toHaveBeenCalledWith('67890');
    });
    
    // Verify the input is populated
    expect(player2Input).toHaveValue('67890');
  });

  it('disables search button when input is empty', () => {
    render(<ComparePage />);
    
    const searchButtons = screen.getAllByText('Search');
    expect(searchButtons[0]).toBeDisabled();
    expect(searchButtons[1]).toBeDisabled();
  });

  it('enables search button when input has value', () => {
    render(<ComparePage />);
    
    const player1Input = screen.getByLabelText('Player 1 ID');
    const searchButtons = screen.getAllByText('Search');
    
    fireEvent.change(player1Input, { target: { value: '12345' } });
    expect(searchButtons[0]).not.toBeDisabled();
  });

  describe('removing and switching players', () => {
    const loadTwoPlayers = async () => {
      const { mflApi } = require('../../src/services/mflApi');
      mflApi.getPlayer
        .mockResolvedValueOnce(mockPlayer1)
        .mockResolvedValueOnce(mockPlayer2);

      render(<ComparePage />);

      const player1Input = screen.getByLabelText('Player 1 ID');
      fireEvent.change(player1Input, { target: { value: '12345' } });
      fireEvent.keyDown(player1Input, { key: 'Enter', code: 'Enter' });

      const player2Input = screen.getByLabelText('Player 2 ID');
      fireEvent.change(player2Input, { target: { value: '67890' } });
      fireEvent.keyDown(player2Input, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        expect(screen.getAllByTestId('player-image')).toHaveLength(2);
      });
    };

    const playerOrder = () => screen.getAllByTestId('player-image').map(el => el.textContent);

    it('switches players left and right without refetching them', async () => {
      const { mflApi } = require('../../src/services/mflApi');
      await loadTwoPlayers();
      expect(playerOrder()).toEqual(['John Doe', 'Jane Smith']);

      // The outer edges have nowhere to move to
      expect(screen.getByLabelText('Move John Doe left')).toBeDisabled();
      expect(screen.getByLabelText('Move Jane Smith right')).toBeDisabled();

      fireEvent.click(screen.getByLabelText('Move John Doe right'));

      expect(playerOrder()).toEqual(['Jane Smith', 'John Doe']);
      expect(screen.getByLabelText('Player 1 ID')).toHaveValue('67890');
      expect(screen.getByLabelText('Player 2 ID')).toHaveValue('12345');
      expect(mockReplace).toHaveBeenLastCalledWith('?player1Id=67890&player2Id=12345', { scroll: false });

      fireEvent.click(screen.getByLabelText('Move John Doe left'));

      expect(playerOrder()).toEqual(['John Doe', 'Jane Smith']);
      expect(mockReplace).toHaveBeenLastCalledWith('?player1Id=12345&player2Id=67890', { scroll: false });
      expect(mflApi.getPlayer).toHaveBeenCalledTimes(2);
    });

    it('removes a player with the X button without moving the other player', async () => {
      await loadTwoPlayers();

      fireEvent.click(screen.getByLabelText('Remove John Doe'));

      // Player 1 is emptied where it is; Player 2 stays in the Player 2 slot
      expect(playerOrder()).toEqual(['Jane Smith']);
      expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Player 1 ID')).toHaveValue('');
      expect(screen.getByLabelText('Player 2 ID')).toHaveValue('67890');
      expect(mockReplace).toHaveBeenLastCalledWith('?player2Id=67890', { scroll: false });
    });

    it('keeps each slot independent after a removal', async () => {
      await loadTwoPlayers();

      fireEvent.click(screen.getByLabelText('Remove Jane Smith'));
      fireEvent.change(screen.getByLabelText('Player 2 ID'), { target: { value: '777' } });

      expect(screen.getByLabelText('Player 1 ID')).toHaveValue('12345');
      expect(screen.getByLabelText('Player 2 ID')).toHaveValue('777');
    });

    it('with three players, removes the middle one in place, then closes the empty column', async () => {
      const { mflApi } = require('../../src/services/mflApi');
      const mockPlayer3 = { ...mockPlayer2, id: 11111, metadata: { ...mockPlayer2.metadata, firstName: 'Sam', lastName: 'Jones' } };
      await loadTwoPlayers();

      mflApi.getPlayer.mockResolvedValueOnce(mockPlayer3);
      fireEvent.click(screen.getByText('+ Add Player'));
      const player3Input = screen.getByLabelText('Player 3 ID');
      fireEvent.change(player3Input, { target: { value: '11111' } });
      fireEvent.keyDown(player3Input, { key: 'Enter', code: 'Enter' });
      await waitFor(() => {
        expect(screen.getAllByTestId('player-image')).toHaveLength(3);
      });

      fireEvent.click(screen.getByLabelText('Remove Jane Smith'));

      // The third player stays in the third column
      expect(screen.getByLabelText('Player 2 ID')).toHaveValue('');
      expect(screen.getByLabelText('Player 3 ID')).toHaveValue('11111');
      expect(mockReplace).toHaveBeenLastCalledWith('?player1Id=12345&player3Id=11111', { scroll: false });

      // The now-empty middle column can be closed, which brings it back to two columns
      fireEvent.click(screen.getByLabelText('Remove Player 2'));

      expect(screen.queryByLabelText('Player 3 ID')).not.toBeInTheDocument();
      expect(playerOrder()).toEqual(['John Doe', 'Sam Jones']);
      expect(mockReplace).toHaveBeenLastCalledWith('?player1Id=12345&player2Id=11111', { scroll: false });
    });

    it('removing the last of three players drops its column', async () => {
      const { mflApi } = require('../../src/services/mflApi');
      const mockPlayer3 = { ...mockPlayer2, id: 11111, metadata: { ...mockPlayer2.metadata, firstName: 'Sam', lastName: 'Jones' } };
      await loadTwoPlayers();

      mflApi.getPlayer.mockResolvedValueOnce(mockPlayer3);
      fireEvent.click(screen.getByText('+ Add Player'));
      const player3Input = screen.getByLabelText('Player 3 ID');
      fireEvent.change(player3Input, { target: { value: '11111' } });
      fireEvent.keyDown(player3Input, { key: 'Enter', code: 'Enter' });
      await waitFor(() => {
        expect(screen.getAllByTestId('player-image')).toHaveLength(3);
      });

      fireEvent.click(screen.getByLabelText('Remove Sam Jones'));

      expect(screen.queryByLabelText('Player 3 ID')).not.toBeInTheDocument();
      expect(playerOrder()).toEqual(['John Doe', 'Jane Smith']);
      expect(mockReplace).toHaveBeenLastCalledWith('?player1Id=12345&player2Id=67890', { scroll: false });
    });

    it('clears the URL when the last player is removed', async () => {
      await loadTwoPlayers();

      fireEvent.click(screen.getByLabelText('Remove John Doe'));
      fireEvent.click(screen.getByLabelText('Remove Jane Smith'));

      expect(screen.queryAllByTestId('player-image')).toHaveLength(0);
      expect(mockReplace).toHaveBeenLastCalledWith('/compare', { scroll: false });
    });

    it('removes the third column with its X button', async () => {
      await loadTwoPlayers();

      fireEvent.click(screen.getByText('+ Add Player'));
      expect(screen.getByLabelText('Player 3 ID')).toBeInTheDocument();
      expect(screen.queryByText('+ Add Player')).not.toBeInTheDocument();

      fireEvent.click(screen.getByLabelText('Remove Player 3'));

      expect(screen.queryByLabelText('Player 3 ID')).not.toBeInTheDocument();
      expect(screen.getByText('+ Add Player')).toBeInTheDocument();
      expect(playerOrder()).toEqual(['John Doe', 'Jane Smith']);
    });

    it('does not offer remove or switch controls for empty player 1 and 2 columns', () => {
      render(<ComparePage />);

      expect(screen.queryByLabelText(/^Remove /)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/^Move /)).not.toBeInTheDocument();
    });
  });
});
