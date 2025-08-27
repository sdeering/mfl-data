import type { Theme } from '../types/theme';

// Storage key for theme preference
const THEME_STORAGE_KEY = 'mfl-data-theme-preference';

/**
 * Validates if a value is a valid theme
 */
const isValidTheme = (value: unknown): value is Theme => {
  return value === 'light' || value === 'dark';
};

/**
 * Safely checks if sessionStorage is available
 */
const isSessionStorageAvailable = (): boolean => {
  try {
    return typeof window !== 'undefined' && 
           window.sessionStorage !== undefined && 
           window.sessionStorage !== null;
  } catch {
    return false;
  }
};

/**
 * Saves theme preference to sessionStorage
 * @param theme - The theme preference to save
 */
export const saveThemePreference = (theme: Theme): void => {
  try {
    if (!isSessionStorageAvailable()) {
      console.warn('SessionStorage is not available, unable to save theme preference');
      return;
    }

    const serializedTheme = JSON.stringify(theme);
    window.sessionStorage.setItem(THEME_STORAGE_KEY, serializedTheme);
  } catch (error) {
    console.warn('Failed to save theme preference to sessionStorage:', error);
  }
};

/**
 * Loads theme preference from sessionStorage
 * @returns The saved theme preference or null if not found/invalid
 */
export const loadThemePreference = (): Theme | null => {
  try {
    if (!isSessionStorageAvailable()) {
      return null;
    }

    const storedValue = window.sessionStorage.getItem(THEME_STORAGE_KEY);
    
    if (storedValue === null) {
      return null;
    }

    const parsedValue = JSON.parse(storedValue);
    
    // Validate the parsed value is a valid theme
    if (isValidTheme(parsedValue)) {
      return parsedValue;
    }

    // If invalid, clean up the stored value
    clearThemePreference();
    return null;
  } catch (error) {
    console.warn('Failed to load theme preference from sessionStorage:', error);
    // Clean up potentially corrupted data
    clearThemePreference();
    return null;
  }
};

/**
 * Removes theme preference from sessionStorage
 */
export const clearThemePreference = (): void => {
  try {
    if (!isSessionStorageAvailable()) {
      return;
    }

    window.sessionStorage.removeItem(THEME_STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear theme preference from sessionStorage:', error);
  }
};

/**
 * Gets the initial theme preference with fallback chain:
 * 1. Saved preference from sessionStorage
 * 2. System preference (if available)
 * 3. Default to 'light'
 */
export const getInitialThemePreference = (): Theme => {
  // First, try to load saved preference
  const savedPreference = loadThemePreference();
  if (savedPreference !== null) {
    return savedPreference;
  }

  // Fall back to system preference
  try {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
      return darkModeQuery.matches ? 'dark' : 'light';
    }
  } catch (error) {
    console.warn('Failed to detect system theme preference:', error);
  }

  // Final fallback to light theme
  return 'light';
};
