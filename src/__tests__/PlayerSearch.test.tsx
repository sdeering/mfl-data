import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PlayerSearch from '@/src/components/PlayerSearch';
import { searchMFLPlayerById } from '@/src/services/mflApi';

// Mock the API service
jest.mock('@/src/services/mflApi', () => ({
  searchMFLPlayerById: jest.fn(),
}));

// Mock the PlayerDetails component
jest.mock('@/src/components/PlayerDetails', () => {
  return function MockPlayerDetails(props: any) {
    if (props.isLoading) return React.createElement('div', { 'data-testid': 'loading' }, 'Loading...');
    if (props.error) return React.createElement('div', { 'data-testid': 'error' }, props.error);
    if (props.player) return React.createElement('div', { 'data-testid': 'player-details' }, props.player.name);
    return null;
  };
});

const mockSearchMFLPlayerById = searchMFLPlayerById as jest.MockedFunction<typeof searchMFLPlayerById>;

describe('PlayerSearch Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the search input and button', () => {
    render(<PlayerSearch />);
    
    expect(screen.getByLabelText(/player id/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
  });

  it('disables search button when input is empty', () => {
    render(<PlayerSearch />);
    
    const searchButton = screen.getByRole('button', { name: /search/i });
    expect(searchButton).toBeDisabled();
  });

  it('enables search button when player ID is entered', () => {
    render(<PlayerSearch />);
    
    const input = screen.getByLabelText(/player id/i);
    const searchButton = screen.getByRole('button', { name: /search/i });
    
    fireEvent.change(input, { target: { value: '116267' } });
    
    expect(searchButton).toBeEnabled();
  });

  it('calls searchMFLPlayerById when search button is clicked', async () => {
    mockSearchMFLPlayerById.mockResolvedValue({
      id: '116267',
      name: 'Max Pasquier',
      description: 'MFL Player',
      thumbnail: 'https://example.com/img.png',
      owner: '0x95dc70d7d39f6f76',
    });

    render(<PlayerSearch />);
    
    const input = screen.getByLabelText(/player id/i);
    const searchButton = screen.getByRole('button', { name: /search/i });
    
    fireEvent.change(input, { target: { value: '116267' } });
    fireEvent.click(searchButton);
    
    await waitFor(() => {
      expect(mockSearchMFLPlayerById).toHaveBeenCalledWith('116267');
    });
  });

  it('shows loading state during search', async () => {
    // Create a promise that we can control
    let resolvePromise: (value: any) => void;
    const searchPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    
    mockSearchMFLPlayerById.mockReturnValue(searchPromise);

    render(<PlayerSearch />);
    
    const input = screen.getByLabelText(/player id/i);
    const searchButton = screen.getByRole('button', { name: /search/i });
    
    fireEvent.change(input, { target: { value: '116267' } });
    fireEvent.click(searchButton);
    
    // Should show loading state
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toBeInTheDocument();
    });
    
    // Resolve the promise
    resolvePromise!({
      id: '116267',
      name: 'Max Pasquier',
      description: 'MFL Player',
      thumbnail: 'https://example.com/img.png',
      owner: '0x95dc70d7d39f6f76',
    });
  });

  it('displays player details when search is successful', async () => {
    mockSearchMFLPlayerById.mockResolvedValue({
      id: '116267',
      name: 'Max Pasquier',
      description: 'MFL Player',
      thumbnail: 'https://example.com/img.png',
      owner: '0x95dc70d7d39f6f76',
    });

    render(<PlayerSearch />);
    
    const input = screen.getByLabelText(/player id/i);
    const searchButton = screen.getByRole('button', { name: /search/i });
    
    fireEvent.change(input, { target: { value: '116267' } });
    fireEvent.click(searchButton);
    
    await waitFor(() => {
      expect(screen.getByTestId('player-details')).toBeInTheDocument();
      expect(screen.getByText('Max Pasquier')).toBeInTheDocument();
    });
  });

  it('displays error message when search fails', async () => {
    mockSearchMFLPlayerById.mockRejectedValue(new Error('Player not found'));

    render(<PlayerSearch />);
    
    const input = screen.getByLabelText(/player id/i);
    const searchButton = screen.getByRole('button', { name: /search/i });
    
    fireEvent.change(input, { target: { value: '999999' } });
    fireEvent.click(searchButton);
    
    await waitFor(() => {
      expect(screen.getByTestId('error')).toBeInTheDocument();
      expect(screen.getByText('Player not found')).toBeInTheDocument();
    });
  });

  it('trims whitespace from player ID input', async () => {
    mockSearchMFLPlayerById.mockResolvedValue({
      id: '116267',
      name: 'Max Pasquier',
      description: 'MFL Player',
      thumbnail: 'https://example.com/img.png',
      owner: '0x95dc70d7d39f6f76',
    });

    render(<PlayerSearch />);
    
    const input = screen.getByLabelText(/player id/i);
    const searchButton = screen.getByRole('button', { name: /search/i });
    
    fireEvent.change(input, { target: { value: '  116267  ' } });
    fireEvent.click(searchButton);
    
    await waitFor(() => {
      expect(mockSearchMFLPlayerById).toHaveBeenCalledWith('116267');
    });
  });

  it('clears previous results when starting new search', async () => {
    mockSearchMFLPlayerById.mockResolvedValue({
      id: '116267',
      name: 'Max Pasquier',
      description: 'MFL Player',
      thumbnail: 'https://example.com/img.png',
      owner: '0x95dc70d7d39f6f76',
    });

    render(<PlayerSearch />);
    
    const input = screen.getByLabelText(/player id/i);
    const searchButton = screen.getByRole('button', { name: /search/i });
    
    // First search
    fireEvent.change(input, { target: { value: '116267' } });
    fireEvent.click(searchButton);
    
    await waitFor(() => {
      expect(screen.getByTestId('player-details')).toBeInTheDocument();
    });
    
    // Second search - should clear previous results
    fireEvent.change(input, { target: { value: '116268' } });
    fireEvent.click(searchButton);
    
    // Should show loading state (clearing previous results)
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toBeInTheDocument();
    });
  });
});
