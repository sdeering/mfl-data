import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '../contexts/ThemeContext';
import PlayerDetailsCard from '../components/PlayerDetailsCard';

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider>
    {children}
  </ThemeProvider>
);

describe('PlayerDetailsCard - Modern Theme Integration', () => {
  const mockProps = {
    playerName: 'Max Pasquier',
    playerId: '116267',
    ownerAddress: '0x1234567890123456789012345678901234567890',
    description: 'A talented left back from France'
  };

  it('should render with theme-aware background', () => {
    const { container } = render(
      <TestWrapper>
        <PlayerDetailsCard {...mockProps} />
      </TestWrapper>
    );

    // Should have modern card styling
    const cardContainer = container.querySelector('.bg-white.dark\\:bg-gray-800');
    expect(cardContainer).toBeInTheDocument();
  });

  it('should display player information correctly', () => {
    render(
      <TestWrapper>
        <PlayerDetailsCard {...mockProps} />
      </TestWrapper>
    );

    expect(screen.getAllByText('Max Pasquier')).toHaveLength(2); // appears in header and in card body
    expect(screen.getByText('116267')).toBeInTheDocument();
    expect(screen.getByText('0x1234567890123456789012345678901234567890')).toBeInTheDocument();
    expect(screen.getByText('A talented left back from France')).toBeInTheDocument();
  });

  it('should have modern hover effects', () => {
    const { container } = render(
      <TestWrapper>
        <PlayerDetailsCard {...mockProps} />
      </TestWrapper>
    );

    // Check for hover effect classes
    const hoverContainer = container.querySelector('.hover\\:shadow-xl');
    expect(hoverContainer).toBeInTheDocument();
  });

  it('should handle View on MFL button click', () => {
    // Mock window.open
    const mockOpen = jest.fn();
    Object.defineProperty(window, 'open', {
      value: mockOpen,
      writable: true
    });

    render(
      <TestWrapper>
        <PlayerDetailsCard {...mockProps} />
      </TestWrapper>
    );

    const viewButton = screen.getByText('View on MFL.com');
    fireEvent.click(viewButton);

    expect(mockOpen).toHaveBeenCalledWith('https://app.playmfl.com/players/116267', '_blank');
  });

  it('should render without description when not provided', () => {
    const propsWithoutDescription = {
      playerName: 'Max Pasquier',
      playerId: '116267',
      ownerAddress: '0x1234567890123456789012345678901234567890'
    };

    render(
      <TestWrapper>
        <PlayerDetailsCard {...propsWithoutDescription} />
      </TestWrapper>
    );

    expect(screen.getAllByText('Max Pasquier')).toHaveLength(2); // appears in header and in card body
    expect(screen.queryByText('Description')).not.toBeInTheDocument();
  });

  it('should handle missing player data gracefully', () => {
    render(
      <TestWrapper>
        <PlayerDetailsCard />
      </TestWrapper>
    );

    expect(screen.getAllByText('Unknown Player')).toHaveLength(2); // appears in header and in card body
    expect(screen.getAllByText('N/A')).toHaveLength(2); // appears in Player ID and Owner address
  });

  it('should have modern gradient effects', () => {
    const { container } = render(
      <TestWrapper>
        <PlayerDetailsCard {...mockProps} />
      </TestWrapper>
    );

    const gradientElement = container.querySelector('.bg-gradient-to-br');
    expect(gradientElement).toBeInTheDocument();
  });
});
