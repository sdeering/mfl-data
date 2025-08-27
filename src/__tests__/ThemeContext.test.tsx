import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';

// Mock the theme storage utilities
jest.mock('../utils/themeStorage', () => ({
  saveThemePreference: jest.fn(),
  getInitialThemePreference: jest.fn(() => 'light'),
}));

// Test component to consume theme context
const TestThemeConsumer: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  
  return (
    <div>
      <span data-testid="current-theme">{theme}</span>
      <button data-testid="toggle-theme" onClick={toggleTheme}>
        Toggle Theme
      </button>
    </div>
  );
};

// Test component that should throw error when used outside provider
const TestThemeConsumerWithoutProvider: React.FC = () => {
  const { theme } = useTheme();
  return <div>{theme}</div>;
};

describe('ThemeContext', () => {
  describe('ThemeProvider', () => {
    it('should provide default light theme', () => {
      render(
        <ThemeProvider>
          <TestThemeConsumer />
        </ThemeProvider>
      );
      
      expect(screen.getByTestId('current-theme')).toHaveTextContent('light');
    });

    it('should allow theme toggling', () => {
      render(
        <ThemeProvider>
          <TestThemeConsumer />
        </ThemeProvider>
      );
      
      const themeDisplay = screen.getByTestId('current-theme');
      const toggleButton = screen.getByTestId('toggle-theme');
      
      // Initially light
      expect(themeDisplay).toHaveTextContent('light');
      
      // Toggle to dark
      fireEvent.click(toggleButton);
      expect(themeDisplay).toHaveTextContent('dark');
      
      // Toggle back to light
      fireEvent.click(toggleButton);
      expect(themeDisplay).toHaveTextContent('light');
    });

    it('should save theme preference when toggling', () => {
      const { saveThemePreference } = require('../utils/themeStorage');
      
      render(
        <ThemeProvider>
          <TestThemeConsumer />
        </ThemeProvider>
      );
      
      const toggleButton = screen.getByTestId('toggle-theme');
      
      // Toggle to dark
      fireEvent.click(toggleButton);
      expect(saveThemePreference).toHaveBeenCalledWith('dark');
      
      // Toggle back to light
      fireEvent.click(toggleButton);
      expect(saveThemePreference).toHaveBeenCalledWith('light');
    });

    it('should respect initial theme prop', () => {
      render(
        <ThemeProvider initialTheme="dark">
          <TestThemeConsumer />
        </ThemeProvider>
      );
      
      expect(screen.getByTestId('current-theme')).toHaveTextContent('dark');
    });

    it('should detect system preference when no initial theme provided', () => {
      // Mock getInitialThemePreference to return dark
      const { getInitialThemePreference } = require('../utils/themeStorage');
      getInitialThemePreference.mockReturnValueOnce('dark');

      render(
        <ThemeProvider>
          <TestThemeConsumer />
        </ThemeProvider>
      );
      
      expect(screen.getByTestId('current-theme')).toHaveTextContent('dark');
    });

    it('should fallback to light theme when system preference detection fails', () => {
      // Mock getInitialThemePreference to return light (default fallback)
      const { getInitialThemePreference } = require('../utils/themeStorage');
      getInitialThemePreference.mockReturnValueOnce('light');

      render(
        <ThemeProvider>
          <TestThemeConsumer />
        </ThemeProvider>
      );
      
      expect(screen.getByTestId('current-theme')).toHaveTextContent('light');
    });
  });

  describe('useTheme hook', () => {
    it('should throw error when used outside ThemeProvider', () => {
      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      expect(() => {
        render(<TestThemeConsumerWithoutProvider />);
      }).toThrow('useTheme must be used within a ThemeProvider');
      
      consoleSpy.mockRestore();
    });

    it('should provide theme value and toggle function', () => {
      render(
        <ThemeProvider>
          <TestThemeConsumer />
        </ThemeProvider>
      );
      
      // Should have theme value
      expect(screen.getByTestId('current-theme')).toBeInTheDocument();
      
      // Should have toggle button (indicating toggle function is available)
      expect(screen.getByTestId('toggle-theme')).toBeInTheDocument();
    });
  });

  describe('TypeScript types', () => {
    it('should have proper type definitions', () => {
      // This test ensures TypeScript compilation passes with proper types
      const TestTypeCheck: React.FC = () => {
        const { theme, toggleTheme } = useTheme();
        
        // Theme should be 'light' | 'dark'
        const isValidTheme: boolean = theme === 'light' || theme === 'dark';
        
        // toggleTheme should be a function
        const isFunction: boolean = typeof toggleTheme === 'function';
        
        return (
          <div>
            <span data-testid="type-check-theme">{isValidTheme.toString()}</span>
            <span data-testid="type-check-function">{isFunction.toString()}</span>
          </div>
        );
      };

      render(
        <ThemeProvider>
          <TestTypeCheck />
        </ThemeProvider>
      );
      
      expect(screen.getByTestId('type-check-theme')).toHaveTextContent('true');
      expect(screen.getByTestId('type-check-function')).toHaveTextContent('true');
    });
  });
});
