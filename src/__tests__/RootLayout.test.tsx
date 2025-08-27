import React from 'react';
import { render, screen } from '@testing-library/react';
import RootLayout from '../../app/layout';

// Mock Next.js metadata
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
}));

// Mock Next.js font
jest.mock('next/font/google', () => ({
  Inter: () => ({
    className: 'mock-inter-font',
    style: { fontFamily: 'Inter' },
  }),
}));

// Mock the theme storage utilities
jest.mock('../utils/themeStorage', () => ({
  saveThemePreference: jest.fn(),
  getInitialThemePreference: jest.fn(() => 'light'),
}));

// Mock the Footer component
jest.mock('../components/Footer', () => {
  return function MockFooter() {
    return <footer data-testid="mock-footer">Mock Footer</footer>;
  };
});

// Mock the ThemeProviderWrapper
jest.mock('../components/ThemeProviderWrapper', () => {
  return function MockThemeProviderWrapper({ children }: { children: React.ReactNode }) {
    return <div data-testid="theme-provider">{children}</div>;
  };
});

describe('RootLayout', () => {
  const mockChildren = <div data-testid="test-children">Test Content</div>;

  it('should render children within theme provider', () => {
    render(<RootLayout>{mockChildren}</RootLayout>);

    expect(screen.getByTestId('test-children')).toBeInTheDocument();
    expect(screen.getByTestId('theme-provider')).toBeInTheDocument();
  });

  it('should render footer', () => {
    render(<RootLayout>{mockChildren}</RootLayout>);

    expect(screen.getByTestId('mock-footer')).toBeInTheDocument();
  });

  it('should have proper structure with theme provider wrapper', () => {
    render(<RootLayout>{mockChildren}</RootLayout>);

    const themeProvider = screen.getByTestId('theme-provider');
    expect(themeProvider).toBeInTheDocument();
    
    // Check that children are rendered inside theme provider
    expect(themeProvider).toContainElement(screen.getByTestId('test-children'));
  });

  it('should render footer inside theme provider', () => {
    render(<RootLayout>{mockChildren}</RootLayout>);

    const themeProvider = screen.getByTestId('theme-provider');
    expect(themeProvider).toContainElement(screen.getByTestId('mock-footer'));
  });
});
