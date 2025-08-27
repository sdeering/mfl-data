import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '../contexts/ThemeContext';
import PlayerImage from '../components/PlayerImage';
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

describe('PlayerImage - Modern Theme Integration', () => {
  it('should render player card with theme-aware container classes', () => {
    render(
      <TestWrapper>
        <PlayerImage player={mockPlayer} />
      </TestWrapper>
    );

    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('should render no player state with modern styling', () => {
    render(
      <TestWrapper>
        <PlayerImage />
      </TestWrapper>
    );

    expect(screen.getByText('No Player Data')).toBeInTheDocument();
    expect(screen.getByText('Search for a player to view their card')).toBeInTheDocument();
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('should display player name correctly', () => {
    render(
      <TestWrapper>
        <PlayerImage player={mockPlayer} />
      </TestWrapper>
    );

    expect(screen.getByText('Max')).toBeInTheDocument();
    expect(screen.getByText('Pasquier')).toBeInTheDocument();
  });

  it('should display player overall rating', () => {
    render(
      <TestWrapper>
        <PlayerImage player={mockPlayer} />
      </TestWrapper>
    );

    expect(screen.getByText('82')).toBeInTheDocument();
  });

  it('should display player position', () => {
    render(
      <TestWrapper>
        <PlayerImage player={mockPlayer} />
      </TestWrapper>
    );

    expect(screen.getByText('LB')).toBeInTheDocument();
  });

  it('should display player age', () => {
    render(
      <TestWrapper>
        <PlayerImage player={mockPlayer} />
      </TestWrapper>
    );

    expect(screen.getByText('26')).toBeInTheDocument();
  });

  it('should display all player stats', () => {
    render(
      <TestWrapper>
        <PlayerImage player={mockPlayer} />
      </TestWrapper>
    );

    // Check all stats are displayed 
    expect(screen.getByText('84')).toBeInTheDocument(); // pace
    expect(screen.getByText('32')).toBeInTheDocument(); // shooting
    expect(screen.getByText('77')).toBeInTheDocument(); // passing
    expect(screen.getByText('74')).toBeInTheDocument(); // dribbling
    expect(screen.getByText('87')).toBeInTheDocument(); // defense
    expect(screen.getByText('83')).toBeInTheDocument(); // physical
  });

  it('should have responsive width classes', () => {
    const { container } = render(
      <TestWrapper>
        <PlayerImage player={mockPlayer} />
      </TestWrapper>
    );

    const cardContainer = container.querySelector('.w-40.sm\\:w-56.md\\:w-56.xl\\:w-56');
    expect(cardContainer).toBeInTheDocument();
  });

  it('should have modern styling without hover effects', () => {
    const { container } = render(
      <TestWrapper>
        <PlayerImage player={mockPlayer} />
      </TestWrapper>
    );

    // Check for modern styling classes without hover effects
    const cardContainer = container.querySelector('.bg-white.dark\\:bg-gray-900.rounded-xl');
    expect(cardContainer).toBeInTheDocument();
  });
});
