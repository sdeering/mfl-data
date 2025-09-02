import { calculateMarketValue } from '../utils/marketValueCalculator';

// Simplified mock data that matches the actual types
const mockPlayer = {
  id: 116267,
  firstName: 'Test',
  lastName: 'Player',
  overall: 82,
  age: 25,
  height: 180,
  nationalities: ['England'],
  preferredFoot: 'RIGHT' as const,
  positions: ['LB', 'LWB', 'CB'],
  retirementYears: 0,
  pace: 75,
  shooting: 70,
  passing: 75,
  dribbling: 75,
  defense: 82,
  physical: 75,
  goalkeeping: 0
};

const mockComparableListings = [
  { 
    listingResourceId: '1', 
    price: 100, 
    player: { metadata: { age: 24, overall: 80, positions: ['LB'] } }
  },
  { 
    listingResourceId: '2', 
    price: 120, 
    player: { metadata: { age: 25, overall: 82, positions: ['LB'] } }
  },
  { 
    listingResourceId: '3', 
    price: 110, 
    player: { metadata: { age: 26, overall: 81, positions: ['LB'] } }
  }
];

const mockRecentSales = [
  {
    id: '1',
    playerId: 1,
    price: 95,
    purchaseDateTime: Date.now() - (30 * 24 * 60 * 60 * 1000), // 30 days ago
    player: { metadata: { overall: 80 } }
  },
  {
    id: '2',
    playerId: 2,
    price: 115,
    purchaseDateTime: Date.now() - (60 * 24 * 60 * 60 * 1000), // 60 days ago
    player: { metadata: { overall: 82 } }
  }
];

const mockProgressionData = [
  { date: new Date('2020-01-01'), age: 20, overall: 75, pace: 70, shooting: 65, passing: 70, dribbling: 70, defense: 75, physical: 70 },
  { date: new Date('2022-01-01'), age: 22, overall: 78, pace: 72, shooting: 67, passing: 72, dribbling: 72, defense: 78, physical: 72 },
  { date: new Date('2025-01-01'), age: 25, overall: 82, pace: 75, shooting: 70, passing: 75, dribbling: 75, defense: 82, physical: 75 }
];

describe('Market Value Calculator', () => {
  describe('Basic Calculation', () => {
    it('should calculate market value with basic data', () => {
      const result = calculateMarketValue(
        mockPlayer,
        mockComparableListings,
        mockRecentSales,
        mockProgressionData
      );

      expect(result).toHaveProperty('estimatedValue');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('breakdown');
      expect(result).toHaveProperty('details');
      expect(typeof result.estimatedValue).toBe('number');
      expect(result.estimatedValue).toBeGreaterThan(0);
    });

    it('should handle empty comparable listings', () => {
      const result = calculateMarketValue(
        mockPlayer,
        [],
        mockRecentSales,
        mockProgressionData
      );

      expect(result.estimatedValue).toBeGreaterThan(0);
      expect(result.confidence).toBe('low');
    });

    it('should handle empty recent sales', () => {
      const result = calculateMarketValue(
        mockPlayer,
        mockComparableListings,
        [],
        mockProgressionData
      );

      expect(result.estimatedValue).toBeGreaterThan(0);
    });
  });

  describe('Position Premium', () => {
    it('should apply +10% premium for 2 playable positions', () => {
      const positionRatings = {
        'LB': 82, // 0 points difference - playable
        'LWB': 77, // 5 points difference - playable
        'CB': 70, // 12 points difference - not playable
        'RB': 65  // 17 points difference - not playable
      };

      const result = calculateMarketValue(
        mockPlayer,
        mockComparableListings,
        mockRecentSales,
        mockProgressionData,
        positionRatings
      );

      expect(result.breakdown.positionPremium).toBeGreaterThan(0);
      // Should be approximately 10% of base value
      const expectedPremium = Math.round(result.details.baseValue * 0.10);
      expect(result.breakdown.positionPremium).toBe(expectedPremium);
    });

    it('should apply +15% premium for 3 playable positions', () => {
      const positionRatings = {
        'LB': 82, // 0 points difference - playable
        'LWB': 77, // 5 points difference - playable
        'CB': 76, // 6 points difference - playable
        'RB': 65  // 17 points difference - not playable
      };

      const result = calculateMarketValue(
        mockPlayer,
        mockComparableListings,
        mockRecentSales,
        mockProgressionData,
        positionRatings
      );

      expect(result.breakdown.positionPremium).toBeGreaterThan(0);
      // Should be approximately 15% of base value
      const expectedPremium = Math.round(result.details.baseValue * 0.15);
      expect(result.breakdown.positionPremium).toBe(expectedPremium);
    });

    it('should apply +20% premium for 4+ playable positions', () => {
      const positionRatings = {
        'LB': 82, // 0 points difference - playable
        'LWB': 77, // 5 points difference - playable
        'CB': 76, // 6 points difference - playable
        'RB': 78, // 4 points difference - playable
        'CDM': 65  // 17 points difference - not playable
      };

      const result = calculateMarketValue(
        mockPlayer,
        mockComparableListings,
        mockRecentSales,
        mockProgressionData,
        positionRatings
      );

      expect(result.breakdown.positionPremium).toBeGreaterThan(0);
      // Should be approximately 20% of base value
      const expectedPremium = Math.round(result.details.baseValue * 0.20);
      expect(result.breakdown.positionPremium).toBe(expectedPremium);
    });

    it('should not apply premium for single playable position', () => {
      const positionRatings = {
        'LB': 82, // 0 points difference - playable
        'LWB': 70, // 12 points difference - not playable
        'CB': 65, // 17 points difference - not playable
        'RB': 60  // 22 points difference - not playable
      };

      const result = calculateMarketValue(
        mockPlayer,
        mockComparableListings,
        mockRecentSales,
        mockProgressionData,
        positionRatings
      );

      expect(result.breakdown.positionPremium).toBe(0);
    });

    it('should handle position ratings with zero values', () => {
      const positionRatings = {
        'LB': 82, // 0 points difference - playable
        'LWB': 0, // Zero rating - not playable
        'CB': 76, // 6 points difference - playable
        'RB': 0   // Zero rating - not playable
      };

      const result = calculateMarketValue(
        mockPlayer,
        mockComparableListings,
        mockRecentSales,
        mockProgressionData,
        positionRatings
      );

      expect(result.breakdown.positionPremium).toBeGreaterThan(0);
      // Should be approximately 10% of base value (2 playable positions)
      const expectedPremium = Math.round(result.details.baseValue * 0.10);
      expect(result.breakdown.positionPremium).toBe(expectedPremium);
    });

    it('should fallback to original positions logic when positionRatings not provided', () => {
      const playerWithMultiplePositions = {
        ...mockPlayer,
        positions: ['LB', 'LWB', 'CB', 'RB'] as const
      };

      const result = calculateMarketValue(
        playerWithMultiplePositions,
        mockComparableListings,
        mockRecentSales,
        mockProgressionData
        // No positionRatings parameter
      );

      expect(result.breakdown.positionPremium).toBeGreaterThan(0);
      // Should be approximately 20% of base value (4 positions)
      const expectedPremium = Math.round(result.details.baseValue * 0.20);
      expect(result.breakdown.positionPremium).toBe(expectedPremium);
    });
  });

  describe('Progression Premium', () => {
    it('should apply +25% premium for phenomenal progression (20+ points)', () => {
      const highProgressionData = [
        { date: new Date('2020-01-01'), age: 20, overall: 60, pace: 65, shooting: 60, passing: 65, dribbling: 65, defense: 60, physical: 65 },
        { date: new Date('2025-01-01'), age: 25, overall: 82, pace: 75, shooting: 70, passing: 75, dribbling: 75, defense: 82, physical: 75 }
      ];

      const result = calculateMarketValue(
        mockPlayer,
        mockComparableListings,
        mockRecentSales,
        highProgressionData
      );

      expect(result.breakdown.progressionPremium).toBeGreaterThan(0);
      const expectedPremium = Math.round(result.details.baseValue * 0.25);
      expect(result.breakdown.progressionPremium).toBe(expectedPremium);
    });

    it('should apply -15% penalty for zero progression', () => {
      const zeroProgressionData = [
        { date: new Date('2020-01-01'), age: 20, overall: 82, pace: 75, shooting: 70, passing: 75, dribbling: 75, defense: 82, physical: 75 },
        { date: new Date('2025-01-01'), age: 25, overall: 82, pace: 75, shooting: 70, passing: 75, dribbling: 75, defense: 82, physical: 75 }
      ];

      const result = calculateMarketValue(
        mockPlayer,
        mockComparableListings,
        mockRecentSales,
        zeroProgressionData
      );

      expect(result.breakdown.progressionPremium).toBeLessThan(0);
      const expectedPenalty = Math.round(result.details.baseValue * -0.15);
      expect(result.breakdown.progressionPremium).toBe(expectedPenalty);
    });


  });



  describe('Newly Mint Premium', () => {
    it('should apply +10% premium for newly minted players', () => {
      const result = calculateMarketValue(
        mockPlayer,
        mockComparableListings,
        mockRecentSales,
        mockProgressionData,
        undefined,
        0, // retirementYears
        5  // matchCount (less than 10)
      );

      expect(result.breakdown.newlyMintPremium).toBeGreaterThan(0);
      const expectedPremium = Math.round(result.details.baseValue * 0.10);
      expect(result.breakdown.newlyMintPremium).toBe(expectedPremium);
    });

    it('should not apply premium for players with 10+ matches', () => {
      const result = calculateMarketValue(
        mockPlayer,
        mockComparableListings,
        mockRecentSales,
        mockProgressionData,
        undefined,
        0, // retirementYears
        15 // matchCount (more than 10)
      );

      expect(result.breakdown.newlyMintPremium).toBe(0);
    });
  });

  describe('Pace Premium/Penalty', () => {
    it('should apply +10% pace premium for pace >= 90 (non-wide positions)', () => {
      const fastPlayer = {
        ...mockPlayer,
        pace: 90,
        positions: ['CM', 'CAM'] as const // Non-wide positions
      };

      const result = calculateMarketValue(
        fastPlayer,
        mockComparableListings,
        mockRecentSales,
        mockProgressionData
      );

      expect(result.breakdown.pacePremium).toBeGreaterThan(0);
      const expectedPremium = Math.round(result.details.baseValue * 0.10);
      expect(result.breakdown.pacePremium).toBe(expectedPremium);
    });

    it('should apply +5% pace premium for pace 85-89 (non-wide positions)', () => {
      const fastPlayer = {
        ...mockPlayer,
        pace: 87,
        positions: ['CM', 'CAM'] as const // Non-wide positions
      };

      const result = calculateMarketValue(
        fastPlayer,
        mockComparableListings,
        mockRecentSales,
        mockProgressionData
      );

      expect(result.breakdown.pacePremium).toBeGreaterThan(0);
      const expectedPremium = Math.round(result.details.baseValue * 0.05);
      expect(result.breakdown.pacePremium).toBe(expectedPremium);
    });

    it('should not apply pace premium for wide positions', () => {
      const fastWidePlayer = {
        ...mockPlayer,
        pace: 90,
        positions: ['LW', 'RW'] as const // Wide positions
      };

      const result = calculateMarketValue(
        fastWidePlayer,
        mockComparableListings,
        mockRecentSales,
        mockProgressionData
      );

      expect(result.breakdown.pacePremium).toBe(0);
    });

    it('should apply -10% pace penalty for overall > 60 and pace < 50', () => {
      const slowPlayer = {
        ...mockPlayer,
        overall: 70,
        pace: 45
      };

      const result = calculateMarketValue(
        slowPlayer,
        mockComparableListings,
        mockRecentSales,
        mockProgressionData
      );

      expect(result.breakdown.pacePenalty).toBeLessThan(0);
      const expectedPenalty = Math.round(result.details.baseValue * -0.10);
      expect(result.breakdown.pacePenalty).toBe(expectedPenalty);
    });

    it('should not apply pace penalty to goalkeepers', () => {
      const slowGoalkeeper = {
        ...mockPlayer,
        overall: 70,
        pace: 45,
        positions: ['GK'] as const
      };

      const result = calculateMarketValue(
        slowGoalkeeper,
        mockComparableListings,
        mockRecentSales,
        mockProgressionData
      );

      expect(result.breakdown.pacePenalty).toBe(0);
    });
  });

  describe('Height Adjustment (Goalkeepers)', () => {
    it('should apply +5% height premium for GK > 6\'2"', () => {
      const tallGoalkeeper = {
        ...mockPlayer,
        positions: ['GK'] as const,
        height: 190 // 6'3"
      };

      const result = calculateMarketValue(
        tallGoalkeeper,
        mockComparableListings,
        mockRecentSales,
        mockProgressionData
      );

      expect(result.breakdown.heightAdjustment).toBeGreaterThan(0);
      const expectedPremium = Math.max(1, Math.ceil(result.details.baseValue * 0.05));
      expect(result.breakdown.heightAdjustment).toBe(expectedPremium);
    });

    it('should apply -5% height penalty for GK < 5\'9"', () => {
      const shortGoalkeeper = {
        ...mockPlayer,
        positions: ['GK'] as const,
        height: 170 // 5'7"
      };

      const result = calculateMarketValue(
        shortGoalkeeper,
        mockComparableListings,
        mockRecentSales,
        mockProgressionData
      );

      expect(result.breakdown.heightAdjustment).toBeLessThan(0);
      const expectedPenalty = Math.round(result.details.baseValue * -0.05);
      expect(result.breakdown.heightAdjustment).toBe(expectedPenalty);
    });

    it('should not apply height adjustment for non-goalkeepers', () => {
      const nonGoalkeeper = {
        ...mockPlayer,
        positions: ['LB', 'CB'] as const,
        height: 190 // Tall but not GK
      };

      const result = calculateMarketValue(
        nonGoalkeeper,
        mockComparableListings,
        mockRecentSales,
        mockProgressionData
      );

      expect(result.breakdown.heightAdjustment).toBe(0);
    });
  });

  describe('Confidence Levels', () => {
    it('should return high confidence for >= 25 comparable listings', () => {
      const manyListings = Array.from({ length: 30 }, (_, i) => ({
        listingResourceId: `${i}`,
        price: 100 + i,
        player: { metadata: { age: 25, overall: 80, positions: ['LB'] } }
      }));

      const result = calculateMarketValue(
        mockPlayer,
        manyListings,
        mockRecentSales,
        mockProgressionData
      );

      expect(result.confidence).toBe('high');
    });

    it('should return medium confidence for 10-24 comparable listings', () => {
      const mediumListings = Array.from({ length: 15 }, (_, i) => ({
        listingResourceId: `${i}`,
        price: 100 + i,
        player: { metadata: { age: 25, overall: 80, positions: ['LB'] } }
      }));

      const result = calculateMarketValue(
        mockPlayer,
        mediumListings,
        mockRecentSales,
        mockProgressionData
      );

      expect(result.confidence).toBe('medium');
    });

    it('should return low confidence for < 10 comparable listings', () => {
      const fewListings = Array.from({ length: 5 }, (_, i) => ({
        listingResourceId: `${i}`,
        price: 100 + i,
        player: { metadata: { age: 25, overall: 80, positions: ['LB'] } }
      }));

      const result = calculateMarketValue(
        mockPlayer,
        fewListings,
        mockRecentSales,
        mockProgressionData
      );

      expect(result.confidence).toBe('low');
    });
  });

  describe('Small Adjustments Rounding', () => {
    it('should round small positive adjustments up to $1', () => {
      // Create a scenario where a small premium would be calculated
      const result = calculateMarketValue(
        mockPlayer,
        mockComparableListings,
        mockRecentSales,
        mockProgressionData
      );

      // Check that any small adjustments are properly rounded
      const adjustments = [
        result.breakdown.ageAdjustment,
        result.breakdown.overallAdjustment,
        result.breakdown.positionPremium,
        result.breakdown.progressionPremium,
        result.breakdown.retirementPenalty,
        result.breakdown.newlyMintPremium,
        result.breakdown.pacePenalty,
        result.breakdown.pacePremium,
        result.breakdown.heightAdjustment
      ];

      adjustments.forEach(adjustment => {
        if (adjustment > 0 && adjustment < 1) {
          expect(adjustment).toBe(1);
        } else if (adjustment < 0 && adjustment > -1) {
          expect(adjustment).toBe(-1);
        }
      });
    });
  });

  describe('Error Handling', () => {
    it('should throw error when player metadata is missing', () => {
      expect(() => {
        calculateMarketValue(
          null as any,
          mockComparableListings,
          mockRecentSales,
          mockProgressionData
        );
      }).toThrow('Player metadata is required for market value calculation');
    });

    it('should handle missing player metadata gracefully', () => {
      expect(() => {
        calculateMarketValue(
          undefined as any,
          mockComparableListings,
          mockRecentSales,
          mockProgressionData
        );
      }).toThrow('Player metadata is required for market value calculation');
    });
  });
});
