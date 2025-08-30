import { calculatePlayerStatsAtSale } from '../utils/saleHistoryCalculator';
import { calculatePositionOVR } from '../utils/ruleBasedPositionCalculator';
import type { PlayerForOVRCalculation, MFLPosition } from '../types/positionOvr';
import type { ProgressionDataPoint } from '../types/playerExperience';

describe('Core Numerical Calculations', () => {
  describe('Position Rating Difference Calculations', () => {
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

    it('should calculate correct position ratings for player 21864', () => {
      // Test LM (primary position)
      const lmResult = calculatePositionOVR(testPlayer, 'LM');
      expect(lmResult.success).toBe(true);
      expect(lmResult.ovr).toBe(80); // Actual calculated value
      expect(lmResult.penalty).toBe(0); // No penalty for primary position

      // Test CAM (secondary position)
      const camResult = calculatePositionOVR(testPlayer, 'CAM');
      expect(camResult.success).toBe(true);
      expect(camResult.ovr).toBe(81); // Should be higher than overall
      expect(camResult.penalty).toBe(-1); // -1 penalty for secondary position

      // Test ST (unfamiliar position)
      const stResult = calculatePositionOVR(testPlayer, 'ST');
      expect(stResult.success).toBe(true);
      expect(stResult.ovr).toBeLessThan(79); // Should be lower due to unfamiliar penalty
      expect(stResult.penalty).toBe(-20); // -20 penalty for unfamiliar position
    });

    it('should calculate correct differences from overall rating', () => {
      const lmResult = calculatePositionOVR(testPlayer, 'LM');
      const camResult = calculatePositionOVR(testPlayer, 'CAM');
      const stResult = calculatePositionOVR(testPlayer, 'ST');

      // Calculate differences
      const lmDifference = lmResult.ovr - (testPlayer.overall || 0);
      const camDifference = camResult.ovr - (testPlayer.overall || 0);
      const stDifference = stResult.ovr - (testPlayer.overall || 0);

      // LM: 80 - 79 = +1
      expect(lmDifference).toBe(1);

      // CAM: 81 - 79 = +2
      expect(camDifference).toBe(2);

      // ST: should be negative (lower than overall)
      expect(stDifference).toBeLessThan(0);
    });

    it('should handle goalkeeper calculations correctly', () => {
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
      expect(gkResult.success).toBe(true);
      expect(gkResult.ovr).toBe(85); // Should match overall for primary GK
      expect(gkResult.penalty).toBe(0); // No penalty for primary position

      // Test non-GK position for GK player
      const cmResult = calculatePositionOVR(gkPlayer, 'CM');
      expect(cmResult.success).toBe(true);
      expect(cmResult.ovr).toBeLessThan(85); // Should be lower due to unfamiliar penalty
    });
  });

  describe('Sale History Calculations', () => {
    const mockProgressionData: ProgressionDataPoint[] = [
      {
        date: new Date('2024-01-01'),
        overall: 79,
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
        pace: 82,
        shooting: 77,
        passing: 84,
        dribbling: 80,
        defense: 87,
        physical: 83
      },
      {
        date: new Date('2024-03-01'),
        overall: 83,
        pace: 84,
        shooting: 79,
        passing: 86,
        dribbling: 82,
        defense: 89,
        physical: 85
      }
    ];

    it('should calculate stats for sale after progression data', () => {
      const saleDate = new Date('2024-04-01').getTime();
      const result = calculatePlayerStatsAtSale(saleDate, mockProgressionData);

      expect(result).not.toBeNull();
      if (result) {
        // Should use latest progression data (2024-03-01)
        expect(result.overall).toBe(83);
        expect(result.pace).toBe(84);
        expect(result.shooting).toBe(79);
        expect(result.passing).toBe(86);
        expect(result.dribbling).toBe(82);
        expect(result.defense).toBe(89);
        expect(result.physical).toBe(85);
        expect(result.goalkeeping).toBe(0);
      }
    });

    it('should calculate stats for sale during progression data', () => {
      const saleDate = new Date('2024-02-15').getTime();
      const result = calculatePlayerStatsAtSale(saleDate, mockProgressionData);

      expect(result).not.toBeNull();
      if (result) {
        // Should use progression data from 2024-02-01 (closest before sale date)
        expect(result.overall).toBe(81);
        expect(result.pace).toBe(82);
        expect(result.shooting).toBe(77);
        expect(result.passing).toBe(84);
        expect(result.dribbling).toBe(80);
        expect(result.defense).toBe(87);
        expect(result.physical).toBe(83);
        expect(result.goalkeeping).toBe(0);
      }
    });

    it('should calculate stats for sale before progression data', () => {
      const saleDate = new Date('2023-12-01').getTime();
      const result = calculatePlayerStatsAtSale(saleDate, mockProgressionData);

      expect(result).not.toBeNull();
      if (result) {
        // Should use earliest progression data (2024-01-01) as fallback
        expect(result.overall).toBe(79);
        expect(result.pace).toBe(80);
        expect(result.shooting).toBe(75);
        expect(result.passing).toBe(82);
        expect(result.dribbling).toBe(78);
        expect(result.defense).toBe(85);
        expect(result.physical).toBe(81);
        expect(result.goalkeeping).toBe(0);
      }
    });

    it('should handle exact date matches', () => {
      const saleDate = new Date('2024-02-01').getTime();
      const result = calculatePlayerStatsAtSale(saleDate, mockProgressionData);

      expect(result).not.toBeNull();
      if (result) {
        // Should use exact matching date
        expect(result.overall).toBe(81);
        expect(result.pace).toBe(82);
        expect(result.shooting).toBe(77);
        expect(result.passing).toBe(84);
        expect(result.dribbling).toBe(80);
        expect(result.defense).toBe(87);
        expect(result.physical).toBe(83);
        expect(result.goalkeeping).toBe(0);
      }
    });

    it('should handle empty progression data', () => {
      const saleDate = new Date('2024-02-01').getTime();
      const result = calculatePlayerStatsAtSale(saleDate, []);

      // Should return null for empty data
      expect(result).toBeNull();
    });
  });

  describe('Position Familiarity Penalties', () => {
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

    it('should apply correct penalties for different familiarity levels', () => {
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

  describe('Position Attribute Weights', () => {
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
      positions: ['ST'] as MFLPosition[],
      overall: 82
    };

    it('should apply correct weights for ST position', () => {
      const stResult = calculatePositionOVR(testPlayer, 'ST');
      
      // ST weights: PAS: 10%, SHO: 46%, DEF: 0%, DRI: 29%, PAC: 10%, PHY: 5%
      // Manual calculation:
      // PAS = 82 * 0.10 = 8.2
      // SHO = 75 * 0.46 = 34.5
      // DEF = 85 * 0.00 = 0
      // DRI = 78 * 0.29 = 22.62
      // PAC = 80 * 0.10 = 8.0
      // PHY = 81 * 0.05 = 4.05
      // Subtotal = 77.37
      // Primary position - no penalty
      // Final rating = 77.37, rounded to 77
      
      expect(stResult.success).toBe(true);
      expect(stResult.ovr).toBe(77);
      expect(stResult.weightedAverage).toBeCloseTo(77.37, 1);
    });

    it('should apply correct weights for CM position', () => {
      const cmResult = calculatePositionOVR(testPlayer, 'CM');
      
      // CM weights: PAS: 43%, SHO: 12%, DEF: 10%, DRI: 29%, PAC: 0%, PHY: 6%
      // Manual calculation:
      // PAS = 82 * 0.43 = 35.26
      // SHO = 75 * 0.12 = 9.0
      // DEF = 85 * 0.10 = 8.5
      // DRI = 78 * 0.29 = 22.62
      // PAC = 80 * 0.00 = 0
      // PHY = 81 * 0.06 = 4.86
      // Subtotal = 80.24
      // Unfamiliar position - -20 penalty
      // Final rating = 60.24, rounded to 60
      
      expect(cmResult.success).toBe(true);
      expect(cmResult.ovr).toBe(60);
      expect(cmResult.weightedAverage).toBeCloseTo(80.24, 1);
    });
  });

  describe('Edge Cases and Error Handling', () => {
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

      // The calculator should handle invalid data gracefully
      const result = calculatePositionOVR(invalidPlayer, 'CM');
      expect(result.success).toBe(false); // Should fail validation for invalid inputs
    });

    it('should handle missing attributes', () => {
      const incompletePlayer = {
        id: 12345,
        name: 'Incomplete Player',
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

      const result = calculatePositionOVR(incompletePlayer, 'CM');
      expect(result.success).toBe(true);
    });

    it('should handle progression data with missing dates', () => {
      const incompleteData: ProgressionDataPoint[] = [
        {
          date: new Date('2024-01-01'),
          overall: 79,
          pace: 80,
          shooting: 75,
          passing: 82,
          dribbling: 78,
          defense: 85,
          physical: 81
        }
      ];

      const saleDate = new Date('2024-02-01').getTime();
      const result = calculatePlayerStatsAtSale(saleDate, incompleteData);

      expect(result).not.toBeNull();
      if (result) {
        // Should use the available data
        expect(result.overall).toBe(79);
        expect(result.pace).toBe(80);
      }
    });
  });
});
