import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';
import ThemeToggle from '../components/ThemeToggle';

// Mock the theme storage utilities
jest.mock('../utils/themeStorage', () => ({
  saveThemePreference: jest.fn(),
  getInitialThemePreference: jest.fn(() => 'light'),
}));

// Test component to provide theme context
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider>
    {children}
  </ThemeProvider>
);

describe('ThemeToggle', () => {
  describe('Basic Functionality', () => {
    it('should render toggle button', () => {
      render(
        <TestWrapper>
          <ThemeToggle />
        </TestWrapper>
      );
      
      const toggleButton = screen.getByRole('button', { name: /toggle theme/i });
      expect(toggleButton).toBeInTheDocument();
    });

    it('should toggle theme when clicked', () => {
      render(
        <TestWrapper>
          <ThemeToggle />
        </TestWrapper>
      );
      
      const toggleButton = screen.getByRole('button', { name: /toggle theme/i });
      
      // Initially should show light theme (sun icon)
      expect(screen.getByTestId('sun-icon')).toBeInTheDocument();
      expect(screen.queryByTestId('moon-icon')).not.toBeInTheDocument();
      
      // Click to toggle to dark theme
      fireEvent.click(toggleButton);
      expect(screen.getByTestId('moon-icon')).toBeInTheDocument();
      expect(screen.queryByTestId('sun-icon')).not.toBeInTheDocument();
      
      // Click again to toggle back to light theme
      fireEvent.click(toggleButton);
      expect(screen.getByTestId('sun-icon')).toBeInTheDocument();
      expect(screen.queryByTestId('moon-icon')).not.toBeInTheDocument();
    });

    it('should call onToggle callback when provided', () => {
      const mockOnToggle = jest.fn();
      
      render(
        <TestWrapper>
          <ThemeToggle onToggle={mockOnToggle} />
        </TestWrapper>
      );
      
      const toggleButton = screen.getByRole('button', { name: /toggle theme/i });
      fireEvent.click(toggleButton);
      
      expect(mockOnToggle).toHaveBeenCalledWith('dark');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(
        <TestWrapper>
          <ThemeToggle />
        </TestWrapper>
      );
      
      const toggleButton = screen.getByRole('button', { name: /toggle theme/i });
      
      expect(toggleButton).toHaveAttribute('aria-label', 'Toggle theme');
      expect(toggleButton).toHaveAttribute('aria-pressed', 'false'); // Initially light theme (unpressed)
    });

    it('should update aria-pressed when theme changes', () => {
      render(
        <TestWrapper>
          <ThemeToggle />
        </TestWrapper>
      );
      
      const toggleButton = screen.getByRole('button', { name: /toggle theme/i });
      
      // Initially light theme
      expect(toggleButton).toHaveAttribute('aria-pressed', 'false');
      
      // Toggle to dark theme
      fireEvent.click(toggleButton);
      expect(toggleButton).toHaveAttribute('aria-pressed', 'true');
      
      // Toggle back to light theme
      fireEvent.click(toggleButton);
      expect(toggleButton).toHaveAttribute('aria-pressed', 'false');
    });

    it('should be keyboard accessible', () => {
      render(
        <TestWrapper>
          <ThemeToggle />
        </TestWrapper>
      );
      
      const toggleButton = screen.getByRole('button', { name: /toggle theme/i });
      
      // Focus the button
      toggleButton.focus();
      expect(toggleButton).toHaveFocus();
      
      // Toggle with Enter key
      fireEvent.keyDown(toggleButton, { key: 'Enter', code: 'Enter' });
      expect(screen.getByTestId('moon-icon')).toBeInTheDocument();
      
      // Toggle with Space key
      fireEvent.keyDown(toggleButton, { key: ' ', code: 'Space' });
      expect(screen.getByTestId('sun-icon')).toBeInTheDocument();
    });

    it('should have proper focus styles', () => {
      render(
        <TestWrapper>
          <ThemeToggle />
        </TestWrapper>
      );
      
      const toggleButton = screen.getByRole('button', { name: /toggle theme/i });
      
      // Focus the button
      toggleButton.focus();
      expect(toggleButton).toHaveClass('focus:outline-none', 'focus:ring-2', 'focus:ring-blue-500');
    });
  });

  describe('Visual Design', () => {
    it('should have smooth transition classes', () => {
      render(
        <TestWrapper>
          <ThemeToggle />
        </TestWrapper>
      );
      
      const toggleButton = screen.getByRole('button', { name: /toggle theme/i });
      
      expect(toggleButton).toHaveClass('transition-all', 'duration-300', 'ease-in-out');
    });

    it('should have proper hover states', () => {
      render(
        <TestWrapper>
          <ThemeToggle />
        </TestWrapper>
      );
      
      const toggleButton = screen.getByRole('button', { name: /toggle theme/i });
      
      expect(toggleButton).toHaveClass('hover:scale-105', 'hover:shadow-lg');
    });

    it('should have proper active states', () => {
      render(
        <TestWrapper>
          <ThemeToggle />
        </TestWrapper>
      );
      
      const toggleButton = screen.getByRole('button', { name: /toggle theme/i });
      
      expect(toggleButton).toHaveClass('active:scale-95');
    });

    it('should have theme-aware styling', () => {
      render(
        <TestWrapper>
          <ThemeToggle />
        </TestWrapper>
      );
      
      const toggleButton = screen.getByRole('button', { name: /toggle theme/i });
      
      // Check that dark mode classes are present (they'll be applied when dark mode is active)
      expect(toggleButton).toHaveClass('dark:bg-gray-800', 'dark:hover:bg-gray-700');
      
      // Check light theme classes are present
      expect(toggleButton).toHaveClass('bg-gray-100', 'hover:bg-gray-200');
    });
  });

  describe('Icon Display', () => {
    it('should show sun icon for light theme', () => {
      render(
        <TestWrapper>
          <ThemeToggle />
        </TestWrapper>
      );
      
      const sunIcon = screen.getByTestId('sun-icon');
      expect(sunIcon).toBeInTheDocument();
      expect(sunIcon).toHaveClass('text-yellow-500');
    });

    it('should show moon icon for dark theme', () => {
      render(
        <TestWrapper>
          <ThemeToggle />
        </TestWrapper>
      );
      
      const toggleButton = screen.getByRole('button', { name: /toggle theme/i });
      fireEvent.click(toggleButton);
      
      const moonIcon = screen.getByTestId('moon-icon');
      expect(moonIcon).toBeInTheDocument();
      expect(moonIcon).toHaveClass('text-blue-400');
    });

    it('should have proper icon sizing', () => {
      render(
        <TestWrapper>
          <ThemeToggle />
        </TestWrapper>
      );
      
      const sunIcon = screen.getByTestId('sun-icon');
      expect(sunIcon).toHaveClass('w-5', 'h-5');
    });
  });

  describe('Animation and Transitions', () => {
    it('should have icon transition animations', () => {
      render(
        <TestWrapper>
          <ThemeToggle />
        </TestWrapper>
      );
      
      const sunIcon = screen.getByTestId('sun-icon');
      expect(sunIcon).toHaveClass('transition-transform', 'duration-300');
    });

    it('should have rotation animation on theme change', () => {
      render(
        <TestWrapper>
          <ThemeToggle />
        </TestWrapper>
      );
      
      const toggleButton = screen.getByRole('button', { name: /toggle theme/i });
      const sunIcon = screen.getByTestId('sun-icon');
      
      // Should have rotation class
      expect(sunIcon).toHaveClass('transform', 'rotate-0');
      
      // Click to trigger animation
      fireEvent.click(toggleButton);
      const moonIcon = screen.getByTestId('moon-icon');
      expect(moonIcon).toHaveClass('transform', 'rotate-180');
    });
  });

  describe('Custom Props', () => {
    it('should accept custom className', () => {
      render(
        <TestWrapper>
          <ThemeToggle className="custom-class" />
        </TestWrapper>
      );
      
      const toggleButton = screen.getByRole('button', { name: /toggle theme/i });
      expect(toggleButton).toHaveClass('custom-class');
    });

    it('should accept custom size prop', () => {
      render(
        <TestWrapper>
          <ThemeToggle size="lg" />
        </TestWrapper>
      );
      
      const toggleButton = screen.getByRole('button', { name: /toggle theme/i });
      expect(toggleButton).toHaveClass('p-3'); // Larger padding for lg size
      
      const sunIcon = screen.getByTestId('sun-icon');
      expect(sunIcon).toHaveClass('w-6', 'h-6'); // Larger icons for lg size
    });

    it('should accept custom variant prop', () => {
      render(
        <TestWrapper>
          <ThemeToggle variant="minimal" />
        </TestWrapper>
      );
      
      const toggleButton = screen.getByRole('button', { name: /toggle theme/i });
      expect(toggleButton).toHaveClass('bg-transparent', 'border-0'); // Minimal styling
    });
  });

  describe('Error Handling', () => {
    it('should handle missing theme context gracefully', () => {
      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      expect(() => {
        render(<ThemeToggle />);
      }).toThrow('useTheme must be used within a ThemeProvider');
      
      consoleSpy.mockRestore();
    });
  });

  describe('Integration with Theme Context', () => {
    it('should reflect theme changes from context', () => {
      const TestComponent: React.FC = () => {
        const { theme, toggleTheme } = useTheme();
        return (
          <div>
            <span data-testid="current-theme">{theme}</span>
            <button data-testid="context-toggle" onClick={toggleTheme}>
              Context Toggle
            </button>
            <ThemeToggle />
          </div>
        );
      };

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );
      
      // Initially light theme
      expect(screen.getByTestId('current-theme')).toHaveTextContent('light');
      expect(screen.getByTestId('sun-icon')).toBeInTheDocument();
      
      // Toggle via context
      fireEvent.click(screen.getByTestId('context-toggle'));
      expect(screen.getByTestId('current-theme')).toHaveTextContent('dark');
      expect(screen.getByTestId('moon-icon')).toBeInTheDocument();
      
      // Toggle via ThemeToggle component
      fireEvent.click(screen.getByRole('button', { name: /toggle theme/i }));
      expect(screen.getByTestId('current-theme')).toHaveTextContent('light');
      expect(screen.getByTestId('sun-icon')).toBeInTheDocument();
    });
  });
});
