import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import PlayerStats from '../components/PlayerStats';
import PlayerPositions from '../components/PlayerPositions';
import type { MFLPlayer } from '../types/player';

import type { MFLPlayer as MFLAPIPlayer } from '../types/mflApi';

// Mock player data with comprehensive metadata using MFL API structure
const mockPlayerWithMetadata: MFLAPIPlayer = {
  id: 116267,
  metadata: {
    id: 116267,
    firstName: 'Max',
    lastName: 'Pasquier',
    overall: 87,
    nationalities: ['France'],
    positions: ['CAM', 'CM', 'RW'],
    preferredFoot: 'RIGHT',
    age: 25,
    height: 180,
    pace: 75,
    shooting: 80,
    passing: 85,
    dribbling: 88,
    defense: 45,
    physical: 70,
    goalkeeping: 15
  },
  ownedBy: {
    walletAddress: '0x95dc70d7d39f6f76',
    name: 'Test Owner',
    lastActive: Date.now()
  },
  ownedSince: Date.now() - 86400000, // 1 day ago
  activeContract: {
    id: 1,
    status: 'ACTIVE',
    kind: 'CONTRACT',
    revenueShare: 0.1,
    totalRevenueShareLocked: 1000,
    club: {
      id: 1,
      name: 'Test Club',
      mainColor: '#000000',
      secondaryColor: '#FFFFFF',
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

const mockPlayerMinimal: MFLAPIPlayer = {
  id: 999999,
  metadata: {
    id: 999999,
    firstName: 'Minimal',
    lastName: 'Player',
    overall: 50,
    nationalities: [],
    positions: [],
    preferredFoot: 'RIGHT',
    age: 20,
    height: 175,
    pace: 50,
    shooting: 50,
    passing: 50,
    dribbling: 50,
    defense: 50,
    physical: 50,
    goalkeeping: 50
  },
  ownedBy: {
    walletAddress: '',
    name: '',
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
      name: '',
      mainColor: '#000000',
      secondaryColor: '#FFFFFF',
      city: '',
      division: 1,
      logoVersion: '1',
      country: '',
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

describe('PlayerStats Component', () => {
  it('renders player statistics correctly', () => {
    render(<PlayerStats player={mockPlayerWithMetadata} />);
    
    // Check for the View on MFL button instead of title
    expect(screen.getByText('View on MFL.com')).toBeInTheDocument();
    expect(screen.getAllByText('Overall Rating')).toHaveLength(1); // Appears once in PlayerStats
    expect(screen.getAllByText('87')).toHaveLength(1); // Rating appears once
    expect(screen.getByText('Age')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getByText('Height')).toBeInTheDocument();
    expect(screen.getByText(/180cm/)).toBeInTheDocument();
    expect(screen.getByText('Preferred Foot')).toBeInTheDocument();
    expect(screen.getByText('RIGHT')).toBeInTheDocument();
    expect(screen.getByText('Country')).toBeInTheDocument();
    expect(screen.getByText('France')).toBeInTheDocument();
    expect(screen.getByText('Player ID')).toBeInTheDocument();
    expect(screen.getByText('Owner Agency')).toBeInTheDocument();
  });

  it('handles missing data gracefully', () => {
    render(<PlayerStats player={mockPlayerMinimal} />);
    
    expect(screen.getByText('View on MFL.com')).toBeInTheDocument();
    expect(screen.getAllByText('Not available')).toHaveLength(3); // Now 3 fields are missing (Country, Positions, Owner Agency)
  });

  it('displays overall rating with color coding', () => {
    render(<PlayerStats player={mockPlayerWithMetadata} />);
    
    // Check for the overall rating
    expect(screen.getByText('Overall Rating')).toBeInTheDocument();
    expect(screen.getByText('87')).toBeInTheDocument();
    
    // Check for the color-coded rating display
    const ratingElement = screen.getByText('87');
    expect(ratingElement).toHaveClass('text-lg', 'font-bold', 'px-2', 'py-1', 'rounded');
  });
});

describe('PlayerPositions Component', () => {
  it('renders primary and secondary positions', () => {
    render(<PlayerPositions player={mockPlayerWithMetadata} />);
    
    expect(screen.getByText('Playing Positions')).toBeInTheDocument();
    expect(screen.getByText('Primary Position')).toBeInTheDocument();
    expect(screen.getByText('CAM')).toBeInTheDocument();
    expect(screen.getByText('Central Attacking Midfielder')).toBeInTheDocument();
    expect(screen.getByText('Secondary Positions')).toBeInTheDocument();
    expect(screen.getByText('CM')).toBeInTheDocument();
    expect(screen.getByText('RW')).toBeInTheDocument();
  });

  it('displays position category averages', () => {
    render(<PlayerPositions player={mockPlayerWithMetadata} />);
    
    expect(screen.getByText('Goalkeeper')).toBeInTheDocument();
    expect(screen.getByText('Defense')).toBeInTheDocument();
    expect(screen.getByText('Midfield')).toBeInTheDocument();
    expect(screen.getByText('Attack')).toBeInTheDocument();
  });

  it('handles player without positions', () => {
    render(<PlayerPositions player={mockPlayerMinimal} />);
    
    expect(screen.getByText('Playing Positions')).toBeInTheDocument();
    // Should still show category summaries even without specific positions
    expect(screen.getByText('Goalkeeper')).toBeInTheDocument();
  });
});



describe('Metadata Components Integration', () => {
  it('all components render without errors with complete player data', () => {
    const { container } = render(
      <div>
        <PlayerStats player={mockPlayerWithMetadata} />
        <PlayerPositions player={mockPlayerWithMetadata} />
      </div>
    );
    
    expect(container).toBeInTheDocument();
    expect(screen.getByText('View on MFL.com')).toBeInTheDocument();
    expect(screen.getByText('Playing Positions')).toBeInTheDocument();
  });

  it('all components handle minimal player data gracefully', () => {
    const { container } = render(
      <div>
        <PlayerStats player={mockPlayerMinimal} />
        <PlayerPositions player={mockPlayerMinimal} />
      </div>
    );
    
    expect(container).toBeInTheDocument();
    expect(screen.getAllByText('Not available')).toHaveLength(3); // From PlayerStats (now 3 fields missing: Country, Positions, Owner Agency)
  });
});
