import { convertMFLResponseToOVRFormat, validateMFLPlayerData, MFLPlayer } from '../utils/playerDataConverter';
import { PlayerForOVRCalculation } from '../types/positionOvr';

describe('PlayerDataConverter', () => {
  describe('Example Player 116267 (Max Pasquier)', () => {
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
        },
        "ownedBy": {
          "walletAddress": "0x95dc70d7d39f6f76",
          "name": "DogeSports HQ",
          "twitter": "dogesports69",
          "lastActive": 1
        },
        "ownedSince": 1745334407000,
        "activeContract": {
          "id": 778516,
          "status": "ACTIVE",
          "kind": "CONTRACT",
          "revenueShare": 0,
          "totalRevenueShareLocked": 0,
          "club": {
            "id": 28,
            "name": "DogeSports Japan",
            "mainColor": "#ffffff",
            "secondaryColor": "#bc002d",
            "city": "Sapporo",
            "division": 6,
            "logoVersion": "310d504a38fde3c7654a428c9a5fb74c",
            "country": "JAPAN",
            "squads": []
          },
          "startSeason": 18,
          "nbSeasons": 1,
          "autoRenewal": false,
          "createdDateTime": 1756210232392,
          "clauses": []
        },
        "hasPreContract": false,
        "energy": 10000,
        "offerStatus": 1,
        "nbSeasonYellows": 0
      }
    };

    test('should validate MFL player data correctly', () => {
      expect(validateMFLPlayerData(exampleMFLResponse.player)).toBe(true);
    });

    test('should convert MFL response to OVR format correctly', () => {
      const convertedPlayer = convertMFLResponseToOVRFormat(exampleMFLResponse);

      expect(convertedPlayer).toEqual({
        id: 116267,
        name: 'Max Pasquier',
        attributes: {
          PAC: 84,
          SHO: 32,
          PAS: 77,
          DRI: 74,
          DEF: 87,
          PHY: 83,
          GK: 0
        },
        positions: ['LB'],
        overall: 82
      });
    });

    test('should have correct data types', () => {
      const convertedPlayer = convertMFLResponseToOVRFormat(exampleMFLResponse);

      expect(typeof convertedPlayer.id).toBe('number');
      expect(typeof convertedPlayer.name).toBe('string');
      expect(typeof convertedPlayer.overall).toBe('number');
      expect(Array.isArray(convertedPlayer.positions)).toBe(true);
      expect(typeof convertedPlayer.attributes.PAC).toBe('number');
      expect(typeof convertedPlayer.attributes.SHO).toBe('number');
      expect(typeof convertedPlayer.attributes.PAS).toBe('number');
      expect(typeof convertedPlayer.attributes.DRI).toBe('number');
      expect(typeof convertedPlayer.attributes.DEF).toBe('number');
      expect(typeof convertedPlayer.attributes.PHY).toBe('number');
      expect(typeof convertedPlayer.attributes.GK).toBe('number');
    });
  });

  describe('Data Validation', () => {
    test('should reject invalid player data', () => {
      expect(validateMFLPlayerData(null)).toBe(false);
      expect(validateMFLPlayerData(undefined)).toBe(false);
      expect(validateMFLPlayerData({})).toBe(false);
      expect(validateMFLPlayerData({ metadata: {} })).toBe(false);
    });

    test('should reject player data with missing required fields', () => {
      const invalidPlayer = {
        id: 1,
        metadata: {
          id: 1,
          firstName: "Test",
          lastName: "Player",
          overall: 80,
          positions: ["CM"],
          // Missing pace, shooting, etc.
        }
      };

      expect(validateMFLPlayerData(invalidPlayer)).toBe(false);
    });

    test('should reject player data with invalid attribute ranges', () => {
      const invalidPlayer = {
        id: 1,
        metadata: {
          id: 1,
          firstName: "Test",
          lastName: "Player",
          overall: 80,
          positions: ["CM"],
          pace: 100, // Invalid: > 99
          shooting: 80,
          passing: 75,
          dribbling: 70,
          defense: 65,
          physical: 85,
          goalkeeping: 0
        }
      };

      expect(validateMFLPlayerData(invalidPlayer)).toBe(false);
    });

    test('should reject player data with empty positions array', () => {
      const invalidPlayer = {
        id: 1,
        metadata: {
          id: 1,
          firstName: "Test",
          lastName: "Player",
          overall: 80,
          positions: [], // Empty array
          pace: 80,
          shooting: 80,
          passing: 75,
          dribbling: 70,
          defense: 65,
          physical: 85,
          goalkeeping: 0
        }
      };

      expect(validateMFLPlayerData(invalidPlayer)).toBe(false);
    });

    test('should accept valid player data', () => {
      const validPlayer = {
        id: 1,
        metadata: {
          id: 1,
          firstName: "Test",
          lastName: "Player",
          overall: 80,
          nationalities: ["ENGLAND"],
          positions: ["CM", "CAM"],
          preferredFoot: "RIGHT",
          age: 25,
          height: 180,
          pace: 80,
          shooting: 80,
          passing: 75,
          dribbling: 70,
          defense: 65,
          physical: 85,
          goalkeeping: 0
        }
      };

      expect(validateMFLPlayerData(validPlayer)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('should handle player with multiple positions', () => {
      const multiPositionPlayer = {
        player: {
          id: 2,
          metadata: {
            id: 2,
            firstName: "Multi",
            lastName: "Position",
            overall: 85,
            nationalities: ["SPAIN"],
            positions: ["CM", "CAM", "CDM"],
            preferredFoot: "LEFT",
            age: 28,
            height: 175,
            pace: 75,
            shooting: 70,
            passing: 85,
            dribbling: 80,
            defense: 75,
            physical: 80,
            goalkeeping: 0
          }
        }
      };

      const converted = convertMFLResponseToOVRFormat(multiPositionPlayer);
      expect(converted.positions).toEqual(['CM', 'CAM', 'CDM']);
      expect(converted.name).toBe('Multi Position');
    });

    test('should handle goalkeeper data', () => {
      const goalkeeper = {
        player: {
          id: 3,
          metadata: {
            id: 3,
            firstName: "Goal",
            lastName: "Keeper",
            overall: 88,
            nationalities: ["GERMANY"],
            positions: ["GK"],
            preferredFoot: "RIGHT",
            age: 30,
            height: 190,
            pace: 0,
            shooting: 0,
            passing: 0,
            dribbling: 0,
            defense: 0,
            physical: 0,
            goalkeeping: 88
          }
        }
      };

      const converted = convertMFLResponseToOVRFormat(goalkeeper);
      expect(converted.positions).toEqual(['GK']);
      expect(converted.attributes.GK).toBe(88);
      expect(converted.attributes.PAC).toBe(0);
    });
  });
});
