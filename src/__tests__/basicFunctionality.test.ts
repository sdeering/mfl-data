import { calculatePlayerStatsAtSale } from '../utils/saleHistoryCalculator';
import { calculatePositionOVR } from '../utils/ruleBasedPositionCalculator';
import type { PlayerForOVRCalculation, MFLPosition } from '../types/positionOvr';
import type { ProgressionDataPoint } from '../types/playerExperience';

describe('Basic Functionality Tests', () => {
  describe('Position Rating Calculator', () => {
    const testPlayer: PlayerForOVRCalculation = {
      id: 21864,
      name: 'Test Player',
      attributes: {
        PAC: 80,
        SHO: 75,
        PAS: 82,
        DRI: 78,
        DEF: 85,
        PHY: 81,
        GK: 0
      },
      positions: ['LM', 'CAM'] as MFLPosition[],
      overall: 79
    };

    it('should calculate position ratings successfully', () => {
      const lmResult = calculatePositionOVR(testPlayer, 'LM');
      const camResult = calculatePositionOVR(testPlayer, 'CAM');
      const stResult = calculatePositionOVR(testPlayer, 'ST');

      // All calculations should succeed
      expect(lmResult.success).toBe(true);
      expect(camResult.success).toBe(true);
      expect(stResult.success).toBe(true);

      // All results should have valid OVR values
      expect(lmResult.ovr).toBeGreaterThan(0);
      expect(camResult.ovr).toBeGreaterThan(0);
      expect(stResult.ovr).toBeGreaterThan(0);

      // All results should have valid penalties
      expect(lmResult.penalty).toBeLessThanOrEqual(0);
      expect(camResult.penalty).toBeLessThanOrEqual(0);
      expect(stResult.penalty).toBeLessThanOrEqual(0);
    });

    it('should calculate differences from overall rating correctly', () => {
      const lmResult = calculatePositionOVR(testPlayer, 'LM');
      const camResult = calculatePositionOVR(testPlayer, 'CAM');
      const stResult = calculatePositionOVR(testPlayer, 'ST');

      // Calculate differences
      const lmDifference = lmResult.ovr - (testPlayer.overall || 0);
      const camDifference = camResult.ovr - (testPlayer.overall || 0);
      const stDifference = stResult.ovr - (testPlayer.overall || 0);

      // Differences should be numbers
      expect(typeof lmDifference).toBe('number');
      expect(typeof camDifference).toBe('number');
      expect(typeof stDifference).toBe('number');

      // Primary position should have no penalty
      expect(lmResult.penalty).toBe(0);
      expect(lmResult.familiarity).toBe('PRIMARY');

      // Secondary position should have small penalty
      expect(camResult.penalty).toBe(-1);
      expect(camResult.familiarity).toBe('SECONDARY');

      // Unfamiliar position should have large penalty
      expect(stResult.penalty).toBe(-20);
      expect(stResult.familiarity).toBe('UNFAMILIAR');
    });

    it('should handle goalkeeper calculations', () => {
      const gkPlayer: PlayerForOVRCalculation = {
        id: 12345,
        name: 'GK Player',
        attributes: {
          PAC: 50,
          SHO: 30,
          PAS: 40,
          DRI: 35,
          DEF: 45,
          PHY: 60,
          GK: 85
        },
        positions: ['GK'] as MFLPosition[],
        overall: 85
      };

      const gkResult = calculatePositionOVR(gkPlayer, 'GK');
      const cmResult = calculatePositionOVR(gkPlayer, 'CM');

      // GK should be primary position
      expect(gkResult.success).toBe(true);
      expect(gkResult.penalty).toBe(0);
      expect(gkResult.familiarity).toBe('PRIMARY');

      // CM should be unfamiliar for GK
      expect(cmResult.success).toBe(true);
      expect(cmResult.penalty).toBe(-20);
      expect(cmResult.familiarity).toBe('UNFAMILIAR');
    });
  });

  describe('Sale History Calculator', () => {
    const mockProgressionData: ProgressionDataPoint[] = [
      {
        date: new Date('2024-01-01'),
        overall: 79,
        age: 23.5,
        pace: 80,
        shooting: 75,
        passing: 82,
        dribbling: 78,
        defense: 85,
        physical: 81
      },
      {
        date: new Date('2024-02-01'),
        overall: 81,
        age: 23.8,
        pace: 82,
        shooting: 77,
        passing: 84,
        dribbling: 80,
        defense: 87,
        physical: 83
      }
    ];

    it('should calculate stats for valid sale dates', () => {
      const saleDate = new Date('2024-02-15').getTime();
      const result = calculatePlayerStatsAtSale(saleDate, mockProgressionData);

      expect(result).not.toBeNull();
      if (result) {
        // Should return valid stats
        expect(result.overall).toBeGreaterThan(0);
        expect(result.pace).toBeGreaterThan(0);
        expect(result.shooting).toBeGreaterThan(0);
        expect(result.passing).toBeGreaterThan(0);
        expect(result.dribbling).toBeGreaterThan(0);
        expect(result.defense).toBeGreaterThan(0);
        expect(result.physical).toBeGreaterThan(0);
        expect(result.goalkeeping).toBe(0); // Always 0 for non-GK players
      }
    });

    it('should handle empty progression data', () => {
      const saleDate = new Date('2024-02-01').getTime();
      const result = calculatePlayerStatsAtSale(saleDate, []);

      // Should return null for empty data
      expect(result).toBeNull();
    });

    it('should handle single progression data point', () => {
      const singleData = [mockProgressionData[0]];
      const saleDate = new Date('2024-02-01').getTime();
      const result = calculatePlayerStatsAtSale(saleDate, singleData);

      expect(result).not.toBeNull();
      if (result) {
        // Should use the single data point
        expect(result.overall).toBe(79);
        expect(result.pace).toBe(80);
      }
    });
  });

  describe('Position Familiarity Logic', () => {
    const testPlayer: PlayerForOVRCalculation = {
      id: 12345,
      name: 'Test Player',
      attributes: {
        PAC: 80,
        SHO: 75,
        PAS: 82,
        DRI: 78,
        DEF: 85,
        PHY: 81,
        GK: 0
      },
      positions: ['LB'] as MFLPosition[],
      overall: 82
    };

    it('should apply correct familiarity penalties', () => {
      // Primary position (LB) - no penalty
      const lbResult = calculatePositionOVR(testPlayer, 'LB');
      expect(lbResult.penalty).toBe(0);
      expect(lbResult.familiarity).toBe('PRIMARY');

      // Secondary position (LWB) - -5 penalty
      const lwbResult = calculatePositionOVR(testPlayer, 'LWB');
      expect(lwbResult.penalty).toBe(-5);
      expect(lwbResult.familiarity).toBe('FAMILIAR');

      // Unfamiliar position (ST) - -20 penalty
      const stResult = calculatePositionOVR(testPlayer, 'ST');
      expect(stResult.penalty).toBe(-20);
      expect(stResult.familiarity).toBe('UNFAMILIAR');
    });

    it('should handle multiple positions correctly', () => {
      const multiPositionPlayer: PlayerForOVRCalculation = {
        ...testPlayer,
        positions: ['LB', 'LWB', 'CB'] as MFLPosition[]
      };

      // Primary position (LB) - no penalty
      const lbResult = calculatePositionOVR(multiPositionPlayer, 'LB');
      expect(lbResult.penalty).toBe(0);

      // Secondary positions (LWB, CB) - -1 penalty each
      const lwbResult = calculatePositionOVR(multiPositionPlayer, 'LWB');
      expect(lwbResult.penalty).toBe(-1);

      const cbResult = calculatePositionOVR(multiPositionPlayer, 'CB');
      expect(cbResult.penalty).toBe(-1);

      // Unfamiliar position (ST) - -20 penalty
      const stResult = calculatePositionOVR(multiPositionPlayer, 'ST');
      expect(stResult.penalty).toBe(-20);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid player data gracefully', () => {
      const invalidPlayer = {
        id: 12345,
        name: 'Invalid Player',
        attributes: {
          PAC: -5, // Invalid negative value
          SHO: 105, // Invalid value > 99
          PAS: 82,
          DRI: 78,
          DEF: 85,
          PHY: 81,
          GK: 0
        },
        positions: ['CM'] as MFLPosition[],
        overall: 82
      };

      const result = calculatePositionOVR(invalidPlayer, 'CM');
      expect(result.success).toBe(false); // Should fail validation
    });

    it('should handle valid player data successfully', () => {
      const validPlayer = {
        id: 12345,
        name: 'Valid Player',
        attributes: {
          PAC: 80,
          SHO: 75,
          PAS: 82,
          DRI: 78,
          DEF: 85,
          PHY: 81,
          GK: 0
        },
        positions: ['CM'] as MFLPosition[],
        overall: 82
      };

      const result = calculatePositionOVR(validPlayer, 'CM');
      expect(result.success).toBe(true); // Should succeed
    });
  });

  describe('Data Validation', () => {
    it('should validate position rating calculations return expected structure', () => {
      const testPlayer: PlayerForOVRCalculation = {
        id: 12345,
        name: 'Test Player',
        attributes: {
          PAC: 80,
          SHO: 75,
          PAS: 82,
          DRI: 78,
          DEF: 85,
          PHY: 81,
          GK: 0
        },
        positions: ['CM'] as MFLPosition[],
        overall: 82
      };

      const result = calculatePositionOVR(testPlayer, 'CM');

      // Should have all expected properties
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('position');
      expect(result).toHaveProperty('ovr');
      expect(result).toHaveProperty('penalty');
      expect(result).toHaveProperty('familiarity');
      expect(result).toHaveProperty('weightedAverage');

      // Should have correct data types
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.position).toBe('string');
      expect(typeof result.ovr).toBe('number');
      expect(typeof result.penalty).toBe('number');
      expect(typeof result.familiarity).toBe('string');
      expect(typeof result.weightedAverage).toBe('number');
    });

    it('should validate sale history calculations return expected structure', () => {
      const mockData: ProgressionDataPoint[] = [
        {
          date: new Date('2024-01-01'),
          overall: 79,
          age: 23.5,
          pace: 80,
          shooting: 75,
          passing: 82,
          dribbling: 78,
          defense: 85,
          physical: 81
        }
      ];

      const saleDate = new Date('2024-02-01').getTime();
      const result = calculatePlayerStatsAtSale(saleDate, mockData);

      expect(result).not.toBeNull();
      if (result) {
        // Should have all expected properties
        expect(result).toHaveProperty('overall');
        expect(result).toHaveProperty('age');
        expect(result).toHaveProperty('pace');
        expect(result).toHaveProperty('dribbling');
        expect(result).toHaveProperty('passing');
        expect(result).toHaveProperty('shooting');
        expect(result).toHaveProperty('defense');
        expect(result).toHaveProperty('physical');
        expect(result).toHaveProperty('goalkeeping');

        // Should have correct data types
        expect(typeof result.overall).toBe('number');
        expect(typeof result.age).toBe('number');
        expect(typeof result.pace).toBe('number');
        expect(typeof result.dribbling).toBe('number');
        expect(typeof result.passing).toBe('number');
        expect(typeof result.shooting).toBe('number');
        expect(typeof result.defense).toBe('number');
        expect(typeof result.physical).toBe('number');
        expect(typeof result.goalkeeping).toBe('number');
      }
    });
  });
});
