import { cmToFeetInches, formatHeight } from '../utils/heightConverter';

describe('Height Converter', () => {
  describe('cmToFeetInches', () => {
    it('should convert 171cm to 5\' 8"', () => {
      expect(cmToFeetInches(171)).toBe('5\' 8"');
    });

    it('should convert 180cm to 5\' 11"', () => {
      expect(cmToFeetInches(180)).toBe('5\' 11"');
    });

    it('should convert 185cm to 6\' 1"', () => {
      expect(cmToFeetInches(185)).toBe('6\' 1"');
    });

    it('should convert 170cm to 5\' 7"', () => {
      expect(cmToFeetInches(170)).toBe('5\' 7"');
    });

    it('should handle edge case where inches rounds up to 12', () => {
      // 182.88cm = 72 inches = 6 feet exactly
      expect(cmToFeetInches(182.88)).toBe('6\' 0"');
    });

    it('should return empty string for invalid input', () => {
      expect(cmToFeetInches(0)).toBe('');
      expect(cmToFeetInches(-10)).toBe('');
    });
  });

  describe('formatHeight', () => {
    it('should format 171cm correctly', () => {
      expect(formatHeight(171)).toBe('171cm / 5\' 8"');
    });

    it('should format 180cm correctly', () => {
      expect(formatHeight(180)).toBe('180cm / 5\' 11"');
    });

    it('should handle invalid input', () => {
      expect(formatHeight(0)).toBe('Not available');
      expect(formatHeight(-10)).toBe('Not available');
    });
  });
});
