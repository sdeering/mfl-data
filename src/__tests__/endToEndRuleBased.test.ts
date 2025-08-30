import { convertMFLResponseToOVRFormat } from '../utils/playerDataConverter';
import { calculateAllPositionOVRs, calculatePositionOVR } from '../utils/ruleBasedPositionCalculator';

describe('End-to-End Rule-Based Position Rating System', () => {
  describe('Example Player 116267 (Max Pasquier) - Complete Workflow', () => {
    // Example MFL API response from the user's specification
    const exampleMFLResponse = {
      "player": {
        "id": 116267,
        "metadata": {
          "id": 116267,
          "firstName": "Max",
          "lastName": "Pasquier",
          "overall": 82,
          "nationalities": ["FRANCE"],
          "positions": ["LB"],
          "preferredFoot": "LEFT",
          "age": 27,
          "height": 182,
          "pace": 84,
          "shooting": 32,
          "passing": 77,
          "dribbling": 74,
          "defense": 87,
          "physical": 83,
          "goalkeeping": 0
        }
      }
    };

    test('should convert MFL data and calculate all position ratings correctly', () => {
      // Step 1: Convert MFL API data to calculator format
      const convertedPlayer = convertMFLResponseToOVRFormat(exampleMFLResponse);
      
      // Step 2: Calculate all position ratings
      const allRatings = calculateAllPositionOVRs(convertedPlayer);
      
      // Verify the complete workflow works
      expect(allRatings.success).toBe(true);
      expect(allRatings.playerId).toBe(116267);
      expect(allRatings.playerName).toBe('Max Pasquier');
      expect(Object.keys(allRatings.results)).toHaveLength(15);
      
      // Verify specific calculations match the user's example
      expect(allRatings.results.LB.ovr).toBe(82);  // Primary position
      expect(allRatings.results.LWB.ovr).toBe(77); // Fairly familiar
      expect(allRatings.results.ST.ovr).toBe(36);  // Unfamiliar
    });

    test('should calculate individual position ratings correctly', () => {
      const convertedPlayer = convertMFLResponseToOVRFormat(exampleMFLResponse);
      
      // Test LWB calculation (from user's example)
      const lwbResult = calculatePositionOVR(convertedPlayer, 'LWB');
      expect(lwbResult.success).toBe(true);
      expect(lwbResult.ovr).toBe(77);
      expect(lwbResult.penalty).toBe(-5);
      expect(lwbResult.familiarity).toBe('FAMILIAR');
      
      // Test LB calculation (primary position)
      const lbResult = calculatePositionOVR(convertedPlayer, 'LB');
      expect(lbResult.success).toBe(true);
      expect(lbResult.ovr).toBe(82);
      expect(lbResult.penalty).toBe(0);
      expect(lbResult.familiarity).toBe('PRIMARY');
      
      // Test ST calculation (unfamiliar position)
      const stResult = calculatePositionOVR(convertedPlayer, 'ST');
      expect(stResult.success).toBe(true);
      expect(stResult.ovr).toBe(36);
      expect(stResult.penalty).toBe(-20);
      expect(stResult.familiarity).toBe('UNFAMILIAR');
    });

    test('should verify the mathematical calculations step by step', () => {
      const convertedPlayer = convertMFLResponseToOVRFormat(exampleMFLResponse);
      
      // LWB calculation verification
      const lwbResult = calculatePositionOVR(convertedPlayer, 'LWB');
      
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
      
      expect(lwbResult.weightedAverage).toBeCloseTo(82.19, 1);
      expect(lwbResult.ovr).toBe(77);
    });
  });

  describe('Different Player Types', () => {
    test('should handle midfielder correctly', () => {
      const midfielderResponse = {
        "player": {
          "id": 12345,
          "metadata": {
            "id": 12345,
            "firstName": "Mid",
            "lastName": "Fielder",
            "overall": 85,
            "nationalities": ["SPAIN"],
            "positions": ["CM", "CAM"],
            "preferredFoot": "RIGHT",
            "age": 25,
            "height": 175,
            "pace": 75,
            "shooting": 70,
            "passing": 88,
            "dribbling": 82,
            "defense": 65,
            "physical": 78,
            "goalkeeping": 0
          }
        }
      };

      const convertedPlayer = convertMFLResponseToOVRFormat(midfielderResponse);
      const allRatings = calculateAllPositionOVRs(convertedPlayer);
      
      expect(allRatings.success).toBe(true);
      expect(allRatings.results.CM.ovr).toBeGreaterThan(allRatings.results.ST.ovr); // CM should be better than ST
      expect(allRatings.results.CAM.ovr).toBeGreaterThan(allRatings.results.CB.ovr); // CAM should be better than CB
    });

    test('should handle striker correctly', () => {
      const strikerResponse = {
        "player": {
          "id": 67890,
          "metadata": {
            "id": 67890,
            "firstName": "Stri",
            "lastName": "Ker",
            "overall": 87,
            "nationalities": ["BRAZIL"],
            "positions": ["ST", "CF"],
            "preferredFoot": "LEFT",
            "age": 23,
            "height": 180,
            "pace": 88,
            "shooting": 90,
            "passing": 65,
            "dribbling": 85,
            "defense": 35,
            "physical": 75,
            "goalkeeping": 0
          }
        }
      };

      const convertedPlayer = convertMFLResponseToOVRFormat(strikerResponse);
      const allRatings = calculateAllPositionOVRs(convertedPlayer);
      
      expect(allRatings.success).toBe(true);
      expect(allRatings.results.ST.ovr).toBeGreaterThan(allRatings.results.CB.ovr); // ST should be better than CB
      expect(allRatings.results.CF.ovr).toBeGreaterThan(allRatings.results.CDM.ovr); // CF should be better than CDM
    });

    test('should handle defender correctly', () => {
      const defenderResponse = {
        "player": {
          "id": 11111,
          "metadata": {
            "id": 11111,
            "firstName": "Def",
            "lastName": "Ender",
            "overall": 84,
            "nationalities": ["ITALY"],
            "positions": ["CB", "RB"],
            "preferredFoot": "RIGHT",
            "age": 28,
            "height": 185,
            "pace": 65,
            "shooting": 45,
            "passing": 70,
            "dribbling": 55,
            "defense": 88,
            "physical": 85,
            "goalkeeping": 0
          }
        }
      };

      const convertedPlayer = convertMFLResponseToOVRFormat(defenderResponse);
      const allRatings = calculateAllPositionOVRs(convertedPlayer);
      
      expect(allRatings.success).toBe(true);
      // For a defender, CB should be better than ST
      expect(allRatings.results.CB.ovr).toBeGreaterThan(0);
      expect(allRatings.results.RB.ovr).toBeGreaterThan(0);
    });
  });

  describe('Position Familiarity Logic', () => {
    test('should apply correct familiarity penalties', () => {
      const playerResponse = {
        "player": {
          "id": 99999,
          "metadata": {
            "id": 99999,
            "firstName": "Test",
            "lastName": "Player",
            "overall": 80,
            "nationalities": ["ENGLAND"],
            "positions": ["CM"],
            "preferredFoot": "RIGHT",
            "age": 26,
            "height": 175,
            "pace": 75,
            "shooting": 70,
            "passing": 80,
            "dribbling": 75,
            "defense": 65,
            "physical": 80,
            "goalkeeping": 0
          }
        }
      };

      const convertedPlayer = convertMFLResponseToOVRFormat(playerResponse);
      
      // Primary position should have no penalty
      const cmResult = calculatePositionOVR(convertedPlayer, 'CM');
      expect(cmResult.penalty).toBe(0);
      expect(cmResult.familiarity).toBe('PRIMARY');
      
      // Fairly familiar position should have -5 penalty
      const camResult = calculatePositionOVR(convertedPlayer, 'CAM');
      expect(camResult.penalty).toBe(-5);
      expect(camResult.familiarity).toBe('FAMILIAR');
      
      // Fairly familiar position should have -5 penalty
      const cdmResult = calculatePositionOVR(convertedPlayer, 'CDM');
      expect(cdmResult.penalty).toBe(-5);
      expect(cdmResult.familiarity).toBe('FAMILIAR');
      
      // Unfamiliar position should have -20 penalty
      const stResult = calculatePositionOVR(convertedPlayer, 'ST');
      expect(stResult.penalty).toBe(-20);
      expect(stResult.familiarity).toBe('UNFAMILIAR');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle invalid player data gracefully', () => {
      const invalidResponse = {
        "player": {
          "id": 99999,
          "metadata": {
            "id": 99999,
            "firstName": "Invalid",
            "lastName": "Player",
            "overall": 80,
            "positions": ["CM"],
            pace: 100, // Invalid: > 99
            shooting: 80,
            passing: 75,
            dribbling: 70,
            defense: 65,
            physical: 85,
            goalkeeping: 0
          }
        }
      };

      // This should throw an error during validation
      expect(() => convertMFLResponseToOVRFormat(invalidResponse)).toThrow();
    });

    test('should handle goalkeeper with all zero outfield attributes', () => {
      const goalkeeperResponse = {
        "player": {
          "id": 88888,
          "metadata": {
            "id": 88888,
            "firstName": "Goal",
            "lastName": "Keeper",
            "overall": 88,
            "nationalities": ["GERMANY"],
            "positions": ["GK"],
            "preferredFoot": "RIGHT",
            "age": 30,
            "height": 190,
            "pace": 0,
            "shooting": 0,
            "passing": 0,
            "dribbling": 0,
            "defense": 0,
            "physical": 88, // This will be used for GK calculation
            "goalkeeping": 88
          }
        }
      };

      const convertedPlayer = convertMFLResponseToOVRFormat(goalkeeperResponse);
      const allRatings = calculateAllPositionOVRs(convertedPlayer);
      
      expect(allRatings.success).toBe(true);
      expect(allRatings.results.GK.ovr).toBe(88); // Should use physical attribute for GK
    });
  });
});
