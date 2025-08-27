import { saveThemePreference, loadThemePreference, clearThemePreference } from '../utils/themeStorage';
import type { Theme } from '../types/theme';

// Mock sessionStorage
const createMockSessionStorage = () => {
  let store: Record<string, string> = {};

  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: jest.fn((index: number) => Object.keys(store)[index] || null),
    store,
  };
};

let mockSessionStorage: ReturnType<typeof createMockSessionStorage>;

describe('themeStorage utilities', () => {
  beforeEach(() => {
    // Create fresh mock for each test
    mockSessionStorage = createMockSessionStorage();
    
    // Reset mocks and storage before each test
    Object.defineProperty(window, 'sessionStorage', {
      value: mockSessionStorage,
      writable: true,
    });
    jest.clearAllMocks();
  });

  describe('saveThemePreference', () => {
    it('should save light theme preference to sessionStorage', () => {
      saveThemePreference('light');
      
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'mfl-data-theme-preference',
        JSON.stringify('light')
      );
    });

    it('should save dark theme preference to sessionStorage', () => {
      saveThemePreference('dark');
      
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'mfl-data-theme-preference',
        JSON.stringify('dark')
      );
    });

    it('should handle sessionStorage unavailability gracefully', () => {
      // Mock sessionStorage to throw an error
      mockSessionStorage.setItem.mockImplementation(() => {
        throw new Error('SessionStorage not available');
      });

      // Should not throw an error
      expect(() => saveThemePreference('light')).not.toThrow();
      
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'mfl-data-theme-preference',
        JSON.stringify('light')
      );
    });

    it('should handle JSON serialization errors gracefully', () => {
      // Mock JSON.stringify to throw an error
      const originalStringify = JSON.stringify;
      JSON.stringify = jest.fn(() => {
        throw new Error('Serialization error');
      });

      // Should not throw an error
      expect(() => saveThemePreference('light')).not.toThrow();
      
      // Restore original JSON.stringify
      JSON.stringify = originalStringify;
    });
  });

  describe('loadThemePreference', () => {
    it('should load saved theme preference from sessionStorage', () => {
      // Save a preference first
      mockSessionStorage.store['mfl-data-theme-preference'] = JSON.stringify('dark');
      
      const result = loadThemePreference();
      
      expect(mockSessionStorage.getItem).toHaveBeenCalledWith('mfl-data-theme-preference');
      expect(result).toBe('dark');
    });

    it('should return null when no preference is saved', () => {
      const result = loadThemePreference();
      
      expect(mockSessionStorage.getItem).toHaveBeenCalledWith('mfl-data-theme-preference');
      expect(result).toBeNull();
    });

    it('should return null when sessionStorage is unavailable', () => {
      // Mock sessionStorage to throw an error
      mockSessionStorage.getItem.mockImplementation(() => {
        throw new Error('SessionStorage not available');
      });

      const result = loadThemePreference();
      
      expect(result).toBeNull();
    });

    it('should return null when stored value is invalid JSON', () => {
      // Store invalid JSON directly in the store
      mockSessionStorage.store['mfl-data-theme-preference'] = 'invalid-json';
      
      const result = loadThemePreference();
      
      expect(result).toBeNull();
    });

    it('should return null when stored value is not a valid theme', () => {
      // Store invalid theme value directly in the store
      mockSessionStorage.store['mfl-data-theme-preference'] = JSON.stringify('invalid-theme');
      
      const result = loadThemePreference();
      
      expect(result).toBeNull();
    });

    it('should validate theme values strictly', () => {
      // Test valid themes
      mockSessionStorage.store['mfl-data-theme-preference'] = JSON.stringify('light');
      expect(loadThemePreference()).toBe('light');
      
      mockSessionStorage.store['mfl-data-theme-preference'] = JSON.stringify('dark');
      expect(loadThemePreference()).toBe('dark');
      
      // Test invalid themes
      const invalidThemes = ['', 'blue', 'auto', 'system', 1, true, null, undefined];
      
      invalidThemes.forEach(invalidTheme => {
        mockSessionStorage.store['mfl-data-theme-preference'] = JSON.stringify(invalidTheme);
        expect(loadThemePreference()).toBeNull();
      });
    });
  });

  describe('clearThemePreference', () => {
    it('should remove theme preference from sessionStorage', () => {
      // Save a preference first
      mockSessionStorage.store['mfl-data-theme-preference'] = JSON.stringify('dark');
      
      clearThemePreference();
      
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('mfl-data-theme-preference');
    });

    it('should handle sessionStorage unavailability gracefully', () => {
      // Mock sessionStorage to throw an error
      mockSessionStorage.removeItem.mockImplementation(() => {
        throw new Error('SessionStorage not available');
      });

      // Should not throw an error
      expect(() => clearThemePreference()).not.toThrow();
      
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('mfl-data-theme-preference');
    });
  });

  describe('integration with window.sessionStorage undefined', () => {
    it('should handle missing sessionStorage gracefully', () => {
      // Remove sessionStorage entirely
      Object.defineProperty(window, 'sessionStorage', {
        value: undefined,
        writable: true,
      });

      // All functions should work without throwing errors
      expect(() => saveThemePreference('light')).not.toThrow();
      expect(loadThemePreference()).toBeNull();
      expect(() => clearThemePreference()).not.toThrow();
    });
  });

  describe('storage key consistency', () => {
    it('should use consistent storage key across all operations', () => {
      const expectedKey = 'mfl-data-theme-preference';
      
      saveThemePreference('light');
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(expectedKey, expect.any(String));
      
      loadThemePreference();
      expect(mockSessionStorage.getItem).toHaveBeenCalledWith(expectedKey);
      
      clearThemePreference();
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith(expectedKey);
    });
  });
});
