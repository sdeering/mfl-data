'use client';

import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import type { Theme } from '../types/theme';

// Icon components
const SunIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    data-testid="sun-icon"
    className={`w-5 h-5 text-yellow-500 transition-transform duration-300 transform rotate-0 ${className}`}
    fill="currentColor"
    viewBox="0 0 20 20"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
      clipRule="evenodd"
    />
  </svg>
);

const MoonIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    data-testid="moon-icon"
    className={`w-5 h-5 text-blue-400 transition-transform duration-300 transform rotate-180 ${className}`}
    fill="currentColor"
    viewBox="0 0 20 20"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
  </svg>
);

// Size variants
const sizeClasses = {
  sm: 'p-1.5',
  md: 'p-2',
  lg: 'p-3',
};

const iconSizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
};

// Variant styles
const variantClasses = {
  default: 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600',
  minimal: 'bg-transparent border-0 hover:bg-gray-50 dark:hover:bg-gray-900',
  filled: 'bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white',
};

export interface ThemeToggleProps {
  /** Custom CSS class name */
  className?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Visual variant */
  variant?: 'default' | 'minimal' | 'filled';
  /** Callback function called when theme is toggled */
  onToggle?: (theme: Theme) => void;
  /** Custom ARIA label */
  'aria-label'?: string;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({
  className = '',
  size = 'md',
  variant = 'default',
  onToggle,
  'aria-label': ariaLabel = 'Toggle theme',
}) => {
  const { theme, toggleTheme } = useTheme();

  const handleToggle = () => {
    console.log('ThemeToggle clicked, current theme:', theme);
    toggleTheme();
    if (onToggle) {
      // Call onToggle with the new theme (opposite of current)
      onToggle(theme === 'light' ? 'dark' : 'light');
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleToggle();
    }
  };

  const baseClasses = [
    'inline-flex items-center justify-center rounded-lg',
    'transition-all duration-300 ease-in-out',
    'hover:scale-105 hover:shadow-lg',
    'active:scale-95',
    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
    'dark:focus:ring-offset-gray-900',
    sizeClasses[size],
    variantClasses[variant],
    className,
  ].join(' ');

  return (
    <button
      type="button"
      className={baseClasses}
      onClick={handleToggle}
      onKeyDown={handleKeyDown}
      aria-label={ariaLabel}
      aria-pressed={theme === 'dark'}
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {theme === 'light' ? (
        <SunIcon className={iconSizeClasses[size]} />
      ) : (
        <MoonIcon className={iconSizeClasses[size]} />
      )}
    </button>
  );
};

export default ThemeToggle;
