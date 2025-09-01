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
  // Initialize theme state - always start with 'light' to prevent hydration mismatch
  const [theme, setTheme] = useState<Theme>('light');
  const [isClient, setIsClient] = useState(false);

  // Handle client-side initialization after hydration
  useEffect(() => {
    console.log('ThemeProvider useEffect running, setting isClient to true');
    setIsClient(true);
    
    // Get the actual theme preference after hydration
    const actualTheme = initialTheme || getInitialThemePreference();
    console.log('Actual theme preference:', actualTheme);
    
    // Only update if it's different from the default 'light'
    if (actualTheme !== 'light') {
      console.log('Updating theme from light to:', actualTheme);
      setTheme(actualTheme);
    }
  }, []); // Remove initialTheme dependency to ensure it runs

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
    isClient, // Add this to help components know if we're hydrated
  };

  console.log('ThemeProvider rendering with isClient:', isClient, 'theme:', theme);

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
