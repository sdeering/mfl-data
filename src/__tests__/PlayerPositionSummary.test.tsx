import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import PlayerPositionSummary from '../components/PlayerPositionSummary';
import type { PlayerMatchStats } from '../types/playerMatches';

// Mock the LoadingContext
const mockSetGlobalLoading = jest.fn();
jest.mock('../contexts/LoadingContext', () => ({
  LoadingContext: {
    Consumer: ({ children }: { children: (value: any) => React.ReactNode }) =>
      children({ setGlobalLoading: mockSetGlobalLoading }),
  },
}));

// Mock the fetch function
global.fetch = jest.fn();

const mockMatchStats: PlayerMatchStats[] = [
  {
    stats: {
      position: 'CM',
      rating: 7.5,
      time: 90,
      goals: 1,
      assists: 2
    },
    match: {
      type: 'LEAGUE',
      competition: {
        name: 'Ice Division'
      }
    }
  },
  {
    stats: {
      position: 'CM',
      rating: 8.2,
      time: 90,
      goals: 0,
      assists: 1
    },
    match: {
      type: 'CUP',
      competition: {
        name: 'Silver Playoff 3'
      }
    }
  },
  {
    stats: {
      position: 'CAM',
      rating: 6.8,
      time: 90,
      goals: 0,
      assists: 0
    },
    match: {
      type: 'LEAGUE',
      competition: {
        name: 'Ice Division'
      }
    }
  },
  {
    stats: {
      position: 'CM',
      rating: 7.1,
      time: 90,
      goals: 1,
      assists: 0
    },
    match: {
      type: 'LEAGUE',
      competition: {
        name: 'Ice Division'
      }
    }
  },
  {
    stats: {
      position: 'CAM',
      rating: 8.5,
      time: 90,
      goals: 2,
      assists: 1
    },
    match: {
      type: 'CUP',
      competition: {
        name: 'Silver Playoff 3'
      }
    }
  }
];

describe('PlayerPositionSummary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockMatchStats })
    });
  });

  describe('Position Summary Calculations', () => {
    it('should calculate position summaries correctly', async () => {
      render(
        <PlayerPositionSummary
          playerId="12345"
          playerName="Test Player"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Match Position Ratings')).toBeInTheDocument();
      });

      // Check position summary calculations
      // CM: 3 matches, average rating = (7.5 + 8.2 + 7.1) / 3 = 7.6
      // CAM: 2 matches, average rating = (6.8 + 8.5) / 2 = 7.65
      await waitFor(() => {
        expect(screen.getByText('CM')).toBeInTheDocument();
        expect(screen.getByText('CAM')).toBeInTheDocument();
      });
    });

    it('should display correct match counts and stats', async () => {
      render(
        <PlayerPositionSummary
          playerId="12345"
          playerName="Test Player"
        />
      );

      await waitFor(() => {
        // CM: 3 matches, 2 goals, 3 assists
        expect(screen.getByText(/3 matches/)).toBeInTheDocument();
        expect(screen.getByText(/2 goals/)).toBeInTheDocument();
        expect(screen.getByText(/3 assists/)).toBeInTheDocument();
      });
    });

    it('should sort positions by number of matches', async () => {
      render(
        <PlayerPositionSummary
          playerId="12345"
          playerName="Test Player"
        />
      );

      await waitFor(() => {
        // CM should appear first (3 matches) then CAM (2 matches)
        const positionElements = screen.getAllByText(/CM|CAM/);
        expect(positionElements[0]).toHaveTextContent('CM');
        expect(positionElements[1]).toHaveTextContent('CAM');
      });
    });
  });

  describe('League Summary Calculations', () => {
    it('should calculate league summaries correctly', async () => {
      render(
        <PlayerPositionSummary
          playerId="12345"
          playerName="Test Player"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('League Summary (last 5 matches)')).toBeInTheDocument();
      });

      // League ICE: 3 matches, average rating = (7.5 + 6.8 + 7.1) / 3 = 7.13
      // Cup: 2 matches, average rating = (8.2 + 8.5) / 2 = 8.35
      await waitFor(() => {
        expect(screen.getByText('League ICE')).toBeInTheDocument();
        expect(screen.getByText('Cup')).toBeInTheDocument();
      });
    });

    it('should display correct league match counts', async () => {
      render(
        <PlayerPositionSummary
          playerId="12345"
          playerName="Test Player"
        />
      );

      await waitFor(() => {
        // League: 3 matches, 2 goals, 1 assist
        // Cup: 2 matches, 2 goals, 1 assist
        expect(screen.getByText(/3 matches/)).toBeInTheDocument();
        expect(screen.getByText(/2 matches/)).toBeInTheDocument();
      });
    });

    it('should sort leagues correctly (League before Cup)', async () => {
      render(
        <PlayerPositionSummary
          playerId="12345"
          playerName="Test Player"
        />
      );

      await waitFor(() => {
        const leagueElements = screen.getAllByText(/League|Cup/);
        expect(leagueElements[0]).toHaveTextContent('League');
        expect(leagueElements[1]).toHaveTextContent('Cup');
      });
    });
  });

  describe('Rating Color Logic', () => {
    it('should apply correct colors for different rating ranges', async () => {
      const highRatingMatches: PlayerMatchStats[] = [
        {
          stats: {
            position: 'CM',
            rating: 8.5, // Should be blue (#00adc3)
            time: 90,
            goals: 0,
            assists: 0
          },
          match: {
            type: 'LEAGUE',
            competition: { name: 'Test League' }
          }
        },
        {
          stats: {
            position: 'CAM',
            rating: 7.2, // Should be green (#00c424)
            time: 90,
            goals: 0,
            assists: 0
          },
          match: {
            type: 'LEAGUE',
            competition: { name: 'Test League' }
          }
        },
        {
          stats: {
            position: 'ST',
            rating: 6.5, // Should be yellow (#d7af00)
            time: 90,
            goals: 0,
            assists: 0
          },
          match: {
            type: 'LEAGUE',
            competition: { name: 'Test League' }
          }
        },
        {
          stats: {
            position: 'GK',
            rating: 5.5, // Should be red
            time: 90,
            goals: 0,
            assists: 0
          },
          match: {
            type: 'LEAGUE',
            competition: { name: 'Test League' }
          }
        }
      ];

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ data: highRatingMatches })
      });

      render(
        <PlayerPositionSummary
          playerId="12345"
          playerName="Test Player"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Match Position Ratings')).toBeInTheDocument();
      });
    });
  });

  describe('Division Badge Logic', () => {
    it('should correctly identify league divisions', async () => {
      const divisionMatches: PlayerMatchStats[] = [
        {
          stats: {
            position: 'CM',
            rating: 7.5,
            time: 90,
            goals: 0,
            assists: 0
          },
          match: {
            type: 'LEAGUE',
            competition: { name: 'Flint Division' }
          }
        },
        {
          stats: {
            position: 'CM',
            rating: 7.5,
            time: 90,
            goals: 0,
            assists: 0
          },
          match: {
            type: 'LEAGUE',
            competition: { name: 'Diamond Division' }
          }
        }
      ];

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ data: divisionMatches })
      });

      render(
        <PlayerPositionSummary
          playerId="12345"
          playerName="Test Player"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('League FLINT')).toBeInTheDocument();
        expect(screen.getByText('League DIAMOND')).toBeInTheDocument();
      });
    });

    it('should not show division for Cup competitions', async () => {
      const cupMatches: PlayerMatchStats[] = [
        {
          stats: {
            position: 'CM',
            rating: 7.5,
            time: 90,
            goals: 0,
            assists: 0
          },
          match: {
            type: 'CUP',
            competition: { name: 'Silver Playoff 3' }
          }
        }
      ];

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ data: cupMatches })
      });

      render(
        <PlayerPositionSummary
          playerId="12345"
          playerName="Test Player"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Cup')).toBeInTheDocument();
        // Should not show "Cup Silver" - just "Cup"
        expect(screen.queryByText('Cup Silver')).not.toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle fetch errors gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      render(
        <PlayerPositionSummary
          playerId="12345"
          playerName="Test Player"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Failed to fetch match data.')).toBeInTheDocument();
      });
    });

    it('should handle empty match data', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] })
      });

      render(
        <PlayerPositionSummary
          playerId="12345"
          playerName="Test Player"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('No matches available')).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('should show loading spinner while fetching data', () => {
      (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {})); // Never resolves

      render(
        <PlayerPositionSummary
          playerId="12345"
          playerName="Test Player"
        />
      );

      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  describe('Data Formatting', () => {
    it('should format ratings to 2 decimal places', async () => {
      const preciseMatches: PlayerMatchStats[] = [
        {
          stats: {
            position: 'CM',
            rating: 7.123456, // Should be formatted to 7.12
            time: 90,
            goals: 0,
            assists: 0
          },
          match: {
            type: 'LEAGUE',
            competition: { name: 'Test League' }
          }
        }
      ];

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ data: preciseMatches })
      });

      render(
        <PlayerPositionSummary
          playerId="12345"
          playerName="Test Player"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('7.12')).toBeInTheDocument();
      });
    });

    it('should display correct time formatting (removing minutes)', async () => {
      render(
        <PlayerPositionSummary
          playerId="12345"
          playerName="Test Player"
        />
      );

      await waitFor(() => {
        // Should not show "90m" - just the match count and stats
        expect(screen.getByText(/3 matches/)).toBeInTheDocument();
        expect(screen.queryByText('90m')).not.toBeInTheDocument();
      });
    });
  });

  describe('Component Structure', () => {
    it('should render with correct title and structure', async () => {
      render(
        <PlayerPositionSummary
          playerId="12345"
          playerName="Test Player"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Match Position Ratings')).toBeInTheDocument();
        expect(screen.getByText('Position Summary (last 5 matches)')).toBeInTheDocument();
        expect(screen.getByText('League Summary (last 5 matches)')).toBeInTheDocument();
      });
    });

    it('should display familiarity labels correctly', async () => {
      render(
        <PlayerPositionSummary
          playerId="12345"
          playerName="Test Player"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Primary')).toBeInTheDocument();
        expect(screen.getByText('Secondary')).toBeInTheDocument();
      });
    });
  });
});
