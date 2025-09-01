'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Theme, ThemeContextValue, ThemeProviderProps } from '../types/theme';
import { saveThemePreference, getInitialThemePreference } from '../utils/themeStorage';

// Create the context with undefined default (to enforce provider usage)
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// Theme Provider component
export const ThemeProvider: React.FC<ThemeProviderProps> = ({ 
  children, 
  initialTheme 
}) => {
  // Initialize theme state
  const [theme, setTheme] = useState<Theme>(() => {
    // Use initialTheme if provided, otherwise get from storage/system preference
    return initialTheme || getInitialThemePreference();
  });

  // Apply theme to document element
  useEffect(() => {
    const html = document.documentElement;
    
    console.log('Applying theme to document:', theme);
    
    // Remove existing theme classes
    html.classList.remove('light', 'dark');
    
    // Add new theme class
    html.classList.add(theme);
    
    // Also set data attribute for additional styling if needed
    html.setAttribute('data-theme', theme);
    
    console.log('Document classes after theme change:', html.classList.toString());
  }, [theme]);

  // Toggle theme function
  const toggleTheme = (): void => {
    setTheme(prevTheme => {
      const newTheme = prevTheme === 'light' ? 'dark' : 'light';
      console.log('Theme toggled from', prevTheme, 'to', newTheme);
      // Save the new theme preference to sessionStorage
      saveThemePreference(newTheme);
      return newTheme;
    });
  };

  // Context value
  const value: ThemeContextValue = {
    theme,
    toggleTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

// Custom hook to use theme context
export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  
  return context;
};

// Export the context for testing purposes
export { ThemeContext };
