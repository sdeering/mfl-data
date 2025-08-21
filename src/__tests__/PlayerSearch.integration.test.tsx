import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PlayerSearch from '@/src/components/PlayerSearch';
import { searchMFLPlayerById } from '@/src/services/mflApi';

// Mock the API service
jest.mock('@/src/services/mflApi', () => ({
  searchMFLPlayerById: jest.fn(),
}));

const mockSearchMFLPlayerById = searchMFLPlayerById as jest.MockedFunction<typeof searchMFLPlayerById>;

describe('PlayerSearch Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('complete user flow: search for player and see results', async () => {
    // Mock successful API response
    mockSearchMFLPlayerById.mockResolvedValue({
      id: '116267',
      name: 'Max Pasquier',
      description: 'MFL Player',
      thumbnail: 'https://example.com/img.png',
      owner: '0x95dc70d7d39f6f76',
    });

    render(<PlayerSearch />);

    // 1. User sees the search form
    expect(screen.getByLabelText(/player id/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();

    // 2. User enters a player ID
    const input = screen.getByLabelText(/player id/i);
    const searchButton = screen.getByRole('button', { name: /search/i });
    
    fireEvent.change(input, { target: { value: '116267' } });
    expect(searchButton).toBeEnabled();

    // 3. User clicks search
    fireEvent.click(searchButton);

    // 4. User sees loading state
    await waitFor(() => {
      expect(screen.getByText('Loading…')).toBeInTheDocument();
    });

    // 5. User sees results
    await waitFor(() => {
      expect(screen.getByText('Max Pasquier')).toBeInTheDocument();
      expect(screen.getByText(/ID: 116267/)).toBeInTheDocument();
      expect(screen.getByText('MFL Player')).toBeInTheDocument();
    });

    // 6. Verify API was called correctly
    expect(mockSearchMFLPlayerById).toHaveBeenCalledWith('116267');
  });

  test('complete user flow: search fails and user sees error', async () => {
    // Mock failed API response
    mockSearchMFLPlayerById.mockRejectedValue(new Error('Player not found'));

    render(<PlayerSearch />);

    // 1. User enters a player ID
    const input = screen.getByLabelText(/player id/i);
    const searchButton = screen.getByRole('button', { name: /search/i });
    
    fireEvent.change(input, { target: { value: '999999' } });
    fireEvent.click(searchButton);

    // 2. User sees loading state
    await waitFor(() => {
      expect(screen.getByText('Loading…')).toBeInTheDocument();
    });

    // 3. User sees error message
    await waitFor(() => {
      expect(screen.getByText('Player not found')).toBeInTheDocument();
    });

    // 4. Verify API was called correctly
    expect(mockSearchMFLPlayerById).toHaveBeenCalledWith('999999');
  });

  test('user can search multiple times and see different results', async () => {
    // Mock different responses for different searches
    mockSearchMFLPlayerById
      .mockResolvedValueOnce({
        id: '116267',
        name: 'Max Pasquier',
        description: 'MFL Player',
        thumbnail: 'https://example.com/img.png',
        owner: '0x95dc70d7d39f6f76',
      })
      .mockResolvedValueOnce({
        id: '116268',
        name: 'John Doe',
        description: 'Another MFL Player',
        thumbnail: 'https://example.com/img2.png',
        owner: '0x1234567890abcdef',
      });

    render(<PlayerSearch />);

    const input = screen.getByLabelText(/player id/i);
    const searchButton = screen.getByRole('button', { name: /search/i });

    // First search
    fireEvent.change(input, { target: { value: '116267' } });
    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(screen.getByText('Max Pasquier')).toBeInTheDocument();
    });

    // Second search
    fireEvent.change(input, { target: { value: '116268' } });
    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText(/ID: 116268/)).toBeInTheDocument();
    });

    // Verify both API calls were made
    expect(mockSearchMFLPlayerById).toHaveBeenCalledTimes(2);
    expect(mockSearchMFLPlayerById).toHaveBeenNthCalledWith(1, '116267');
    expect(mockSearchMFLPlayerById).toHaveBeenNthCalledWith(2, '116268');
  });

  test('user can trim whitespace from input', async () => {
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

    // Enter with whitespace
    fireEvent.change(input, { target: { value: '  116267  ' } });
    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(screen.getByText('Max Pasquier')).toBeInTheDocument();
    });

    // Verify the trimmed value was used
    expect(mockSearchMFLPlayerById).toHaveBeenCalledWith('116267');
  });

  test('user cannot search with empty input', async () => {
    render(<PlayerSearch />);

    const searchButton = screen.getByRole('button', { name: /search/i });
    expect(searchButton).toBeDisabled();

    // Try to click (should not work)
    fireEvent.click(searchButton);

    // Verify no API call was made
    expect(mockSearchMFLPlayerById).not.toHaveBeenCalled();
  });

  test('user sees proper loading and error states', async () => {
    // Mock a delayed response to test loading state
    let resolvePromise: (value: { id: string; name: string; description: string; thumbnail: string; owner: string }) => void;
    const delayedPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    
    mockSearchMFLPlayerById.mockReturnValue(delayedPromise);

    render(<PlayerSearch />);

    const input = screen.getByLabelText(/player id/i);
    const searchButton = screen.getByRole('button', { name: /search/i });

    fireEvent.change(input, { target: { value: '116267' } });
    fireEvent.click(searchButton);

    // Should show loading
    await waitFor(() => {
      expect(screen.getByText('Loading…')).toBeInTheDocument();
    });

    // Resolve with success
    resolvePromise!({
      id: '116267',
      name: 'Max Pasquier',
      description: 'MFL Player',
      thumbnail: 'https://example.com/img.png',
      owner: '0x95dc70d7d39f6f76',
    });

    // Should show results
    await waitFor(() => {
      expect(screen.getByText('Max Pasquier')).toBeInTheDocument();
    });
  });
});
