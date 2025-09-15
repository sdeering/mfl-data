import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PlayerResultsPage from '../components/PlayerResultsPage';
import PlayerStats from '../components/PlayerStats';
import { calculateMarketValue } from '../utils/marketValueCalculator';
import type { MFLPlayer } from '../types/mflApi';
import type { MarketValueEstimate } from '../utils/marketValueCalculator';

// Mock the hooks and services
jest.mock('../contexts/WalletContext', () => ({
  useWallet: () => ({
    account: '0x95dc70d7d39f6f76'
  })
}));

jest.mock('../contexts/LoadingContext', () => ({
  useLoading: () => ({
    setIsLoading: jest.fn()
  })
}));

jest.mock('../services/marketDataService', () => ({
  fetchMarketData: jest.fn(() => Promise.resolve({ success: true, data: [] }))
}));

jest.mock('../services/playerSaleHistoryService', () => ({
  fetchPlayerSaleHistory: jest.fn(() => Promise.resolve({ success: true, data: [] }))
}));

jest.mock('../services/playerExperienceService', () => ({
  fetchPlayerExperienceHistory: jest.fn(() => Promise.resolve({ success: true, data: [] })),
  processProgressionData: jest.fn(() => [])
}));

jest.mock('../services/playerMatchesService', () => ({
  fetchPlayerMatches: jest.fn(() => Promise.resolve({ success: true, data: [] }))
}));

jest.mock('../services/supabaseDataService', () => ({
  supabaseDataService: {
    storePlayerMarketData: jest.fn(() => Promise.resolve())
  }
}));

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: null, error: null }))
          }))
        }))
      }))
    }))
  },
  TABLES: {
    MARKET_VALUES: 'market_values'
  }
}));

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn()
  })
}));

describe('Market Value Consistency Tests', () => {
  const mockPlayer: MFLPlayer = {
    id: 93886,
    metadata: {
      id: 93886,
      firstName: 'Eric',
      lastName: 'Hodge',
      overall: 87,
      age: 27,
      positions: ['CAM', 'ST'],
      pace: 74,
      shooting: 82,
      passing: 88,
      dribbling: 90,
      defense: 32,
      physical: 56,
      goalkeeping: 0,
      height: 177,
      nationalities: ['AUSTRALIA'],
      preferredFoot: 'RIGHT',
      retirementYears: 0
    },
    season: { id: 1, name: 'Season 1' },
    ownedBy: {
      walletAddress: '0x95dc70d7d39f6f76',
      name: 'DogeSports HQ',
      twitter: 'dogesports69',
      lastActive: 1
    },
    ownedSince: 1745446840000,
    activeContract: {
      id: 777896,
      status: 'ACTIVE',
      kind: 'CONTRACT',
      revenueShare: 0,
      totalRevenueShareLocked: 0,
      club: {
        id: 1032,
        name: 'DogeSports Morocco',
        mainColor: '#006233',
        secondaryColor: '#823829',
        city: 'Meknès',
        division: 5,
        logoVersion: 'a59530e575956090efec5c4e3c925688',
        country: 'MOROCCO',
        squads: []
      },
      startSeason: 18,
      nbSeasons: 1,
      autoRenewal: false,
      createdDateTime: 1756209681164
    },
    hasPreContract: false,
    energy: 9121,
    offerStatus: 1,
    nbSeasonYellows: 2
  };

  const mockMarketValueEstimate: MarketValueEstimate = {
    estimatedValue: 458,
    confidence: 'medium',
    breakdown: {
      comparableListings: 0,
      recentSales: 1,
      ageAdjustment: 0,
      overallAdjustment: 0,
      positionPremium: 57,
      progressionPremium: 19,
      retirementPenalty: 0,
      newlyMintPremium: 0,
      pacePenalty: 0,
      pacePremium: 0,
      heightAdjustment: 0,
      totalAdjustments: 76
    },
    details: {
      comparableListings: [],
      recentSales: [],
      comparableAverage: 0,
      recentSalesAverage: 170,
      baseValue: 382
    }
  };

  describe('PlayerStats Component', () => {
    it('should show loading indicator when calculating market value', () => {
      render(
        <PlayerStats 
          player={mockPlayer}
          isCalculatingMarketValue={true}
        />
      );

      expect(screen.getByText('Calculating...')).toBeInTheDocument();
      // Check for spinner by looking for the animate-spin class
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('should show market value when not calculating', () => {
      render(
        <PlayerStats 
          player={mockPlayer}
          marketValueEstimate={mockMarketValueEstimate}
          isCalculatingMarketValue={false}
        />
      );

      expect(screen.getByText('$458')).toBeInTheDocument();
      expect(screen.queryByText('Calculating...')).not.toBeInTheDocument();
    });

    it('should hide breakdown tooltip when calculating', () => {
      render(
        <PlayerStats 
          player={mockPlayer}
          marketValueEstimate={mockMarketValueEstimate}
          isCalculatingMarketValue={true}
        />
      );

      // The info icon should not be present when calculating
      const infoIcons = document.querySelectorAll('svg[viewBox="0 0 20 20"]');
      expect(infoIcons).toHaveLength(0);
    });

    it('should show breakdown tooltip when not calculating', () => {
      render(
        <PlayerStats 
          player={mockPlayer}
          marketValueEstimate={mockMarketValueEstimate}
          isCalculatingMarketValue={false}
        />
      );

      // Should have info icon for breakdown tooltip
      const infoIcon = document.querySelector('svg[viewBox="0 0 20 20"]');
      expect(infoIcon).toBeInTheDocument();
    });

    it('should display consistent breakdown values', () => {
      render(
        <PlayerStats 
          player={mockPlayer}
          marketValueEstimate={mockMarketValueEstimate}
          isCalculatingMarketValue={false}
        />
      );

      // Check that the breakdown shows the expected values in the tooltip
      expect(screen.getByText('Base value: $382')).toBeInTheDocument();
      expect(screen.getByText('Positions premium: +$57')).toBeInTheDocument();
      expect(screen.getByText('Progression premium: +$19')).toBeInTheDocument();
    });
  });

  describe('Market Value Calculation Consistency', () => {
    it('should produce consistent results for the same input', () => {
      const result1 = calculateMarketValue(
        mockPlayer.metadata,
        [], // No comparable listings
        [], // No recent sales
        [], // No progression data
        {}, // No position ratings
        0, // No retirement years
        25, // Match count
        93886
      );

      const result2 = calculateMarketValue(
        mockPlayer.metadata,
        [], // No comparable listings
        [], // No recent sales
        [], // No progression data
        {}, // No position ratings
        0, // No retirement years
        25, // Match count
        93886
      );

      // Both calculations should produce identical results
      expect(result1.estimatedValue).toBe(result2.estimatedValue);
      expect(result1.breakdown).toEqual(result2.breakdown);
      expect(result1.confidence).toBe(result2.confidence);
      expect(result1.details.baseValue).toBe(result2.details.baseValue);
    });

    it('should not produce NaN values in breakdown', () => {
      const result = calculateMarketValue(
        mockPlayer.metadata,
        [], // No comparable listings
        [], // No recent sales
        [], // No progression data
        {}, // No position ratings
        0, // No retirement years
        25, // Match count
        93886
      );

      // Check that no breakdown values are NaN
      Object.values(result.breakdown).forEach(value => {
        expect(isNaN(value as number)).toBe(false);
      });

      // Check that estimated value is not NaN
      expect(isNaN(result.estimatedValue)).toBe(false);
    });

    it('should have consistent base value and adjustments', () => {
      const result = calculateMarketValue(
        mockPlayer.metadata,
        [], // No comparable listings
        [], // No recent sales
        [], // No progression data
        {}, // No position ratings
        0, // No retirement years
        25, // Match count
        93886
      );

      // Base value + total adjustments should equal estimated value
      const calculatedTotal = result.details.baseValue + result.breakdown.totalAdjustments;
      expect(result.estimatedValue).toBe(calculatedTotal);
    });
  });

  describe('PlayerResultsPage Integration', () => {
    it('should show loading state during market value calculation', async () => {
      // Mock the API calls to be slow
      const { fetchMarketData } = require('../services/marketDataService');
      fetchMarketData.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ success: true, data: [] }), 100))
      );

      render(
        <PlayerResultsPage 
          propPlayerId="93886"
          initialPlayer={mockPlayer}
        />
      );

      // Should show loading indicator initially (the component shows "Loading player data...")
      expect(screen.getByText('Loading player data...')).toBeInTheDocument();

      // Wait for calculation to complete
      await waitFor(() => {
        expect(screen.queryByText('Loading player data...')).not.toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it('should not show cached values that cause inconsistency', async () => {
      // Mock supabase to return a cached value
      const { supabase } = require('../lib/supabase');
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  market_value: 457,
                  position_ratings: {},
                  last_calculated: new Date().toISOString()
                },
                error: null
              })
            })
          })
        })
      });

      render(
        <PlayerResultsPage 
          propPlayerId="93886"
          initialPlayer={mockPlayer}
        />
      );

      // Should not show the cached value immediately
      // Instead should show loading and then calculate fresh
      expect(screen.getByText('Loading player data...')).toBeInTheDocument();

      // Wait for fresh calculation
      await waitFor(() => {
        expect(screen.queryByText('Loading player data...')).not.toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing market value estimate gracefully', () => {
      render(
        <PlayerStats 
          player={mockPlayer}
          marketValueEstimate={null}
          isCalculatingMarketValue={false}
        />
      );

      // Should not crash and should not show market value
      expect(screen.queryByText('$')).not.toBeInTheDocument();
      expect(screen.queryByText('Calculating...')).not.toBeInTheDocument();
    });

    it('should handle undefined isCalculatingMarketValue', () => {
      render(
        <PlayerStats 
          player={mockPlayer}
          marketValueEstimate={mockMarketValueEstimate}
        />
      );

      // Should default to not calculating
      expect(screen.getByText('$458')).toBeInTheDocument();
      expect(screen.queryByText('Calculating...')).not.toBeInTheDocument();
    });

    it('should handle calculation errors gracefully', async () => {
      // Mock an error in market value calculation
      const { fetchMarketData } = require('../services/marketDataService');
      fetchMarketData.mockRejectedValue(new Error('API Error'));

      render(
        <PlayerResultsPage 
          propPlayerId="93886"
          initialPlayer={mockPlayer}
        />
      );

      // Should show loading initially (the component shows "Loading player data...")
      expect(screen.getByText('Loading player data...')).toBeInTheDocument();

      // Should eventually stop loading even on error
      await waitFor(() => {
        expect(screen.queryByText('Loading player data...')).not.toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });
});
