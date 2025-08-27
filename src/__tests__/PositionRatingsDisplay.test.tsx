import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PositionRatingsDisplay from '../components/PositionRatingsDisplay';
import type { AllPositionOVRResults } from '../types/positionOvr';

// Mock the rating colors utility
jest.mock('../utils/ratingColors', () => ({
  getRatingColors: (rating?: number) => ({
    textColor: rating && rating >= 85 ? 'text-purple-600' : rating && rating >= 75 ? 'text-blue-600' : rating && rating >= 65 ? 'text-green-600' : rating && rating >= 55 ? 'text-yellow-600' : 'text-gray-500',
    bgColor: rating && rating >= 85 ? 'bg-purple-100' : rating && rating >= 75 ? 'bg-blue-100' : rating && rating >= 65 ? 'bg-green-100' : rating && rating >= 55 ? 'bg-yellow-100' : 'bg-gray-100',
    borderColor: rating && rating >= 85 ? 'border-purple-300' : rating && rating >= 75 ? 'border-blue-300' : rating && rating >= 65 ? 'border-green-300' : rating && rating >= 55 ? 'border-yellow-300' : 'border-gray-300',
    barColor: rating && rating >= 85 ? 'bg-purple-500' : rating && rating >= 75 ? 'bg-blue-500' : rating && rating >= 65 ? 'bg-green-500' : rating && rating >= 55 ? 'bg-yellow-500' : 'bg-gray-400',
    rgbColor: rating && rating >= 85 ? 'rgb(250, 83, 255)' : rating && rating >= 75 ? 'rgb(22, 159, 237)' : rating && rating >= 65 ? 'rgb(58, 242, 75)' : rating && rating >= 55 ? 'rgb(255, 204, 0)' : 'rgb(159, 159, 159)'
  }),
  getRatingStyle: () => ({ color: 'rgb(0, 0, 0)' }),
  getRatingBgStyle: () => ({ backgroundColor: 'rgba(0, 0, 0, 0.1)' }),
  getRatingBarStyle: () => ({ backgroundColor: 'rgb(0, 0, 0)' })
}));

// Mock position OVR results for a non-GK player
const mockPositionOVRs: AllPositionOVRResults = {
  playerId: 12345,
  playerName: 'Test Player',
  primaryPosition: 'LB',
  secondaryPositions: ['LWB'],
  positions: {
    GK: { position: 'GK', ovr: 0, familiarity: 'unfamiliar', category: 'GK', penalties: { applied: -20, attributes: {} }, weights: { PAC: 0, SHO: 0, PAS: 0, DRI: 0, DEF: 0, PHY: 0 }, calculation: { weightedSum: 0, finalOVR: 0 } },
    LB: { position: 'LB', ovr: 82, familiarity: 'primary', category: 'Defense', penalties: { applied: 0, attributes: {} }, weights: { PAC: 0.2, SHO: 0.1, PAS: 0.2, DRI: 0.2, DEF: 0.2, PHY: 0.1 }, calculation: { weightedSum: 82, finalOVR: 82 } },
    LWB: { position: 'LWB', ovr: 77, familiarity: 'fairly', category: 'Defense', penalties: { applied: -5, attributes: {} }, weights: { PAC: 0.2, SHO: 0.1, PAS: 0.2, DRI: 0.2, DEF: 0.2, PHY: 0.1 }, calculation: { weightedSum: 77, finalOVR: 77 } },
    CB: { position: 'CB', ovr: 77, familiarity: 'fairly', category: 'Defense', penalties: { applied: -5, attributes: {} }, weights: { PAC: 0.1, SHO: 0.05, PAS: 0.1, DRI: 0.1, DEF: 0.5, PHY: 0.15 }, calculation: { weightedSum: 77, finalOVR: 77 } },
    RB: { position: 'RB', ovr: 77, familiarity: 'fairly', category: 'Defense', penalties: { applied: -5, attributes: {} }, weights: { PAC: 0.2, SHO: 0.1, PAS: 0.2, DRI: 0.2, DEF: 0.2, PHY: 0.1 }, calculation: { weightedSum: 77, finalOVR: 77 } },
    RWB: { position: 'RWB', ovr: 77, familiarity: 'fairly', category: 'Defense', penalties: { applied: -5, attributes: {} }, weights: { PAC: 0.2, SHO: 0.1, PAS: 0.2, DRI: 0.2, DEF: 0.2, PHY: 0.1 }, calculation: { weightedSum: 77, finalOVR: 77 } },
    CDM: { position: 'CDM', ovr: 62, familiarity: 'unfamiliar', category: 'Midfield', penalties: { applied: -20, attributes: {} }, weights: { PAC: 0.1, SHO: 0.05, PAS: 0.3, DRI: 0.1, DEF: 0.3, PHY: 0.15 }, calculation: { weightedSum: 62, finalOVR: 62 } },
    CM: { position: 'CM', ovr: 62, familiarity: 'unfamiliar', category: 'Midfield', penalties: { applied: -20, attributes: {} }, weights: { PAC: 0.1, SHO: 0.1, PAS: 0.3, DRI: 0.2, DEF: 0.1, PHY: 0.2 }, calculation: { weightedSum: 62, finalOVR: 62 } },
    CAM: { position: 'CAM', ovr: 62, familiarity: 'unfamiliar', category: 'Midfield', penalties: { applied: -20, attributes: {} }, weights: { PAC: 0.1, SHO: 0.2, PAS: 0.3, DRI: 0.2, DEF: 0.05, PHY: 0.15 }, calculation: { weightedSum: 62, finalOVR: 62 } },
    LM: { position: 'LM', ovr: 62, familiarity: 'unfamiliar', category: 'Midfield', penalties: { applied: -20, attributes: {} }, weights: { PAC: 0.2, SHO: 0.1, PAS: 0.2, DRI: 0.3, DEF: 0.1, PHY: 0.1 }, calculation: { weightedSum: 62, finalOVR: 62 } },
    RM: { position: 'RM', ovr: 62, familiarity: 'unfamiliar', category: 'Midfield', penalties: { applied: -20, attributes: {} }, weights: { PAC: 0.2, SHO: 0.1, PAS: 0.2, DRI: 0.3, DEF: 0.1, PHY: 0.1 }, calculation: { weightedSum: 62, finalOVR: 62 } },
    LW: { position: 'LW', ovr: 62, familiarity: 'unfamiliar', category: 'Midfield', penalties: { applied: -20, attributes: {} }, weights: { PAC: 0.3, SHO: 0.2, PAS: 0.1, DRI: 0.3, DEF: 0.05, PHY: 0.05 }, calculation: { weightedSum: 62, finalOVR: 62 } },
    RW: { position: 'RW', ovr: 62, familiarity: 'unfamiliar', category: 'Midfield', penalties: { applied: -20, attributes: {} }, weights: { PAC: 0.3, SHO: 0.2, PAS: 0.1, DRI: 0.3, DEF: 0.05, PHY: 0.05 }, calculation: { weightedSum: 62, finalOVR: 62 } },
    CF: { position: 'CF', ovr: 62, familiarity: 'unfamiliar', category: 'Attack', penalties: { applied: -20, attributes: {} }, weights: { PAC: 0.2, SHO: 0.3, PAS: 0.1, DRI: 0.2, DEF: 0.05, PHY: 0.15 }, calculation: { weightedSum: 62, finalOVR: 62 } },
    ST: { position: 'ST', ovr: 62, familiarity: 'unfamiliar', category: 'Attack', penalties: { applied: -20, attributes: {} }, weights: { PAC: 0.2, SHO: 0.4, PAS: 0.1, DRI: 0.1, DEF: 0.05, PHY: 0.15 }, calculation: { weightedSum: 62, finalOVR: 62 } }
  },
  categories: {
    GK: { positions: ['GK'], averageOVR: 0 },
    Defense: { positions: ['CB', 'LB', 'RB', 'LWB', 'RWB'], averageOVR: 78.2 },
    Midfield: { positions: ['CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW'], averageOVR: 62 },
    Attack: { positions: ['CF', 'ST'], averageOVR: 62 }
  },
  summary: {
    bestPosition: 'LB',
    worstPosition: 'GK',
    realisticPositions: ['LB', 'LWB', 'CB', 'RB', 'RWB'],
    averageOVR: 65.5,
    totalPositions: 15
  },
  calculatedAt: '2025-01-22T00:00:00.000Z'
};

describe('PositionRatingsDisplay', () => {
  describe('Loading State', () => {
    it('should display loading skeleton when isLoading is true', () => {
      render(<PositionRatingsDisplay positionOVRs={mockPositionOVRs} isLoading={true} />);
      
      // Check for skeleton elements
      const skeletonElements = document.querySelectorAll('.animate-pulse');
      expect(skeletonElements.length).toBeGreaterThan(0);
      
      // Check for single column layout
      const singleColumnContainer = document.querySelector('.space-y-4');
      expect(singleColumnContainer).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should display error message when error is provided', () => {
      const errorMessage = 'Failed to load position ratings';
      render(<PositionRatingsDisplay positionOVRs={mockPositionOVRs} error={errorMessage} />);
      
      expect(screen.getByText('Position Ratings')).toBeInTheDocument();
      expect(screen.getByText('Error loading position ratings')).toBeInTheDocument();
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should display empty state when no position data is available', () => {
      const emptyPositionOVRs: AllPositionOVRResults = {
        ...mockPositionOVRs,
        positions: {}
      };
      
      render(<PositionRatingsDisplay positionOVRs={emptyPositionOVRs} />);
      
      expect(screen.getByText('Position Ratings')).toBeInTheDocument();
      expect(screen.getByText('No position ratings available')).toBeInTheDocument();
    });
  });

  describe('Position Categories', () => {
    it('should display top 5 positions by default with expandable button', () => {
      render(<PositionRatingsDisplay positionOVRs={mockPositionOVRs} />);
      
      // Check for top 5 position abbreviations (sorted by rating)
      expect(screen.getByText('LB')).toBeInTheDocument(); // 82 (highest)
      expect(screen.getByText('LWB')).toBeInTheDocument(); // 77
      expect(screen.getByText('CB')).toBeInTheDocument(); // 77
      expect(screen.getByText('RB')).toBeInTheDocument(); // 77
      expect(screen.getByText('RWB')).toBeInTheDocument(); // 77
      
      // Check for expandable button
      expect(screen.getByText(/Show 10 More Positions/)).toBeInTheDocument();
      
      // Check that lower-rated positions are not visible initially
      expect(screen.queryByText('CDM')).not.toBeInTheDocument();
      expect(screen.queryByText('GK')).not.toBeInTheDocument();
    });
  });

  describe('Position Ratings', () => {
    it('should display correct OVR ratings for top 5 positions', () => {
      render(<PositionRatingsDisplay positionOVRs={mockPositionOVRs} />);
      
      expect(screen.getByText('82')).toBeInTheDocument(); // LB (primary)
      expect(screen.getAllByText('77')).toHaveLength(4); // LWB, CB, RB, RWB
      
      // Lower-rated positions should not be visible initially
      expect(screen.queryByText('62')).not.toBeInTheDocument(); // CDM, CM, CAM, etc.
      expect(screen.queryByText('0')).not.toBeInTheDocument(); // GK
    });

    it('should display primary and secondary position dots', () => {
      render(<PositionRatingsDisplay positionOVRs={mockPositionOVRs} />);
      
      // Primary position (LB) - green dot
      const primaryDot = screen.getByTitle('Primary Position');
      expect(primaryDot).toBeInTheDocument();
      expect(primaryDot).toHaveClass('bg-green-500');
      
      // Fairly familiar position (LWB) - orange dot
      const fairlyFamiliarDots = screen.getAllByTitle('Fairly Familiar Position');
      expect(fairlyFamiliarDots.length).toBeGreaterThan(0);
      expect(fairlyFamiliarDots[0]).toHaveClass('bg-orange-400');
    });
  });

  describe('Best Position Display', () => {
    it('should display positions sorted by rating (highest first)', () => {
      render(<PositionRatingsDisplay positionOVRs={mockPositionOVRs} />);
      
      // The component sorts positions by rating, so LB (82) should appear first
      const positionElements = screen.getAllByRole('listitem');
      const firstPosition = positionElements[0];
      expect(firstPosition).toHaveTextContent('LB');
      expect(firstPosition).toHaveTextContent('82');
    });
  });

  describe('Summary Statistics', () => {
    it('should display top 5 positions in a single column layout', () => {
      render(<PositionRatingsDisplay positionOVRs={mockPositionOVRs} />);
      
      // Check that positions are displayed in a single column
      const singleColumnContainer = document.querySelector('.space-y-3');
      expect(singleColumnContainer).toBeInTheDocument();
      
      // Check that only top 5 positions are displayed initially
      const positionElements = screen.getAllByRole('listitem');
      expect(positionElements).toHaveLength(5);
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles for top 5 positions', () => {
      render(<PositionRatingsDisplay positionOVRs={mockPositionOVRs} />);
      
      // Check for listitem roles
      const listItems = screen.getAllByRole('listitem');
      expect(listItems.length).toBe(5); // Top 5 positions
      
      // Check for aria-labels on rating elements
      const ratingElements = screen.getAllByLabelText(/Rating: \d+/);
      expect(ratingElements.length).toBe(5); // Top 5 positions have rating labels
      
      // Check for expandable button accessibility
      const expandButton = screen.getByRole('button', { name: /Show 10 More Positions/ });
      expect(expandButton).toHaveAttribute('aria-expanded', 'false');
      expect(expandButton).toHaveAttribute('aria-controls', 'remaining-positions');
    });
  });

  describe('Responsive Design', () => {
    it('should have single column layout classes', () => {
      render(<PositionRatingsDisplay positionOVRs={mockPositionOVRs} />);
      
      const singleColumnContainer = document.querySelector('.space-y-3');
      expect(singleColumnContainer).toBeInTheDocument();
    });
  });

  describe('Expandable Functionality', () => {
    it('should expand to show all positions when button is clicked', () => {
      render(<PositionRatingsDisplay positionOVRs={mockPositionOVRs} />);
      
      // Initially only top 5 positions should be visible
      expect(screen.getAllByRole('listitem')).toHaveLength(5);
      expect(screen.queryByText('CDM')).not.toBeInTheDocument();
      expect(screen.queryByText('GK')).not.toBeInTheDocument();
      
      // Click the expand button
      const expandButton = screen.getByRole('button', { name: /Show 10 More Positions/ });
      fireEvent.click(expandButton);
      
      // Now all 15 positions should be visible
      expect(screen.getAllByRole('listitem')).toHaveLength(15);
      expect(screen.getByText('CDM')).toBeInTheDocument();
      expect(screen.getByText('GK')).toBeInTheDocument();
      
      // Button should now say "Show Less"
      expect(screen.getByRole('button', { name: /Show Less/ })).toBeInTheDocument();
    });

    it('should collapse back to top 5 when "Show Less" is clicked', () => {
      render(<PositionRatingsDisplay positionOVRs={mockPositionOVRs} />);
      
      // Expand first
      const expandButton = screen.getByRole('button', { name: /Show 10 More Positions/ });
      fireEvent.click(expandButton);
      
      // Verify expanded
      expect(screen.getAllByRole('listitem')).toHaveLength(15);
      
      // Click "Show Less"
      const collapseButton = screen.getByRole('button', { name: /Show Less/ });
      fireEvent.click(collapseButton);
      
      // Should be back to top 5
      expect(screen.getAllByRole('listitem')).toHaveLength(5);
      expect(screen.queryByText('CDM')).not.toBeInTheDocument();
      expect(screen.queryByText('GK')).not.toBeInTheDocument();
      
      // Button should say "Show 10 More Positions" again
      expect(screen.getByRole('button', { name: /Show 10 More Positions/ })).toBeInTheDocument();
    });
  });

  describe('Color Coding', () => {
    it('should apply correct color classes to rating numbers', () => {
      render(<PositionRatingsDisplay positionOVRs={mockPositionOVRs} />);
      
      // Check that rating numbers have color classes applied
      const ratingElements = screen.getAllByText(/\d+/);
      ratingElements.forEach(element => {
        if (element.textContent && /^(82|77|62|0)$/.test(element.textContent)) {
          expect(element).toHaveClass(/text-(purple|blue|green|yellow|gray)-600|text-gray-500/);
        }
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing position data gracefully', () => {
      const incompletePositionOVRs: AllPositionOVRResults = {
        ...mockPositionOVRs,
        positions: {
          LB: mockPositionOVRs.positions.LB,
          LWB: mockPositionOVRs.positions.LWB
        }
      };
      
      render(<PositionRatingsDisplay positionOVRs={incompletePositionOVRs} />);
      
      // Should still display the available positions
      expect(screen.getByText('LB')).toBeInTheDocument();
      expect(screen.getByText('LWB')).toBeInTheDocument();
      
      // Should not crash or display undefined positions
      // Check that only the available positions are shown
      expect(screen.queryByText('CB')).not.toBeInTheDocument();
    });

    it('should handle empty positions object', () => {
      const emptyPositionOVRs: AllPositionOVRResults = {
        ...mockPositionOVRs,
        positions: {}
      };
      
      render(<PositionRatingsDisplay positionOVRs={emptyPositionOVRs} />);
      
      expect(screen.getByText('No position ratings available')).toBeInTheDocument();
    });
  });

  describe('Sorting by Display Rating', () => {
    it('should sort top 5 positions by display rating (highest first)', () => {
      render(
        <PositionRatingsDisplay
          positionOVRs={mockPositionOVRs}
          overall={82}
        />
      );

      // Get all position rating elements (should be top 5)
      const positionElements = screen.getAllByRole('listitem');
      expect(positionElements).toHaveLength(5);
      
      // Extract the ratings from the elements by looking for the rating span
      const ratings = positionElements.map(element => {
        const ratingSpan = element.querySelector('[aria-label^="Rating:"]');
        const ratingText = ratingSpan?.textContent;
        return ratingText ? parseInt(ratingText, 10) : 0;
      });

      // Verify the ratings are in descending order
      for (let i = 0; i < ratings.length - 1; i++) {
        expect(ratings[i]).toBeGreaterThanOrEqual(ratings[i + 1]);
      }

      // Verify primary position (LB = 82) appears first
      expect(ratings[0]).toBe(82);
      
      // Verify all top 5 positions have rating 77 (LWB, CB, RB, RWB)
      expect(ratings.slice(1)).toEqual([77, 77, 77, 77]);
    });

    it('should show GK position for non-GK players with 0 rating in expanded view', () => {
      render(
        <PositionRatingsDisplay
          positionOVRs={mockPositionOVRs}
          overall={82}
        />
      );

      // GK should not be visible initially (not in top 5)
      expect(screen.queryByText('GK')).not.toBeInTheDocument();
      
      // Click the expand button
      const expandButton = screen.getByRole('button', { name: /Show 10 More Positions/ });
      fireEvent.click(expandButton);
      
      // Now GK should be visible
      expect(screen.getByText('GK')).toBeInTheDocument();
      expect(screen.getByLabelText('Rating: 0')).toBeInTheDocument();
    });

    it('should apply correct background colors based on rating difference', () => {
      render(
        <PositionRatingsDisplay
          positionOVRs={mockPositionOVRs}
          overall={82}
        />
      );

      // LB (82) should have light green background (within 5 of overall)
      const lbElement = screen.getByText('LB').closest('[role="listitem"]');
      expect(lbElement).toHaveClass('bg-green-50');

      // LWB (77) should have light green background (within 5 of overall)
      const lwbElement = screen.getByText('LWB').closest('[role="listitem"]');
      expect(lwbElement).toHaveClass('bg-green-50');

      // CDM (62) should have light red background (more than 10 below overall) - in expanded view
      expect(screen.queryByText('CDM')).not.toBeInTheDocument(); // Not visible initially
      
      // Click the expand button
      const expandButton = screen.getByRole('button', { name: /Show 10 More Positions/ });
      fireEvent.click(expandButton);
      
      // Now CDM should be visible with red background
      const cdmElement = screen.getByText('CDM').closest('[role="listitem"]');
      expect(cdmElement).toHaveClass('bg-red-50');
    });
  });
});
