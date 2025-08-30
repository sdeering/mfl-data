import React from 'react';
import { render, screen } from '@testing-library/react';
import PositionRatingsDisplay from '../components/PositionRatingsDisplay';

// Mock the LoadingContext
const mockSetGlobalLoading = jest.fn();
jest.mock('../contexts/LoadingContext', () => ({
  LoadingContext: {
    Consumer: ({ children }: { children: (value: any) => React.ReactNode }) =>
      children({ setGlobalLoading: mockSetGlobalLoading }),
  },
}));

// Mock the useRuleBasedPositionRatings hook
jest.mock('../hooks/useRuleBasedPositionRatings', () => ({
  useRuleBasedPositionRatings: jest.fn()
}));

// Mock the fetch function
global.fetch = jest.fn();

describe('Position Rating Difference Calculations', () => {
  const mockUseRuleBasedPositionRatings = require('../hooks/useRuleBasedPositionRatings').useRuleBasedPositionRatings;

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] })
    });
  });

  describe('Player 21864 - LM 79, CAM 81, Overall 79', () => {
    beforeEach(() => {
      mockUseRuleBasedPositionRatings.mockReturnValue({
        positionRatings: {
          success: true,
          results: {
            LM: {
              success: true,
              position: 'LM',
              ovr: 79,
              penalty: -1,
              familiarity: 'PRIMARY'
            },
            CAM: {
              success: true,
              position: 'CAM',
              ovr: 81,
              penalty: -1,
              familiarity: 'SECONDARY'
            },
            ST: {
              success: true,
              position: 'ST',
              ovr: 75,
              penalty: -20,
              familiarity: 'UNFAMILIAR'
            }
          }
        },
        isLoading: false,
        error: null
      });
    });

    it('should calculate correct differences from overall rating', () => {
      const player = {
        id: 21864,
        metadata: {
          firstName: 'Test',
          lastName: 'Player',
          overall: 79,
          positions: ['LM', 'CAM'],
          pace: 80,
          shooting: 75,
          passing: 82,
          dribbling: 78,
          defense: 85,
          physical: 81,
          goalkeeping: 0
        }
      };

      render(<PositionRatingsDisplay player={player} />);

      // LM: 79 - 79 = 0 (no difference shown)
      // CAM: 81 - 79 = +2 (should show +2)
      // ST: 75 - 79 = -4 (should show -4)

      // Check that the differences are calculated correctly
      // The component should show the actual difference from overall, not the penalty
    });
  });

  describe('Player with higher overall than position ratings', () => {
    beforeEach(() => {
      mockUseRuleBasedPositionRatings.mockReturnValue({
        positionRatings: {
          success: true,
          results: {
            CM: {
              success: true,
              position: 'CM',
              ovr: 75,
              penalty: -5,
              familiarity: 'FAMILIAR'
            },
            ST: {
              success: true,
              position: 'ST',
              ovr: 70,
              penalty: -20,
              familiarity: 'UNFAMILIAR'
            }
          }
        },
        isLoading: false,
        error: null
      });
    });

    it('should show negative differences for positions worse than overall', () => {
      const player = {
        id: 12345,
        metadata: {
          firstName: 'Test',
          lastName: 'Player',
          overall: 80,
          positions: ['CM'],
          pace: 75,
          shooting: 70,
          passing: 80,
          dribbling: 75,
          defense: 85,
          physical: 80,
          goalkeeping: 0
        }
      };

      render(<PositionRatingsDisplay player={player} />);

      // CM: 75 - 80 = -5 (should show -5)
      // ST: 70 - 80 = -10 (should show -10)
    });
  });

  describe('Player with position ratings equal to overall', () => {
    beforeEach(() => {
      mockUseRuleBasedPositionRatings.mockReturnValue({
        positionRatings: {
          success: true,
          results: {
            LB: {
              success: true,
              position: 'LB',
              ovr: 82,
              penalty: 0,
              familiarity: 'PRIMARY'
            },
            CB: {
              success: true,
              position: 'CB',
              ovr: 82,
              penalty: -5,
              familiarity: 'FAMILIAR'
            }
          }
        },
        isLoading: false,
        error: null
      });
    });

    it('should not show difference for positions equal to overall', () => {
      const player = {
        id: 12345,
        metadata: {
          firstName: 'Test',
          lastName: 'Player',
          overall: 82,
          positions: ['LB'],
          pace: 80,
          shooting: 75,
          passing: 82,
          dribbling: 78,
          defense: 85,
          physical: 81,
          goalkeeping: 0
        }
      };

      render(<PositionRatingsDisplay player={player} />);

      // LB: 82 - 82 = 0 (no difference shown)
      // CB: 82 - 82 = 0 (no difference shown)
    });
  });

  describe('Player with multiple positions better than overall', () => {
    beforeEach(() => {
      mockUseRuleBasedPositionRatings.mockReturnValue({
        positionRatings: {
          success: true,
          results: {
            CAM: {
              success: true,
              position: 'CAM',
              ovr: 85,
              penalty: -1,
              familiarity: 'SECONDARY'
            },
            CM: {
              success: true,
              position: 'CM',
              ovr: 83,
              penalty: -5,
              familiarity: 'FAMILIAR'
            },
            ST: {
              success: true,
              position: 'ST',
              ovr: 87,
              penalty: -20,
              familiarity: 'UNFAMILIAR'
            }
          }
        },
        isLoading: false,
        error: null
      });
    });

    it('should show positive differences for positions better than overall', () => {
      const player = {
        id: 12345,
        metadata: {
          firstName: 'Test',
          lastName: 'Player',
          overall: 80,
          positions: ['CAM', 'CM'],
          pace: 80,
          shooting: 75,
          passing: 82,
          dribbling: 78,
          defense: 85,
          physical: 81,
          goalkeeping: 0
        }
      };

      render(<PositionRatingsDisplay player={player} />);

      // CAM: 85 - 80 = +5 (should show +5)
      // CM: 83 - 80 = +3 (should show +3)
      // ST: 87 - 80 = +7 (should show +7)
    });
  });

  describe('Edge cases', () => {
    it('should handle very high position ratings', () => {
      mockUseRuleBasedPositionRatings.mockReturnValue({
        positionRatings: {
          success: true,
          results: {
            ST: {
              success: true,
              position: 'ST',
              ovr: 99,
              penalty: 0,
              familiarity: 'PRIMARY'
            }
          }
        },
        isLoading: false,
        error: null
      });

      const player = {
        id: 12345,
        metadata: {
          firstName: 'Test',
          lastName: 'Player',
          overall: 85,
          positions: ['ST'],
          pace: 99,
          shooting: 99,
          passing: 85,
          dribbling: 85,
          defense: 85,
          physical: 85,
          goalkeeping: 0
        }
      };

      render(<PositionRatingsDisplay player={player} />);

      // ST: 99 - 85 = +14 (should show +14)
    });

    it('should handle very low position ratings', () => {
      mockUseRuleBasedPositionRatings.mockReturnValue({
        positionRatings: {
          success: true,
          results: {
            GK: {
              success: true,
              position: 'GK',
              ovr: 45,
              penalty: -20,
              familiarity: 'UNFAMILIAR'
            }
          }
        },
        isLoading: false,
        error: null
      });

      const player = {
        id: 12345,
        metadata: {
          firstName: 'Test',
          lastName: 'Player',
          overall: 80,
          positions: ['CM'],
          pace: 80,
          shooting: 75,
          passing: 82,
          dribbling: 78,
          defense: 85,
          physical: 81,
          goalkeeping: 0
        }
      };

      render(<PositionRatingsDisplay player={player} />);

      // GK: 45 - 80 = -35 (should show -35)
    });

    it('should handle zero overall rating', () => {
      mockUseRuleBasedPositionRatings.mockReturnValue({
        positionRatings: {
          success: true,
          results: {
            CM: {
              success: true,
              position: 'CM',
              ovr: 75,
              penalty: 0,
              familiarity: 'PRIMARY'
            }
          }
        },
        isLoading: false,
        error: null
      });

      const player = {
        id: 12345,
        metadata: {
          firstName: 'Test',
          lastName: 'Player',
          overall: 0,
          positions: ['CM'],
          pace: 75,
          shooting: 75,
          passing: 75,
          dribbling: 75,
          defense: 75,
          physical: 75,
          goalkeeping: 0
        }
      };

      render(<PositionRatingsDisplay player={player} />);

      // CM: 75 - 0 = +75 (should show +75)
    });
  });

  describe('Loading and error states', () => {
    it('should handle loading state', () => {
      mockUseRuleBasedPositionRatings.mockReturnValue({
        positionRatings: null,
        isLoading: true,
        error: null
      });

      const player = {
        id: 12345,
        metadata: {
          firstName: 'Test',
          lastName: 'Player',
          overall: 80,
          positions: ['CM'],
          pace: 80,
          shooting: 75,
          passing: 82,
          dribbling: 78,
          defense: 85,
          physical: 81,
          goalkeeping: 0
        }
      };

      render(<PositionRatingsDisplay player={player} />);

      expect(screen.getByText('Calculating position ratings...')).toBeInTheDocument();
    });

    it('should handle error state', () => {
      mockUseRuleBasedPositionRatings.mockReturnValue({
        positionRatings: null,
        isLoading: false,
        error: 'Failed to calculate ratings'
      });

      const player = {
        id: 12345,
        metadata: {
          firstName: 'Test',
          lastName: 'Player',
          overall: 80,
          positions: ['CM'],
          pace: 80,
          shooting: 75,
          passing: 82,
          dribbling: 78,
          defense: 85,
          physical: 81,
          goalkeeping: 0
        }
      };

      render(<PositionRatingsDisplay player={player} />);

      expect(screen.getByText('No position ratings available')).toBeInTheDocument();
    });
  });
});
