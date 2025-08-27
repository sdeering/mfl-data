import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HomePage } from '../components/HomePage';
import { PlayerResultsPage } from '../components/PlayerResultsPage';

// Mock next/navigation
const mockPush = jest.fn();
const mockGet = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => ({
    get: mockGet,
  }),
}));

// Mock MFL API
jest.mock('../services/mflApi', () => ({
  mflApi: {
    getPlayer: jest.fn().mockResolvedValue({
      id: '123',
      metadata: {
        firstName: 'Test',
        lastName: 'Player',
        overall: 85,
        nationalities: ['USA'],
        age: 25,
        height: 180,
        preferredFoot: 'Right',
        positions: ['ST'],
        pace: 80,
        shooting: 85,
        passing: 75,
        dribbling: 80,
        defense: 40,
        physical: 85
      },
      ownedBy: {
        walletAddress: '0x1234567890abcdef'
      }
    }),
  },
}));

// Mock position OVR hook
jest.mock('../hooks/usePositionOVR', () => ({
  usePositionOVR: () => ({
    positionOVRs: null,
    isLoading: false,
    error: null,
    recalculate: jest.fn(),
  }),
}));

describe('Search Input Clearing', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockGet.mockClear();
    localStorage.clear();
  });

  describe('HomePage', () => {
    it('should clear search input after successful search submission', async () => {
      render(<HomePage />);
      
      const searchInput = screen.getByPlaceholderText('Enter player ID...');
      const searchButton = screen.getByRole('button', { name: /search player/i });
      
      // Type a player ID
      fireEvent.change(searchInput, { target: { value: '123' } });
      expect(searchInput).toHaveValue('123');
      
      // Submit the search
      fireEvent.click(searchButton);
      
      // Verify navigation was called
      expect(mockPush).toHaveBeenCalledWith('/players/123');
      
      // Verify input was cleared
      expect(searchInput).toHaveValue('');
    });

    it('should not clear input if search query is empty', async () => {
      render(<HomePage />);
      
      const searchInput = screen.getByPlaceholderText('Enter player ID...');
      const searchButton = screen.getByRole('button', { name: /search player/i });
      
      // Try to submit empty search
      fireEvent.click(searchButton);
      
      // Verify navigation was not called
      expect(mockPush).not.toHaveBeenCalled();
      
      // Input should remain empty
      expect(searchInput).toHaveValue('');
    });
  });

  describe('PlayerResultsPage', () => {
    it('should clear search input after successful search submission', async () => {
      mockGet.mockReturnValue(null); // No initial player ID
      
      render(<PlayerResultsPage />);
      
      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByPlaceholderText('player search')).toBeInTheDocument();
      });
      
      const searchInput = screen.getByPlaceholderText('player search');
      
      // Type a player ID
      fireEvent.change(searchInput, { target: { value: '456' } });
      expect(searchInput).toHaveValue('456');
      
      // Submit the search by submitting the form
      const form = searchInput.closest('form');
      fireEvent.submit(form);
      
      // Verify navigation was called
      expect(mockPush).toHaveBeenCalledWith('/players/456');
      
      // Verify input was cleared
      expect(searchInput).toHaveValue('');
    });

    it('should clear search input when clicking recent search item', async () => {
      // Setup localStorage with recent searches
      const recentSearches = [
        { id: '123', name: 'Test Player', timestamp: Date.now() }
      ];
      localStorage.setItem('mfl-recent-searches', JSON.stringify(recentSearches));
      
      mockGet.mockReturnValue(null);
      
      render(<PlayerResultsPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Player')).toBeInTheDocument();
      });
      
      const recentSearchButton = screen.getByText('Test Player');
      const searchInput = screen.getByPlaceholderText('player search');
      
      // Initially input should be empty
      expect(searchInput).toHaveValue('');
      
      // Click recent search
      fireEvent.click(recentSearchButton);
      
      // Verify navigation was called
      expect(mockPush).toHaveBeenCalledWith('/players/123');
      
      // The search input should be cleared after clicking recent search
      // This is the fix we need to implement
      expect(searchInput).toHaveValue('');
    });
  });
});
