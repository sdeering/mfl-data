import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '../contexts/ThemeContext';
import PlayerStats from '../components/PlayerStats';
import type { MFLPlayer } from '../types/mflApi';

// Mock data for testing
const mockPlayer: MFLPlayer = {
  id: '116267',
  metadata: {
    firstName: 'Max',
    lastName: 'Pasquier',
    overall: 82,
    age: 26,
    height: 185,
    preferredFoot: 'Left',
    positions: ['LB'],
    pace: 84,
    shooting: 32,
    passing: 77,
    dribbling: 74,
    defense: 87,
    physical: 83,
    nationalities: ['FRANCE']
  },
  ownedBy: {
    name: 'Test Owner',
    walletAddress: '0x1234567890123456789012345678901234567890'
  }
};

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider>
    {children}
  </ThemeProvider>
);

describe('PlayerStats - Modern Theme Integration', () => {
  it('should render with theme-aware background', () => {
    const { container } = render(
      <TestWrapper>
        <PlayerStats player={mockPlayer} />
      </TestWrapper>
    );

    // Should have modern card styling
    const statsContainer = container.querySelector('.bg-white.dark\\:bg-gray-800');
    expect(statsContainer).toBeInTheDocument();
  });

  it('should display all player statistics', () => {
    render(
      <TestWrapper>
        <PlayerStats player={mockPlayer} />
      </TestWrapper>
    );

    expect(screen.getByText('Overall Rating')).toBeInTheDocument();
    expect(screen.getByText('82')).toBeInTheDocument();
    expect(screen.getByText('Country')).toBeInTheDocument();
    expect(screen.getByText('FRANCE')).toBeInTheDocument();
    expect(screen.getByText('Age')).toBeInTheDocument();
    expect(screen.getByText('26')).toBeInTheDocument();
  });

  it('should have modern spacing and layout', () => {
    const { container } = render(
      <TestWrapper>
        <PlayerStats player={mockPlayer} />
      </TestWrapper>
    );

    // Check for modern spacing classes
    const spaceContainer = container.querySelector('.space-y-3');
    expect(spaceContainer).toBeInTheDocument();
  });

  it('should have hover effects on stat items', () => {
    const { container } = render(
      <TestWrapper>
        <PlayerStats player={mockPlayer} />
      </TestWrapper>
    );

    // Check for hover effect classes
    const hoverElements = container.querySelectorAll('.hover\\:bg-gray-50');
    expect(hoverElements.length).toBeGreaterThan(0);
  });

  it('should display positions as comma-separated list', () => {
    render(
      <TestWrapper>
        <PlayerStats player={mockPlayer} />
      </TestWrapper>
    );

    expect(screen.getByText('Positions')).toBeInTheDocument();
    expect(screen.getByText('LB')).toBeInTheDocument();
  });

  it('should handle missing owner name gracefully', () => {
    const playerWithoutOwnerName = {
      ...mockPlayer,
      ownedBy: {
        walletAddress: '0x1234567890123456789012345678901234567890'
      }
    };

    render(
      <TestWrapper>
        <PlayerStats player={playerWithoutOwnerName} />
      </TestWrapper>
    );

    expect(screen.getByText('Agency')).toBeInTheDocument();
    expect(screen.getByText('0x123456...567890')).toBeInTheDocument();
  });
});
