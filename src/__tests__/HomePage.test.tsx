import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import HomePage from '@/src/components/HomePage';
import { LoadingProvider } from '@/src/contexts/LoadingContext';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

const mockPush = jest.fn();

describe('HomePage', () => {
  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    });
    mockPush.mockClear();
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <LoadingProvider>
        {component}
      </LoadingProvider>
    );
  };

  it('renders search form with correct elements', () => {
    renderWithProviders(<HomePage />);
    
    expect(screen.getByText('Search for MFL players')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search for a player by id...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Search Player' })).toBeInTheDocument();
  });

  it('handles manual search submission', async () => {
    renderWithProviders(<HomePage />);
    
    const input = screen.getByPlaceholderText('Search for a player by id...');
    const submitButton = screen.getByRole('button', { name: 'Search Player' });
    
    // Initially button should be disabled
    expect(submitButton).toBeDisabled();
    
    // Type a player ID
    fireEvent.change(input, { target: { value: '12345' } });
    
    // Button should now be enabled
    expect(submitButton).toBeEnabled();
    
    // Submit the form
    fireEvent.click(submitButton);
    
    // Should show loading state
    expect(screen.getByText('Searching...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Searching...' })).toBeDisabled();
    
    // Wait for navigation
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/players/12345');
    }, { timeout: 1000 });
  });

  it('handles paste event for valid player ID', async () => {
    renderWithProviders(<HomePage />);
    
    const input = screen.getByPlaceholderText('Search for a player by id...');
    
    // Simulate paste event with valid player ID
    const pasteEvent = new Event('paste', { bubbles: true });
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: {
        getData: () => '67890'
      }
    });
    
    fireEvent(input, pasteEvent);
    
    // Should show the pasted value in input
    expect(input).toHaveValue('67890');
    
    // Should show loading state
    expect(screen.getByText('Searching...')).toBeInTheDocument();
    
    // Wait for navigation
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/players/67890');
    }, { timeout: 1000 });
  });

  it('does not trigger search for invalid pasted content', () => {
    renderWithProviders(<HomePage />);
    
    const input = screen.getByPlaceholderText('Search for a player by id...');
    
    // Simulate paste event with invalid content
    const pasteEvent = new Event('paste', { bubbles: true });
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: {
        getData: () => 'invalid'
      }
    });
    
    fireEvent(input, pasteEvent);
    
    // Should not show loading state
    expect(screen.queryByText('Searching...')).not.toBeInTheDocument();
    
    // Should not navigate
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('shows loading spinner in input when searching', async () => {
    renderWithProviders(<HomePage />);
    
    const input = screen.getByPlaceholderText('Search for a player by id...');
    
    // Simulate paste event
    const pasteEvent = new Event('paste', { bubbles: true });
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: {
        getData: () => '12345'
      }
    });
    
    fireEvent(input, pasteEvent);
    
    // Input should be disabled during search
    expect(input).toBeDisabled();
    
    // Should show loading spinner
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('disables quick search links during search', async () => {
    renderWithProviders(<HomePage />);
    
    const input = screen.getByPlaceholderText('Search for a player by id...');
    
    // Simulate paste event to start search
    const pasteEvent = new Event('paste', { bubbles: true });
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: {
        getData: () => '12345'
      }
    });
    
    fireEvent(input, pasteEvent);
    
    // Quick search links should be disabled
    const quickLinks = screen.getAllByRole('button');
    quickLinks.forEach(link => {
      if (link.textContent && /^\d+$/.test(link.textContent)) {
        expect(link).toBeDisabled();
      }
    });
  });
});
