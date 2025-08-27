import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import HomePage from '../components/HomePage';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

describe('HomePage', () => {
  it('renders the homepage with search form', () => {
    render(<HomePage />);
    
    expect(screen.getAllByText('MFL Player Search')).toHaveLength(2);
    expect(screen.getByPlaceholderText('Enter player ID...')).toBeInTheDocument();
    expect(screen.getByText('Search Player')).toBeInTheDocument();
    expect(screen.getByText('Login with Dapper Wallet')).toBeInTheDocument();
  });

  it('shows popup when login button is clicked', () => {
    render(<HomePage />);
    
    const loginButton = screen.getByText('Login with Dapper Wallet');
    fireEvent.click(loginButton);
    
    expect(screen.getByText('Coming Soon!')).toBeInTheDocument();
    expect(screen.getByText('Wallet login functionality will be available in a future update.')).toBeInTheDocument();
    expect(screen.getByText('Got it')).toBeInTheDocument();
  });

  it('closes popup when Got it button is clicked', () => {
    render(<HomePage />);
    
    const loginButton = screen.getByText('Login with Dapper Wallet');
    fireEvent.click(loginButton);
    
    expect(screen.getByText('Coming Soon!')).toBeInTheDocument();
    
    const closeButton = screen.getByText('Got it');
    fireEvent.click(closeButton);
    
    expect(screen.queryByText('Coming Soon!')).not.toBeInTheDocument();
  });

  it('disables search button when input is empty', () => {
    render(<HomePage />);
    
    const searchButton = screen.getByText('Search Player');
    expect(searchButton).toBeDisabled();
  });

  it('enables search button when input has content', () => {
    render(<HomePage />);
    
    const searchInput = screen.getByPlaceholderText('Enter player ID...');
    const searchButton = screen.getByText('Search Player');
    
    fireEvent.change(searchInput, { target: { value: '116267' } });
    expect(searchButton).not.toBeDisabled();
  });

  it('clears search input after successful search', () => {
    render(<HomePage />);
    
    const searchInput = screen.getByPlaceholderText('Enter player ID...');
    const searchButton = screen.getByText('Search Player');
    
    fireEvent.change(searchInput, { target: { value: '116267' } });
    expect(searchInput).toHaveValue('116267');
    
    fireEvent.click(searchButton);
    expect(searchInput).toHaveValue('');
  });
});
