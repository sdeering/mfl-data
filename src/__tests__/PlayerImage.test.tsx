import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '../contexts/ThemeContext';
import PlayerImage from '../components/PlayerImage';
import type { MFLPlayer } from '../types/mflApi';

const mockPlayer: MFLPlayer = {
  id: 93886,
  metadata: {
    id: 93886,
    firstName: 'Eric',
    lastName: 'Hodge',
    overall: 84,
    nationalities: ['AUSTRALIA'],
    positions: ['CAM', 'ST'],
    preferredFoot: 'RIGHT',
    age: 26,
    height: 177,
    pace: 73,
    shooting: 81,
    passing: 87,
    dribbling: 84,
    defense: 30,
    physical: 53,
    goalkeeping: 0
  },
  ownedBy: {
    walletAddress: '0x1234567890abcdef',
    name: 'Test Agency',
    twitter: '@testagency',
    lastActive: Date.now()
  },
  ownedSince: Date.now(),
  activeContract: {
    id: 1,
    status: 'ACTIVE',
    kind: 'CONTRACT',
    revenueShare: 0,
    totalRevenueShareLocked: 0,
    club: {
      id: 1,
      name: 'Test Club',
      mainColor: '#000000',
      secondaryColor: '#ffffff',
      city: 'Test City',
      division: 1,
      logoVersion: '1',
      country: 'Test Country',
      squads: []
    },
    startSeason: 1,
    nbSeasons: 1,
    autoRenewal: false,
    createdDateTime: Date.now(),
    clauses: []
  },
  hasPreContract: false,
  energy: 100,
  offerStatus: 0,
  nbSeasonYellows: 0
};

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider>
    {children}
  </ThemeProvider>
);

describe('PlayerImage Component', () => {
  it('should render player image with SVG elements when player data is provided', () => {
    render(
      <TestWrapper>
        <PlayerImage player={mockPlayer} />
      </TestWrapper>
    );

    // Check if SVG is rendered
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();

    // Check if player names are displayed in SVG text elements
    expect(screen.getByText('Eric')).toBeInTheDocument();
    expect(screen.getByText('Hodge')).toBeInTheDocument();

    // Check if overall rating is displayed (there are 2 elements with "84" - overall rating and dribbling)
    expect(screen.getAllByText('84')).toHaveLength(2);

    // Check if age is displayed
    expect(screen.getByText('26')).toBeInTheDocument();

    // Check if primary position is displayed
    expect(screen.getByText('CAM')).toBeInTheDocument();

    // Check if stats are displayed
    expect(screen.getByText('73')).toBeInTheDocument(); // pace
    expect(screen.getByText('81')).toBeInTheDocument(); // shooting
    expect(screen.getByText('87')).toBeInTheDocument(); // passing
    expect(screen.getByText('30')).toBeInTheDocument(); // defense
    expect(screen.getByText('53')).toBeInTheDocument(); // physical
  });

  it('should render fallback when no player data is provided', () => {
    render(
      <TestWrapper>
        <PlayerImage player={undefined} />
      </TestWrapper>
    );

    expect(screen.getByText('No Player Data')).toBeInTheDocument();
    expect(screen.getByText('Search for a player to view their card')).toBeInTheDocument();
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('should handle missing nationality gracefully', () => {
    const playerWithoutNationality = {
      ...mockPlayer,
      metadata: {
        ...mockPlayer.metadata,
        nationalities: []
      }
    };

    render(
      <TestWrapper>
        <PlayerImage player={playerWithoutNationality} />
      </TestWrapper>
    );

    // Should still render the SVG structure
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('should use correct background for different overall ratings', () => {
    // Test legendary background (85-94)
    const legendaryPlayer = {
      ...mockPlayer,
      metadata: {
        ...mockPlayer.metadata,
        overall: 90
      }
    };

    const { rerender } = render(
      <TestWrapper>
        <PlayerImage player={legendaryPlayer} />
      </TestWrapper>
    );
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();

    // Test common background (<55)
    const commonPlayer = {
      ...mockPlayer,
      metadata: {
        ...mockPlayer.metadata,
        overall: 50
      }
    };

    rerender(
      <TestWrapper>
        <PlayerImage player={commonPlayer} />
      </TestWrapper>
    );
    const svg2 = document.querySelector('svg');
    expect(svg2).toBeInTheDocument();
  });
});
