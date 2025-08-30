import { RuleBasedPositionCalculator, calculatePositionOVR, calculateAllPositionOVRs } from '../utils/ruleBasedPositionCalculator';
import { PlayerForOVRCalculation } from '../types/positionOvr';

describe('RuleBasedPositionCalculator', () => {
  let calculator: RuleBasedPositionCalculator;

  beforeEach(() => {
    calculator = new RuleBasedPositionCalculator();
  });

  describe('Example Player 116267 (Max Pasquier)', () => {
    // Example player data from the user's specification
    const examplePlayer: PlayerForOVRCalculation = {
      id: 116267,
      name: 'Max Pasquier',
      attributes: {
        PAC: 84,  // pace
        SHO: 32,  // shooting
        PAS: 77,  // passing
        DRI: 74,  // dribbling
        DEF: 87,  // defense
        PHY: 83,  // physical
        GK: 0     // goalkeeping
      },
      positions: ['LB'], // Primary position is LB
      overall: 82
    };

    test('should calculate LWB rating correctly for example player', () => {
      const result = calculatePositionOVR(examplePlayer, 'LWB');
      
      expect(result.success).toBe(true);
      expect(result.position).toBe('LWB');
      
      // Manual calculation verification:
      // LWB weights: PAS: 19%, SHO: 0%, DEF: 44%, DRI: 17%, PAC: 10%, PHY: 10%
      // Player stats: PAS: 77, SHO: 32, DEF: 87, DRI: 74, PAC: 84, PHY: 83
      // Weighted calculation:
      // PAS = 77 * 0.19 = 14.63
      // SHO = 32 * 0.00 = 0
      // DEF = 87 * 0.44 = 38.28
      // DRI = 74 * 0.17 = 12.58
      // PAC = 84 * 0.10 = 8.4
      // PHY = 83 * 0.10 = 8.3
      // Subtotal = 82.19
      // LB to LWB familiarity: Fairly Familiar (-5 penalty)
      // Final rating = 82.19 - 5 = 77.19, rounded to 77
      
      expect(result.ovr).toBe(77);
      expect(result.penalty).toBe(-5);
      expect(result.familiarity).toBe('FAMILIAR');
    });

    test('should calculate LB rating correctly (primary position)', () => {
      const result = calculatePositionOVR(examplePlayer, 'LB');
      
      expect(result.success).toBe(true);
      expect(result.position).toBe('LB');
      
      // LB weights: PAS: 19%, SHO: 0%, DEF: 44%, DRI: 17%, PAC: 10%, PHY: 10%
      // Weighted calculation:
      // PAS = 77 * 0.19 = 14.63
      // SHO = 32 * 0.00 = 0
      // DEF = 87 * 0.44 = 38.28
      // DRI = 74 * 0.17 = 12.58
      // PAC = 84 * 0.10 = 8.4
      // PHY = 83 * 0.10 = 8.3
      // Subtotal = 82.19
      // LB to LB familiarity: Primary position (no penalty)
      // Final rating = 82.19, rounded to 82
      
      expect(result.ovr).toBe(82);
      expect(result.penalty).toBe(0);
      expect(result.familiarity).toBe('PRIMARY');
    });

    test('should calculate ST rating correctly (unfamiliar position)', () => {
      const result = calculatePositionOVR(examplePlayer, 'ST');
      
      expect(result.success).toBe(true);
      expect(result.position).toBe('ST');
      
      // ST weights: PAS: 10%, SHO: 46%, DEF: 0%, DRI: 29%, PAC: 10%, PHY: 5%
      // Weighted calculation:
      // PAS = 77 * 0.10 = 7.7
      // SHO = 32 * 0.46 = 14.72
      // DEF = 87 * 0.00 = 0
      // DRI = 74 * 0.29 = 21.46
      // PAC = 84 * 0.10 = 8.4
      // PHY = 83 * 0.05 = 4.15
      // Subtotal = 56.43
      // LB to ST familiarity: Unfamiliar (-20 penalty)
      // Final rating = 56.43 - 20 = 36.43, rounded to 36
      
      expect(result.ovr).toBe(36);
      expect(result.penalty).toBe(-20);
      expect(result.familiarity).toBe('UNFAMILIAR');
    });

    test('should calculate all position ratings', () => {
      const results = calculateAllPositionOVRs(examplePlayer);
      
      expect(results.success).toBe(true);
      expect(results.playerId).toBe(116267);
      expect(results.playerName).toBe('Max Pasquier');
      
      // Verify all 15 positions are calculated
      expect(Object.keys(results.results)).toHaveLength(15);
      
      // Verify specific positions
      expect(results.results.LB.ovr).toBe(82); // Primary position
      expect(results.results.LWB.ovr).toBe(77); // Fairly familiar
      expect(results.results.ST.ovr).toBe(36); // Unfamiliar
    });

    test('should get best positions correctly', () => {
      const bestPositions = calculator.getBestPositions(examplePlayer, 5);
      
      expect(bestPositions).toHaveLength(5);
      
      // LB should be the best position (primary)
      expect(bestPositions[0].position).toBe('LB');
      expect(bestPositions[0].ovr).toBe(82);
      
      // All ratings should be in descending order
      for (let i = 1; i < bestPositions.length; i++) {
        expect(bestPositions[i].ovr).toBeLessThanOrEqual(bestPositions[i-1].ovr);
      }
    });
  });

  describe('Position Familiarity Matrix', () => {
    test('should return correct familiarity levels', () => {
      // Primary position should be level 3
      expect(calculator.getFamiliarityLevel('LB', 'LB')).toBe(3);
      
      // Fairly familiar positions
      expect(calculator.getFamiliarityLevel('LB', 'LWB')).toBe(2);
      expect(calculator.getFamiliarityLevel('RB', 'RWB')).toBe(2);
      expect(calculator.getFamiliarityLevel('CM', 'CAM')).toBe(2);
      
      // Somewhat familiar positions
      expect(calculator.getFamiliarityLevel('CB', 'RB')).toBe(1);
      expect(calculator.getFamiliarityLevel('CDM', 'CB')).toBe(1);
      
      // Unfamiliar positions
      expect(calculator.getFamiliarityLevel('LB', 'ST')).toBe(0);
      expect(calculator.getFamiliarityLevel('GK', 'CM')).toBe(0);
    });

    test('should return correct penalties', () => {
      expect(calculator.getFamiliarityPenalty(3)).toBe(0);   // Primary
      expect(calculator.getFamiliarityPenalty(2)).toBe(-5);  // Fairly familiar
      expect(calculator.getFamiliarityPenalty(1)).toBe(-8);  // Somewhat familiar
      expect(calculator.getFamiliarityPenalty(0)).toBe(-20); // Unfamiliar
    });
  });

  describe('Position Weights', () => {
    test('should return correct position weights', () => {
      const lbWeights = calculator.getPositionWeights('LB');
      expect(lbWeights).toEqual({
        PAS: 19, SHO: 0, DEF: 44, DRI: 17, PAC: 10, PHY: 10
      });

      const stWeights = calculator.getPositionWeights('ST');
      expect(stWeights).toEqual({
        PAS: 10, SHO: 46, DEF: 0, DRI: 29, PAC: 10, PHY: 5
      });

      const cmWeights = calculator.getPositionWeights('CM');
      expect(cmWeights).toEqual({
        PAS: 43, SHO: 12, DEF: 10, DRI: 29, PAC: 0, PHY: 6
      });
    });

    test('should have weights that sum to 100 for each position', () => {
      const positions: Array<keyof typeof calculator.getPositionWeights> = [
        'ST', 'CF', 'LW', 'RW', 'CAM', 'CM', 'LM', 'RM', 'CDM', 
        'LWB', 'RWB', 'LB', 'RB', 'CB', 'GK'
      ];

      positions.forEach(position => {
        const weights = calculator.getPositionWeights(position);
        const sum = Object.values(weights).reduce((acc, val) => acc + val, 0);
        expect(sum).toBe(100);
      });
    });
  });

  describe('Input Validation', () => {
    test('should validate correct player data', () => {
      const validPlayer: PlayerForOVRCalculation = {
        id: 1,
        name: 'Test Player',
        attributes: {
          PAC: 80, SHO: 70, PAS: 75, DRI: 65, DEF: 60, PHY: 85, GK: 0
        },
        positions: ['CM'],
        overall: 75
      };

      expect(() => calculator.validatePlayer(validPlayer)).not.toThrow();
    });

    test('should reject invalid attributes', () => {
      const invalidPlayer = {
        id: 1,
        name: 'Test Player',
        attributes: {
          PAC: 100, // Invalid: > 99
          SHO: 70, PAS: 75, DRI: 65, DEF: 60, PHY: 85, GK: 0
        },
        positions: ['CM'],
        overall: 75
      };

      expect(() => calculator.validatePlayer(invalidPlayer as any)).toThrow('Invalid attribute PAC: must be 0-99');
    });

    test('should reject invalid positions', () => {
      const invalidPlayer = {
        id: 1,
        name: 'Test Player',
        attributes: {
          PAC: 80, SHO: 70, PAS: 75, DRI: 65, DEF: 60, PHY: 85, GK: 0
        },
        positions: ['INVALID_POSITION'],
        overall: 75
      };

      expect(() => calculator.validatePlayer(invalidPlayer as any)).toThrow('Invalid position: INVALID_POSITION');
    });
  });
});
