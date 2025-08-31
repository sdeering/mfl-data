import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PlayerSaleHistory from '../components/PlayerSaleHistory';

// Mock the necessary services
jest.mock('../services/playerSaleHistoryService', () => ({
  fetchPlayerSaleHistory: jest.fn()
}));

jest.mock('../services/playerExperienceService', () => ({
  fetchPlayerExperienceHistory: jest.fn(),
  processProgressionData: jest.fn()
}));

jest.mock('../services/marketDataService', () => ({
  fetchMarketData: jest.fn()
}));

jest.mock('../utils/marketValueCalculator', () => ({
  calculateMarketValue: jest.fn()
}));

describe('PlayerSaleHistory', () => {
  const mockPlayerMetadata = {
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
  };

  const mockMarketValueEstimate = {
    estimate: 1500000,
    confidence: 0.85,
    breakdown: {
      baseValue: 1200000,
      positionPremium: 1.2,
      progressionBonus: 1.1,
      retirementPenalty: 0.95,
      experienceFactor: 1.0
    },
    tags: ['multiple-positions']
  };

  const mockSaleHistory = [
    {
      id: '1',
      playerId: '12345',
      seller: '0x123...',
      buyer: '0x456...',
      price: 1000000,
      timestamp: '2024-01-15T10:30:00Z',
      transactionHash: '0x789...'
    },
    {
      id: '2',
      playerId: '12345',
      seller: '0x456...',
      buyer: '0x789...',
      price: 1200000,
      timestamp: '2024-02-20T14:45:00Z',
      transactionHash: '0xabc...'
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful API responses
    const { fetchPlayerSaleHistory } = require('../services/playerSaleHistoryService');
    fetchPlayerSaleHistory.mockResolvedValue({ success: true, data: mockSaleHistory });
    
    const { fetchPlayerExperienceHistory } = require('../services/playerExperienceService');
    fetchPlayerExperienceHistory.mockResolvedValue({ success: true, data: [] });
    
    const { fetchMarketData } = require('../services/marketDataService');
    fetchMarketData.mockResolvedValue({ success: true, data: [] });
  });

  it('renders sale history component with market value estimate', async () => {
    render(
      <PlayerSaleHistory
        playerId="12345"
        playerName="John Doe"
        playerMetadata={mockPlayerMetadata}
        marketValueEstimate={mockMarketValueEstimate}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Sale History')).toBeInTheDocument();
    });

    // Check market value display
    expect(screen.getByText('Market Value Estimate')).toBeInTheDocument();
    expect(screen.getByText('1,500,000')).toBeInTheDocument();
    expect(screen.getByText('85% confidence')).toBeInTheDocument();
  });

  it('displays market value breakdown when provided', async () => {
    render(
      <PlayerSaleHistory
        playerId="12345"
        playerName="John Doe"
        playerMetadata={mockPlayerMetadata}
        marketValueEstimate={mockMarketValueEstimate}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Market Value Estimate')).toBeInTheDocument();
    });

    // Check breakdown details
    expect(screen.getByText('Base Value:')).toBeInTheDocument();
    expect(screen.getByText('1,200,000')).toBeInTheDocument();
    expect(screen.getByText('Position Premium:')).toBeInTheDocument();
    expect(screen.getByText('1.2x')).toBeInTheDocument();
    expect(screen.getByText('Progression Bonus:')).toBeInTheDocument();
    expect(screen.getByText('1.1x')).toBeInTheDocument();
    expect(screen.getByText('Retirement Penalty:')).toBeInTheDocument();
    expect(screen.getByText('0.95x')).toBeInTheDocument();
  });

  it('displays smart tags when present', async () => {
    render(
      <PlayerSaleHistory
        playerId="12345"
        playerName="John Doe"
        playerMetadata={mockPlayerMetadata}
        marketValueEstimate={mockMarketValueEstimate}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Sale History')).toBeInTheDocument();
    });

    // Check for smart tags
    expect(screen.getByText('Multiple Positions')).toBeInTheDocument();
  });

  it('displays sale history transactions', async () => {
    render(
      <PlayerSaleHistory
        playerId="12345"
        playerName="John Doe"
        playerMetadata={mockPlayerMetadata}
        marketValueEstimate={mockMarketValueEstimate}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Sale History')).toBeInTheDocument();
    });

    // Check for sale history entries
    expect(screen.getByText('1,000,000')).toBeInTheDocument();
    expect(screen.getByText('1,200,000')).toBeInTheDocument();
    expect(screen.getByText('Jan 15, 2024')).toBeInTheDocument();
    expect(screen.getByText('Feb 20, 2024')).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    render(
      <PlayerSaleHistory
        playerId="12345"
        playerName="John Doe"
        playerMetadata={mockPlayerMetadata}
        marketValueEstimate={mockMarketValueEstimate}
      />
    );

    // Should show loading spinner initially
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('handles empty sale history gracefully', async () => {
    const { fetchPlayerSaleHistory } = require('../services/playerSaleHistoryService');
    fetchPlayerSaleHistory.mockResolvedValue({ success: true, data: [] });

    render(
      <PlayerSaleHistory
        playerId="12345"
        playerName="John Doe"
        playerMetadata={mockPlayerMetadata}
        marketValueEstimate={mockMarketValueEstimate}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Sale History')).toBeInTheDocument();
    });

    // Should still show market value even with no sale history
    expect(screen.getByText('Market Value Estimate')).toBeInTheDocument();
    expect(screen.getByText('1,500,000')).toBeInTheDocument();
  });

  it('handles API errors gracefully', async () => {
    const { fetchPlayerSaleHistory } = require('../services/playerSaleHistoryService');
    fetchPlayerSaleHistory.mockRejectedValue(new Error('API Error'));

    render(
      <PlayerSaleHistory
        playerId="12345"
        playerName="John Doe"
        playerMetadata={mockPlayerMetadata}
        marketValueEstimate={mockMarketValueEstimate}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Failed to load sale history')).toBeInTheDocument();
    });
  });

  it('displays different confidence levels correctly', async () => {
    const highConfidenceEstimate = {
      ...mockMarketValueEstimate,
      confidence: 0.95
    };

    const lowConfidenceEstimate = {
      ...mockMarketValueEstimate,
      confidence: 0.65
    };

    const { rerender } = render(
      <PlayerSaleHistory
        playerId="12345"
        playerName="John Doe"
        playerMetadata={mockPlayerMetadata}
        marketValueEstimate={highConfidenceEstimate}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('95% confidence')).toBeInTheDocument();
    });

    rerender(
      <PlayerSaleHistory
        playerId="12345"
        playerName="John Doe"
        playerMetadata={mockPlayerMetadata}
        marketValueEstimate={lowConfidenceEstimate}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('65% confidence')).toBeInTheDocument();
    });
  });

  it('displays retirement tag when player is near retirement', async () => {
    const retirementEstimate = {
      ...mockMarketValueEstimate,
      tags: ['retirement', 'multiple-positions']
    };

    render(
      <PlayerSaleHistory
        playerId="12345"
        playerName="John Doe"
        playerMetadata={mockPlayerMetadata}
        marketValueEstimate={retirementEstimate}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Sale History')).toBeInTheDocument();
    });

    expect(screen.getByText('Retirement')).toBeInTheDocument();
    expect(screen.getByText('Multiple Positions')).toBeInTheDocument();
  });

  it('displays newly minted tag for inexperienced players', async () => {
    const newlyMintedEstimate = {
      ...mockMarketValueEstimate,
      tags: ['newly-minted']
    };

    render(
      <PlayerSaleHistory
        playerId="12345"
        playerName="John Doe"
        playerMetadata={mockPlayerMetadata}
        marketValueEstimate={newlyMintedEstimate}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Sale History')).toBeInTheDocument();
    });

    expect(screen.getByText('Newly Minted')).toBeInTheDocument();
  });

  it('displays single owner tag when player has never been sold', async () => {
    const singleOwnerEstimate = {
      ...mockMarketValueEstimate,
      tags: ['single-owner']
    };

    render(
      <PlayerSaleHistory
        playerId="12345"
        playerName="John Doe"
        playerMetadata={mockPlayerMetadata}
        marketValueEstimate={singleOwnerEstimate}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Sale History')).toBeInTheDocument();
    });

    expect(screen.getByText('Single Owner')).toBeInTheDocument();
  });
});
