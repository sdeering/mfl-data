// Theme-related type definitions
import { ReactNode } from 'react';

export type Theme = 'light' | 'dark';

export interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  isClient: boolean; // Add this to track hydration state
}

export interface ThemeProviderProps {
  children: ReactNode;
  initialTheme?: Theme;
}

// Utility type for theme-aware component props
export interface ThemeAwareProps {
  theme?: Theme;
}

// CSS class mapping for themes
export type ThemeClassMap = Record<Theme, string>;

// Theme configuration interface
export interface ThemeConfig {
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
  };
  shadows: {
    sm: string;
    md: string;
    lg: string;
  };
}

// Complete theme configuration mapping
export type ThemeConfigMap = Record<Theme, ThemeConfig>;
