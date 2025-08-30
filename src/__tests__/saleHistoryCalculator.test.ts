import { calculatePlayerStatsAtSale } from '../utils/saleHistoryCalculator';
import type { ProgressionDataPoint } from '../types/playerExperience';

describe('SaleHistoryCalculator', () => {
  const mockProgressionData: ProgressionDataPoint[] = [
    {
      date: new Date('2024-01-01'),
      overall: 79,
      pace: 80,
      shooting: 75,
      passing: 82,
      dribbling: 78,
      defense: 85,
      physical: 81,
      goalkeeping: 0
    },
    {
      date: new Date('2024-02-01'),
      overall: 81,
      pace: 82,
      shooting: 77,
      passing: 84,
      dribbling: 80,
      defense: 87,
      physical: 83,
      goalkeeping: 0
    },
    {
      date: new Date('2024-03-01'),
      overall: 83,
      pace: 84,
      shooting: 79,
      passing: 86,
      dribbling: 82,
      defense: 89,
      physical: 85,
      goalkeeping: 0
    }
  ];

  describe('calculatePlayerStatsAtSale', () => {
    it('should calculate stats for a sale that occurred after progression data', () => {
      const saleDate = new Date('2024-04-01');
      const result = calculatePlayerStatsAtSale(mockProgressionData, saleDate);

      // Should use the latest progression data (2024-03-01)
      expect(result.overall).toBe(83);
      expect(result.pace).toBe(84);
      expect(result.shooting).toBe(79);
      expect(result.passing).toBe(86);
      expect(result.dribbling).toBe(82);
      expect(result.defense).toBe(89);
      expect(result.physical).toBe(85);
      expect(result.goalkeeping).toBe(0);
    });

    it('should calculate stats for a sale that occurred during progression data', () => {
      const saleDate = new Date('2024-02-15');
      const result = calculatePlayerStatsAtSale(mockProgressionData, saleDate);

      // Should use the progression data from 2024-02-01 (closest before sale date)
      expect(result.overall).toBe(81);
      expect(result.pace).toBe(82);
      expect(result.shooting).toBe(77);
      expect(result.passing).toBe(84);
      expect(result.dribbling).toBe(80);
      expect(result.defense).toBe(87);
      expect(result.physical).toBe(83);
      expect(result.goalkeeping).toBe(0);
    });

    it('should calculate stats for a sale that occurred before progression data', () => {
      const saleDate = new Date('2023-12-01');
      const result = calculatePlayerStatsAtSale(mockProgressionData, saleDate);

      // Should use the earliest progression data (2024-01-01) as fallback
      expect(result.overall).toBe(79);
      expect(result.pace).toBe(80);
      expect(result.shooting).toBe(75);
      expect(result.passing).toBe(82);
      expect(result.dribbling).toBe(78);
      expect(result.defense).toBe(85);
      expect(result.physical).toBe(81);
      expect(result.goalkeeping).toBe(0);
    });

    it('should handle exact date matches', () => {
      const saleDate = new Date('2024-02-01');
      const result = calculatePlayerStatsAtSale(mockProgressionData, saleDate);

      // Should use the exact matching date
      expect(result.overall).toBe(81);
      expect(result.pace).toBe(82);
      expect(result.shooting).toBe(77);
      expect(result.passing).toBe(84);
      expect(result.dribbling).toBe(80);
      expect(result.defense).toBe(87);
      expect(result.physical).toBe(83);
      expect(result.goalkeeping).toBe(0);
    });

    it('should handle empty progression data', () => {
      const saleDate = new Date('2024-02-01');
      const result = calculatePlayerStatsAtSale([], saleDate);

      // Should return default values
      expect(result.overall).toBe(0);
      expect(result.pace).toBe(0);
      expect(result.shooting).toBe(0);
      expect(result.passing).toBe(0);
      expect(result.dribbling).toBe(0);
      expect(result.defense).toBe(0);
      expect(result.physical).toBe(0);
      expect(result.goalkeeping).toBe(0);
    });

    it('should handle single progression data point', () => {
      const singleDataPoint = [mockProgressionData[0]];
      const saleDate = new Date('2024-02-01');
      const result = calculatePlayerStatsAtSale(singleDataPoint, saleDate);

      // Should use the single data point
      expect(result.overall).toBe(79);
      expect(result.pace).toBe(80);
      expect(result.shooting).toBe(75);
      expect(result.passing).toBe(82);
      expect(result.dribbling).toBe(78);
      expect(result.defense).toBe(85);
      expect(result.physical).toBe(81);
      expect(result.goalkeeping).toBe(0);
    });

    it('should handle progression data with missing stats', () => {
      const incompleteData: ProgressionDataPoint[] = [
        {
          date: new Date('2024-01-01'),
          overall: 79,
          pace: 80,
          shooting: 75,
          passing: 82,
          dribbling: 78,
          defense: 85,
          physical: 81,
          goalkeeping: 0
        },
        {
          date: new Date('2024-02-01'),
          overall: 81,
          pace: 82,
          shooting: 77,
          passing: 84,
          dribbling: 80,
          defense: 87,
          physical: 83,
          goalkeeping: 0
        }
      ];

      const saleDate = new Date('2024-02-15');
      const result = calculatePlayerStatsAtSale(incompleteData, saleDate);

      // Should use the available data from 2024-02-01
      expect(result.overall).toBe(81);
      expect(result.pace).toBe(82);
      expect(result.shooting).toBe(77);
      expect(result.passing).toBe(84);
      expect(result.dribbling).toBe(80);
      expect(result.defense).toBe(87);
      expect(result.physical).toBe(83);
      expect(result.goalkeeping).toBe(0);
    });

    it('should handle progression data with zero values', () => {
      const zeroData: ProgressionDataPoint[] = [
        {
          date: new Date('2024-01-01'),
          overall: 79,
          pace: 0,
          shooting: 75,
          passing: 82,
          dribbling: 78,
          defense: 85,
          physical: 81,
          goalkeeping: 0
        }
      ];

      const saleDate = new Date('2024-02-01');
      const result = calculatePlayerStatsAtSale(zeroData, saleDate);

      // Should handle zero values correctly
      expect(result.overall).toBe(79);
      expect(result.pace).toBe(0);
      expect(result.shooting).toBe(75);
      expect(result.passing).toBe(82);
      expect(result.dribbling).toBe(78);
      expect(result.defense).toBe(85);
      expect(result.physical).toBe(81);
      expect(result.goalkeeping).toBe(0);
    });

    it('should handle progression data with high values', () => {
      const highData: ProgressionDataPoint[] = [
        {
          date: new Date('2024-01-01'),
          overall: 95,
          pace: 99,
          shooting: 98,
          passing: 97,
          dribbling: 96,
          defense: 95,
          physical: 94,
          goalkeeping: 0
        }
      ];

      const saleDate = new Date('2024-02-01');
      const result = calculatePlayerStatsAtSale(highData, saleDate);

      // Should handle high values correctly
      expect(result.overall).toBe(95);
      expect(result.pace).toBe(99);
      expect(result.shooting).toBe(98);
      expect(result.passing).toBe(97);
      expect(result.dribbling).toBe(96);
      expect(result.defense).toBe(95);
      expect(result.physical).toBe(94);
      expect(result.goalkeeping).toBe(0);
    });

    it('should handle progression data with decimal values', () => {
      const decimalData: ProgressionDataPoint[] = [
        {
          date: new Date('2024-01-01'),
          overall: 79.5,
          pace: 80.2,
          shooting: 75.8,
          passing: 82.1,
          dribbling: 78.9,
          defense: 85.3,
          physical: 81.7,
          goalkeeping: 0
        }
      ];

      const saleDate = new Date('2024-02-01');
      const result = calculatePlayerStatsAtSale(decimalData, saleDate);

      // Should handle decimal values correctly
      expect(result.overall).toBe(79.5);
      expect(result.pace).toBe(80.2);
      expect(result.shooting).toBe(75.8);
      expect(result.passing).toBe(82.1);
      expect(result.dribbling).toBe(78.9);
      expect(result.defense).toBe(85.3);
      expect(result.physical).toBe(81.7);
      expect(result.goalkeeping).toBe(0);
    });

    it('should handle progression data with negative values', () => {
      const negativeData: ProgressionDataPoint[] = [
        {
          date: new Date('2024-01-01'),
          overall: 79,
          pace: -5, // Invalid negative value
          shooting: 75,
          passing: 82,
          dribbling: 78,
          defense: 85,
          physical: 81,
          goalkeeping: 0
        }
      ];

      const saleDate = new Date('2024-02-01');
      const result = calculatePlayerStatsAtSale(negativeData, saleDate);

      // Should handle negative values (though they shouldn't occur in real data)
      expect(result.overall).toBe(79);
      expect(result.pace).toBe(-5);
      expect(result.shooting).toBe(75);
      expect(result.passing).toBe(82);
      expect(result.dribbling).toBe(78);
      expect(result.defense).toBe(85);
      expect(result.physical).toBe(81);
      expect(result.goalkeeping).toBe(0);
    });

    it('should handle progression data with undefined values', () => {
      const undefinedData: ProgressionDataPoint[] = [
        {
          date: new Date('2024-01-01'),
          overall: 79,
          pace: 80,
          shooting: 75,
          passing: 82,
          dribbling: 78,
          defense: 85,
          physical: 81,
          goalkeeping: 0
        },
        {
          date: new Date('2024-02-01'),
          overall: 81,
          pace: undefined as any, // Invalid undefined value
          shooting: 77,
          passing: 84,
          dribbling: 80,
          defense: 87,
          physical: 83,
          goalkeeping: 0
        }
      ];

      const saleDate = new Date('2024-02-15');
      const result = calculatePlayerStatsAtSale(undefinedData, saleDate);

      // Should handle undefined values gracefully
      expect(result.overall).toBe(81);
      expect(result.pace).toBeUndefined();
      expect(result.shooting).toBe(77);
      expect(result.passing).toBe(84);
      expect(result.dribbling).toBe(80);
      expect(result.defense).toBe(87);
      expect(result.physical).toBe(83);
      expect(result.goalkeeping).toBe(0);
    });

    it('should handle progression data with null values', () => {
      const nullData: ProgressionDataPoint[] = [
        {
          date: new Date('2024-01-01'),
          overall: 79,
          pace: 80,
          shooting: 75,
          passing: 82,
          dribbling: 78,
          defense: 85,
          physical: 81,
          goalkeeping: 0
        },
        {
          date: new Date('2024-02-01'),
          overall: 81,
          pace: null as any, // Invalid null value
          shooting: 77,
          passing: 84,
          dribbling: 80,
          defense: 87,
          physical: 83,
          goalkeeping: 0
        }
      ];

      const saleDate = new Date('2024-02-15');
      const result = calculatePlayerStatsAtSale(nullData, saleDate);

      // Should handle null values gracefully
      expect(result.overall).toBe(81);
      expect(result.pace).toBeNull();
      expect(result.shooting).toBe(77);
      expect(result.passing).toBe(84);
      expect(result.dribbling).toBe(80);
      expect(result.defense).toBe(87);
      expect(result.physical).toBe(83);
      expect(result.goalkeeping).toBe(0);
    });

    it('should handle progression data with string values', () => {
      const stringData: ProgressionDataPoint[] = [
        {
          date: new Date('2024-01-01'),
          overall: 79,
          pace: 80,
          shooting: 75,
          passing: 82,
          dribbling: 78,
          defense: 85,
          physical: 81,
          goalkeeping: 0
        },
        {
          date: new Date('2024-02-01'),
          overall: 81,
          pace: 'invalid' as any, // Invalid string value
          shooting: 77,
          passing: 84,
          dribbling: 80,
          defense: 87,
          physical: 83,
          goalkeeping: 0
        }
      ];

      const saleDate = new Date('2024-02-15');
      const result = calculatePlayerStatsAtSale(stringData, saleDate);

      // Should handle string values gracefully
      expect(result.overall).toBe(81);
      expect(result.pace).toBe('invalid');
      expect(result.shooting).toBe(77);
      expect(result.passing).toBe(84);
      expect(result.dribbling).toBe(80);
      expect(result.defense).toBe(87);
      expect(result.physical).toBe(83);
      expect(result.goalkeeping).toBe(0);
    });
  });
});
