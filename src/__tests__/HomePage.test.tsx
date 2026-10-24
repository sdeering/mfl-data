import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import HomePage from '@/src/components/HomePage';
import { LoadingProvider } from '@/src/contexts/LoadingContext';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

const mockWallet = { isConnected: false, connectWallet: jest.fn() };
jest.mock('@/src/contexts/WalletContext', () => ({
  useWallet: () => mockWallet,
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
    expect(screen.getByPlaceholderText('Search for a player by ID…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Search Player' })).toBeInTheDocument();
  });

  it('handles manual search submission', async () => {
    renderWithProviders(<HomePage />);
    
    const input = screen.getByPlaceholderText('Search for a player by ID…');
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
    
    const input = screen.getByPlaceholderText('Search for a player by ID…');
    
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
    
    const input = screen.getByPlaceholderText('Search for a player by ID…');
    
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
    
    const input = screen.getByPlaceholderText('Search for a player by ID…');
    
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
    
    const input = screen.getByPlaceholderText('Search for a player by ID…');
    
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

  it('lists each tool in a box linking to it, marking the ones that need a wallet', () => {
    mockWallet.isConnected = false;
    renderWithProviders(<HomePage />);

    const tools = [
      { title: 'Agency Overview', path: '/agency', needsWallet: true },
      { title: 'Squad Builder', path: '/squad-builder', needsWallet: true },
      { title: 'Player Compare', path: '/compare', needsWallet: false },
      { title: 'Player Progression', path: '/player-progression', needsWallet: true },
      { title: 'Club Overview', path: '/clubs', needsWallet: true },
      { title: 'Player Scouting', path: '/scout', needsWallet: false },
      { title: 'MFL Resources', path: '/resources', needsWallet: false },
    ];

    for (const tool of tools) {
      const box = screen.getByRole('link', { name: new RegExp(tool.title) });
      expect(box).toHaveAttribute('href', tool.path);
      expect(box.textContent?.includes('Needs wallet')).toBe(tool.needsWallet);
    }
    expect(screen.getByRole('button', { name: 'Connect your wallet' })).toBeInTheDocument();
  });

  it('drops the wallet tags once a wallet is connected', () => {
    mockWallet.isConnected = true;
    renderWithProviders(<HomePage />);

    expect(screen.queryByText('Needs wallet')).not.toBeInTheDocument();
    expect(screen.getByText('All tools unlocked')).toBeInTheDocument();
    mockWallet.isConnected = false;
  });
});
