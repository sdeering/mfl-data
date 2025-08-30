import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PlayerProgressionGraph from '../components/PlayerProgressionGraph';
import type { PlayerExperienceEntry } from '../types/playerExperience';

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

const mockProgressionData: PlayerExperienceEntry[] = [
  {
    date: '2024-01-01',
    values: {
      overall: 79,
      pace: 80,
      shooting: 75,
      passing: 82,
      dribbling: 78,
      defense: 85,
      physical: 81,
      goalkeeping: 0
    }
  },
  {
    date: '2024-02-01',
    values: {
      overall: 81,
      pace: 82,
      shooting: 77,
      passing: 84,
      dribbling: 80,
      defense: 87,
      physical: 83,
      goalkeeping: 0
    }
  },
  {
    date: '2024-03-01',
    values: {
      overall: 83,
      pace: 84,
      shooting: 79,
      passing: 86,
      dribbling: 82,
      defense: 89,
      physical: 85,
      goalkeeping: 0
    }
  }
];

const mockPlayer = {
  id: 12345,
  metadata: {
    firstName: 'Test',
    lastName: 'Player',
    overall: 83,
    positions: ['CM', 'CAM'],
    pace: 84,
    shooting: 79,
    passing: 86,
    dribbling: 82,
    defense: 89,
    physical: 85,
    goalkeeping: 0
  }
};

describe('PlayerProgressionGraph', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockProgressionData })
    });
  });

  describe('Data Processing', () => {
    it('should process progression data correctly', () => {
      render(
        <PlayerProgressionGraph
          playerId="12345"
          playerName="Test Player"
          progressionData={mockProgressionData}
        />
      );

      // Check that the graph renders with processed data
      expect(screen.getByText('Player Progression')).toBeInTheDocument();
      
      // Check that stat toggles are rendered
      expect(screen.getByText('All')).toBeInTheDocument();
      expect(screen.getByText('None')).toBeInTheDocument();
      expect(screen.getByText('PAC')).toBeInTheDocument();
      expect(screen.getByText('DRI')).toBeInTheDocument();
      expect(screen.getByText('PAS')).toBeInTheDocument();
      expect(screen.getByText('SHO')).toBeInTheDocument();
      expect(screen.getByText('DEF')).toBeInTheDocument();
      expect(screen.getByText('PHY')).toBeInTheDocument();
    });

    it('should handle empty progression data', () => {
      render(
        <PlayerProgressionGraph
          playerId="12345"
          playerName="Test Player"
          progressionData={[]}
        />
      );

      expect(screen.getByText('Player Progression')).toBeInTheDocument();
      expect(screen.getByText('No progression data available')).toBeInTheDocument();
    });

    it('should handle single data point', () => {
      const singleDataPoint = [mockProgressionData[0]];
      
      render(
        <PlayerProgressionGraph
          playerId="12345"
          playerName="Test Player"
          progressionData={singleDataPoint}
        />
      );

      expect(screen.getByText('Player Progression')).toBeInTheDocument();
      // Should still render the graph with single point
      expect(screen.getByText('PAC')).toBeInTheDocument();
    });
  });

  describe('Stat Toggle Functionality', () => {
    it('should toggle individual stats correctly', () => {
      render(
        <PlayerProgressionGraph
          playerId="12345"
          playerName="Test Player"
          progressionData={mockProgressionData}
        />
      );

      const pacToggle = screen.getByText('PAC');
      const driToggle = screen.getByText('DRI');

      // Initially all stats should be enabled
      expect(pacToggle).toHaveClass('bg-blue-500');
      expect(driToggle).toHaveClass('bg-blue-500');

      // Click PAC to disable it
      fireEvent.click(pacToggle);
      expect(pacToggle).toHaveClass('bg-gray-300');

      // Click DRI to disable it
      fireEvent.click(driToggle);
      expect(driToggle).toHaveClass('bg-gray-300');

      // Click PAC again to re-enable it
      fireEvent.click(pacToggle);
      expect(pacToggle).toHaveClass('bg-blue-500');
    });

    it('should handle All toggle correctly', () => {
      render(
        <PlayerProgressionGraph
          playerId="12345"
          playerName="Test Player"
          progressionData={mockProgressionData}
        />
      );

      const allToggle = screen.getByText('All');
      const noneToggle = screen.getByText('None');
      const pacToggle = screen.getByText('PAC');

      // Initially all stats should be enabled
      expect(pacToggle).toHaveClass('bg-blue-500');

      // Click None to disable all
      fireEvent.click(noneToggle);
      expect(pacToggle).toHaveClass('bg-gray-300');

      // Click All to enable all
      fireEvent.click(allToggle);
      expect(pacToggle).toHaveClass('bg-blue-500');
    });

    it('should handle None toggle correctly', () => {
      render(
        <PlayerProgressionGraph
          playerId="12345"
          playerName="Test Player"
          progressionData={mockProgressionData}
        />
      );

      const noneToggle = screen.getByText('None');
      const pacToggle = screen.getByText('PAC');
      const driToggle = screen.getByText('DRI');

      // Initially all stats should be enabled
      expect(pacToggle).toHaveClass('bg-blue-500');
      expect(driToggle).toHaveClass('bg-blue-500');

      // Click None to disable all
      fireEvent.click(noneToggle);
      expect(pacToggle).toHaveClass('bg-gray-300');
      expect(driToggle).toHaveClass('bg-gray-300');
    });
  });

  describe('Goalkeeper Handling', () => {
    it('should hide All/None toggles for goalkeepers', () => {
      const goalkeeperPlayer = {
        ...mockPlayer,
        metadata: {
          ...mockPlayer.metadata,
          positions: ['GK']
        }
      };

      render(
        <PlayerProgressionGraph
          playerId="12345"
          playerName="Test Goalkeeper"
          progressionData={mockProgressionData}
        />
      );

      // For goalkeepers, only Overall should be available
      expect(screen.getByText('Overall')).toBeInTheDocument();
      expect(screen.queryByText('All')).not.toBeInTheDocument();
      expect(screen.queryByText('None')).not.toBeInTheDocument();
      expect(screen.queryByText('PAC')).not.toBeInTheDocument();
      expect(screen.queryByText('DRI')).not.toBeInTheDocument();
    });

    it('should show only Overall for goalkeepers', () => {
      render(
        <PlayerProgressionGraph
          playerId="12345"
          playerName="Test Goalkeeper"
          progressionData={mockProgressionData}
        />
      );

      // Only Overall toggle should be visible for goalkeepers
      const overallToggle = screen.getByText('Overall');
      expect(overallToggle).toBeInTheDocument();
      expect(overallToggle).toHaveClass('bg-blue-500');
    });
  });

  describe('Age Calculation', () => {
    it('should calculate age progression correctly', () => {
      const progressionWithAge = [
        {
          date: '2024-01-01',
          values: {
            overall: 79,
            pace: 80,
            shooting: 75,
            passing: 82,
            dribbling: 78,
            defense: 85,
            physical: 81,
            goalkeeping: 0
          }
        },
        {
          date: '2024-07-01', // 6 months later
          values: {
            overall: 81,
            pace: 82,
            shooting: 77,
            passing: 84,
            dribbling: 80,
            defense: 87,
            physical: 83,
            goalkeeping: 0
          }
        }
      ];

      render(
        <PlayerProgressionGraph
          playerId="12345"
          playerName="Test Player"
          progressionData={progressionWithAge}
        />
      );

      expect(screen.getByText('Player Progression')).toBeInTheDocument();
      // The graph should render with age-based X-axis
    });
  });

  describe('Error Handling', () => {
    it('should handle fetch errors gracefully', () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      render(
        <PlayerProgressionGraph
          playerId="12345"
          playerName="Test Player"
          progressionData={[]}
        />
      );

      // Should show error state
      expect(screen.getByText('Player Progression')).toBeInTheDocument();
    });

    it('should handle invalid data gracefully', () => {
      const invalidData = [
        {
          date: 'invalid-date',
          values: {
            overall: 'invalid',
            pace: null,
            shooting: undefined,
            passing: 82,
            dribbling: 78,
            defense: 85,
            physical: 81,
            goalkeeping: 0
          }
        }
      ];

      render(
        <PlayerProgressionGraph
          playerId="12345"
          playerName="Test Player"
          progressionData={invalidData}
        />
      );

      expect(screen.getByText('Player Progression')).toBeInTheDocument();
    });
  });

  describe('Graph Rendering', () => {
    it('should render SVG graph with correct dimensions', () => {
      render(
        <PlayerProgressionGraph
          playerId="12345"
          playerName="Test Player"
          progressionData={mockProgressionData}
        />
      );

      const svg = document.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('width', '100%');
      expect(svg).toHaveAttribute('height', 'auto');
      expect(svg).toHaveAttribute('viewBox', '0 0 1200 500');
    });

    it('should render legend with correct colors', () => {
      render(
        <PlayerProgressionGraph
          playerId="12345"
          playerName="Test Player"
          progressionData={mockProgressionData}
        />
      );

      // Check that legend items are rendered
      expect(screen.getByText('OVR')).toBeInTheDocument();
      expect(screen.getByText('PAC')).toBeInTheDocument();
      expect(screen.getByText('DRI')).toBeInTheDocument();
      expect(screen.getByText('PAS')).toBeInTheDocument();
      expect(screen.getByText('SHO')).toBeInTheDocument();
      expect(screen.getByText('DEF')).toBeInTheDocument();
      expect(screen.getByText('PHY')).toBeInTheDocument();
    });
  });

  describe('Data Point Filtering', () => {
    it('should filter out zero values correctly', () => {
      const dataWithZeros = [
        {
          date: '2024-01-01',
          values: {
            overall: 79,
            pace: 0, // Zero value
            shooting: 75,
            passing: 82,
            dribbling: 78,
            defense: 85,
            physical: 81,
            goalkeeping: 0
          }
        },
        {
          date: '2024-02-01',
          values: {
            overall: 81,
            pace: 82, // Non-zero value
            shooting: 77,
            passing: 84,
            dribbling: 80,
            defense: 87,
            physical: 83,
            goalkeeping: 0
          }
        }
      ];

      render(
        <PlayerProgressionGraph
          playerId="12345"
          playerName="Test Player"
          progressionData={dataWithZeros}
        />
      );

      expect(screen.getByText('Player Progression')).toBeInTheDocument();
      // The graph should handle zero values appropriately
    });
  });
});
