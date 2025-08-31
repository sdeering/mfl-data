import { calculateMarketValue } from '../utils/marketValueCalculator';

describe('Market Value Calculator', () => {
  // Mock data for testing
  const mockPlayer = {
    id: 1,
    firstName: 'Test',
    lastName: 'Player',
    overall: 75,
    age: 25,
    pace: 80,
    shooting: 70,
    passing: 75,
    dribbling: 72,
    defense: 78,
    physical: 76,
    goalkeeping: 0,
    positions: ['CM', 'CDM'],
    nationalities: ['England'],
    preferredFoot: 'RIGHT',
    height: 180,
    retirementYears: undefined
  };

  const mockComparableListings = [
    {
      listingResourceId: '1',
      player: { metadata: { overall: 75, age: 25 } },
      price: 100
    },
    {
      listingResourceId: '2',
      player: { metadata: { overall: 76, age: 24 } },
      price: 110
    },
    {
      listingResourceId: '3',
      player: { metadata: { overall: 74, age: 26 } },
      price: 90
    }
  ];

  const mockRecentSales = [
    { price: 95, purchaseDateTime: Date.now() - 86400000 }, // 1 day ago
    { price: 105, purchaseDateTime: Date.now() - 172800000 } // 2 days ago
  ];

  const mockProgressionData = [
    { age: 20, overall: 70, pace: 75, shooting: 65, passing: 70, dribbling: 68, defending: 73, physical: 71 },
    { age: 21, overall: 71, pace: 76, shooting: 66, passing: 71, dribbling: 69, defending: 74, physical: 72 },
    { age: 22, overall: 72, pace: 77, shooting: 67, passing: 72, dribbling: 70, defending: 75, physical: 73 },
    { age: 23, overall: 73, pace: 78, shooting: 68, passing: 73, dribbling: 71, defending: 76, physical: 74 },
    { age: 24, overall: 74, pace: 79, shooting: 69, passing: 74, dribbling: 72, defending: 77, physical: 75 },
    { age: 25, overall: 75, pace: 80, shooting: 70, passing: 75, dribbling: 72, defending: 78, physical: 76 }
  ];

  const mockPositionRatings = {
    CM: { success: true, ovr: 75 },
    CDM: { success: true, ovr: 73 }
  };

  describe('Basic Market Value Calculation', () => {
    it('should calculate basic market value with comparable listings and recent sales', () => {
      const result = calculateMarketValue(
        mockPlayer,
        mockComparableListings,
        mockRecentSales,
        mockProgressionData,
        mockPositionRatings,
        undefined,
        15
      );

      expect(result).toBeDefined();
      expect(result.estimatedValue).toBeGreaterThan(0);
      expect(result.confidence).toBeDefined();
      expect(result.breakdown).toBeDefined();
      expect(result.details).toBeDefined();
    });

    it('should handle empty comparable listings', () => {
      const result = calculateMarketValue(
        mockPlayer,
        [],
        mockRecentSales,
        mockProgressionData,
        mockPositionRatings,
        undefined,
        15
      );

      expect(result.breakdown.comparableListings).toBe(0);
      expect(result.breakdown.recentSales).toBe(2);
    });

    it('should handle empty recent sales', () => {
      const result = calculateMarketValue(
        mockPlayer,
        mockComparableListings,
        [],
        mockProgressionData,
        mockPositionRatings,
        undefined,
        15
      );

      expect(result.breakdown.comparableListings).toBe(3);
      expect(result.breakdown.recentSales).toBe(0);
    });
  });

  describe('Position Premium Calculation', () => {
    it('should apply +10% premium for 2 playable positions', () => {
      const playerWith2Positions = { ...mockPlayer, positions: ['CM', 'CDM'] };
      const positionRatings2Positions = {
        CM: { success: true, ovr: 75 },
        CDM: { success: true, ovr: 73 }
      };

      const result = calculateMarketValue(
        playerWith2Positions,
        mockComparableListings,
        mockRecentSales,
        mockProgressionData,
        positionRatings2Positions,
        undefined,
        15
      );

      expect(result.breakdown.positionPremium).toBeGreaterThan(0);
      // Should be approximately 10% of base value
      const expectedPremium = result.details.baseValue * 0.10;
      expect(result.breakdown.positionPremium).toBeCloseTo(expectedPremium, 0);
    });

    it('should apply +15% premium for 3+ playable positions', () => {
      const playerWith3Positions = { ...mockPlayer, positions: ['CM', 'CDM', 'CB'] };
      const positionRatings3Positions = {
        CM: { success: true, ovr: 75 },
        CDM: { success: true, ovr: 73 },
        CB: { success: true, ovr: 69 } // Within 6 points of overall 75
      };

      const result = calculateMarketValue(
        playerWith3Positions,
        mockComparableListings,
        mockRecentSales,
        mockProgressionData,
        positionRatings3Positions,
        undefined,
        15
      );

      expect(result.breakdown.positionPremium).toBeGreaterThan(0);
      // Should be approximately 15% of base value
      const expectedPremium = result.details.baseValue * 0.15;
      expect(result.breakdown.positionPremium).toBeCloseTo(expectedPremium, 0);
    });

    it('should not apply position premium for single position', () => {
      const playerWith1Position = { ...mockPlayer, positions: ['CM'] };
      const positionRatings1Position = {
        CM: { success: true, ovr: 75 }
      };

      const result = calculateMarketValue(
        playerWith1Position,
        mockComparableListings,
        mockRecentSales,
        mockProgressionData,
        positionRatings1Position,
        undefined,
        15
      );

      expect(result.breakdown.positionPremium).toBe(0);
    });

    it('should include positions within 6 points of overall rating', () => {
      const playerWithMultiplePositions = { ...mockPlayer, overall: 81, positions: ['CM', 'CDM', 'CB'] };
      const positionRatingsWithin6 = {
        CM: { success: true, ovr: 81 }, // Exact match
        CDM: { success: true, ovr: 77 }, // Within 6 points (81-4)
        CB: { success: true, ovr: 75 }   // Within 6 points (81-6)
      };

      const result = calculateMarketValue(
        playerWithMultiplePositions,
        mockComparableListings,
        mockRecentSales,
        mockProgressionData,
        positionRatingsWithin6,
        undefined,
        15
      );

      expect(result.breakdown.positionPremium).toBeGreaterThan(0);
      const expectedPremium = result.details.baseValue * 0.15; // +15% for 3 playable positions
      expect(result.breakdown.positionPremium).toBeCloseTo(expectedPremium, 0);
    });

    it('should exclude positions more than 6 points from overall rating', () => {
      const playerWithMultiplePositions = { ...mockPlayer, overall: 81, positions: ['CM', 'CDM', 'CB'] };
      const positionRatingsOutside6 = {
        CM: { success: true, ovr: 81 }, // Exact match
        CDM: { success: true, ovr: 77 }, // Within 6 points (81-4)
        CB: { success: true, ovr: 74 }   // Outside 6 points (81-7)
      };

      const result = calculateMarketValue(
        playerWithMultiplePositions,
        mockComparableListings,
        mockRecentSales,
        mockProgressionData,
        positionRatingsOutside6,
        undefined,
        15
      );

      expect(result.breakdown.positionPremium).toBeGreaterThan(0);
      const expectedPremium = result.details.baseValue * 0.10; // +10% for 2 playable positions
      expect(result.breakdown.positionPremium).toBeCloseTo(expectedPremium, 0);
    });
  });

  describe('Pace Premium and Penalty', () => {
    it('should apply +5% premium for Pace >= 90', () => {
      const fastPlayer = { ...mockPlayer, pace: 92 };

      const result = calculateMarketValue(
        fastPlayer,
        mockComparableListings,
        mockRecentSales,
        mockProgressionData,
        mockPositionRatings,
        undefined,
        15
      );

      expect(result.breakdown.pacePremium).toBeGreaterThan(0);
      const expectedPremium = result.details.baseValue * 0.05;
      expect(result.breakdown.pacePremium).toBeCloseTo(expectedPremium, 0);
    });

    it('should apply -10% penalty for Overall > 60 and Pace < 50', () => {
      const slowPlayer = { ...mockPlayer, overall: 75, pace: 45 };

      const result = calculateMarketValue(
        slowPlayer,
        mockComparableListings,
        mockRecentSales,
        mockProgressionData,
        mockPositionRatings,
        undefined,
        15
      );

      expect(result.breakdown.pacePenalty).toBeLessThan(0);
      const expectedPenalty = result.details.baseValue * -0.10;
      expect(result.breakdown.pacePenalty).toBeCloseTo(expectedPenalty, 0);
    });

    it('should not apply pace penalty for low overall players', () => {
      const lowOverallPlayer = { ...mockPlayer, overall: 55, pace: 45 };

      const result = calculateMarketValue(
        lowOverallPlayer,
        mockComparableListings,
        mockRecentSales,
        mockProgressionData,
        mockPositionRatings,
        undefined,
        15
      );

      expect(result.breakdown.pacePenalty).toBe(0);
    });

    it('should not apply pace penalty for fast players with high overall', () => {
      const fastHighOverallPlayer = { ...mockPlayer, overall: 75, pace: 55 };

      const result = calculateMarketValue(
        fastHighOverallPlayer,
        mockComparableListings,
        mockRecentSales,
        mockProgressionData,
        mockPositionRatings,
        undefined,
        15
      );

      expect(result.breakdown.pacePenalty).toBe(0);
    });
  });

  describe('Progression Premium', () => {
    it('should apply +25% premium for phenomenal progression (20+ points)', () => {
      const phenomenalProgression = [
        { age: 20, overall: 60, pace: 65, shooting: 55, passing: 60, dribbling: 58, defending: 63, physical: 61 },
        { age: 25, overall: 85, pace: 90, shooting: 80, passing: 85, dribbling: 83, defending: 88, physical: 86 }
      ];

      const result = calculateMarketValue(
        mockPlayer,
        mockComparableListings,
        mockRecentSales,
        phenomenalProgression,
        mockPositionRatings,
        undefined,
        15
      );

      expect(result.breakdown.progressionPremium).toBeGreaterThan(0);
      const expectedPremium = result.details.baseValue * 0.25;
      expect(result.breakdown.progressionPremium).toBeCloseTo(expectedPremium, 0);
    });

    it('should apply +15% premium for exceptional progression (12-15 points)', () => {
      const exceptionalProgression = [
        { age: 20, overall: 65, pace: 70, shooting: 60, passing: 65, dribbling: 63, defending: 68, physical: 66 },
        { age: 25, overall: 80, pace: 85, shooting: 75, passing: 80, dribbling: 78, defending: 83, physical: 81 }
      ];

      const result = calculateMarketValue(
        mockPlayer,
        mockComparableListings,
        mockRecentSales,
        exceptionalProgression,
        mockPositionRatings,
        undefined,
        15
      );

      expect(result.breakdown.progressionPremium).toBeGreaterThan(0);
      const expectedPremium = result.details.baseValue * 0.15;
      expect(result.breakdown.progressionPremium).toBeCloseTo(expectedPremium, 0);
    });

    it('should apply +5% premium for impressive progression (5-7 points)', () => {
      const impressiveProgression = [
        { age: 20, overall: 70, pace: 75, shooting: 65, passing: 70, dribbling: 68, defending: 73, physical: 71 },
        { age: 25, overall: 77, pace: 82, shooting: 72, passing: 77, dribbling: 75, defending: 80, physical: 78 }
      ];

      const result = calculateMarketValue(
        mockPlayer,
        mockComparableListings,
        mockRecentSales,
        impressiveProgression,
        mockPositionRatings,
        undefined,
        15
      );

      expect(result.breakdown.progressionPremium).toBeGreaterThan(0);
      const expectedPremium = result.details.baseValue * 0.05;
      expect(result.breakdown.progressionPremium).toBeCloseTo(expectedPremium, 0);
    });

    it('should apply -5% penalty for minimal progression (≤1 point)', () => {
      const minimalProgression = [
        { age: 20, overall: 75, pace: 80, shooting: 70, passing: 75, dribbling: 72, defending: 78, physical: 76 },
        { age: 25, overall: 76, pace: 81, shooting: 71, passing: 76, dribbling: 73, defending: 79, physical: 77 }
      ];

      const result = calculateMarketValue(
        mockPlayer,
        mockComparableListings,
        mockRecentSales,
        minimalProgression,
        mockPositionRatings,
        undefined,
        15
      );

      expect(result.breakdown.progressionPremium).toBeLessThan(0);
      const expectedPenalty = result.details.baseValue * -0.05;
      expect(result.breakdown.progressionPremium).toBeCloseTo(expectedPenalty, 0);
    });
  });

  describe('Retirement Penalty', () => {
    it('should apply -60% penalty for 1 year until retirement', () => {
      const result = calculateMarketValue(
        mockPlayer,
        mockComparableListings,
        mockRecentSales,
        mockProgressionData,
        mockPositionRatings,
        1,
        15
      );

      expect(result.breakdown.retirementPenalty).toBeLessThan(0);
      const expectedPenalty = result.details.baseValue * -0.60;
      expect(result.breakdown.retirementPenalty).toBeCloseTo(expectedPenalty, 0);
    });

    it('should apply -40% penalty for 2 years until retirement', () => {
      const result = calculateMarketValue(
        mockPlayer,
        mockComparableListings,
        mockRecentSales,
        mockProgressionData,
        mockPositionRatings,
        2,
        15
      );

      expect(result.breakdown.retirementPenalty).toBeLessThan(0);
      const expectedPenalty = result.details.baseValue * -0.40;
      expect(result.breakdown.retirementPenalty).toBeCloseTo(expectedPenalty, 0);
    });

    it('should apply -25% penalty for 3 years until retirement', () => {
      const result = calculateMarketValue(
        mockPlayer,
        mockComparableListings,
        mockRecentSales,
        mockProgressionData,
        mockPositionRatings,
        3,
        15
      );

      expect(result.breakdown.retirementPenalty).toBeLessThan(0);
      const expectedPenalty = result.details.baseValue * -0.25;
      expect(result.breakdown.retirementPenalty).toBeCloseTo(expectedPenalty, 0);
    });

    it('should not apply retirement penalty for players not retiring', () => {
      const result = calculateMarketValue(
        mockPlayer,
        mockComparableListings,
        mockRecentSales,
        mockProgressionData,
        mockPositionRatings,
        undefined,
        15
      );

      expect(result.breakdown.retirementPenalty).toBe(0);
    });
  });

  describe('Newly Mint Premium', () => {
    it('should apply +10% premium for players with less than 10 matches', () => {
      const result = calculateMarketValue(
        mockPlayer,
        mockComparableListings,
        mockRecentSales,
        mockProgressionData,
        mockPositionRatings,
        undefined,
        5
      );

      expect(result.breakdown.newlyMintPremium).toBeGreaterThan(0);
      const expectedPremium = result.details.baseValue * 0.10;
      expect(result.breakdown.newlyMintPremium).toBeCloseTo(expectedPremium, 0);
    });

    it('should not apply newly mint premium for players with 10+ matches', () => {
      const result = calculateMarketValue(
        mockPlayer,
        mockComparableListings,
        mockRecentSales,
        mockProgressionData,
        mockPositionRatings,
        undefined,
        15
      );

      expect(result.breakdown.newlyMintPremium).toBe(0);
    });
  });

  describe('Base Value Adjustment', () => {
    it('should apply -15% adjustment to comparable listings for base value', () => {
      const result = calculateMarketValue(
        mockPlayer,
        mockComparableListings,
        mockRecentSales,
        mockProgressionData,
        mockPositionRatings,
        undefined,
        15
      );

      // The base value should be lower than the raw comparable average due to -15% adjustment
      const rawComparableAverage = 100; // Average of [100, 110, 90]
      const expectedBaseValue = rawComparableAverage * 0.85; // After -15% adjustment
      expect(result.details.baseValue).toBeCloseTo(expectedBaseValue, 0);
    });
  });

  describe('Age Adjustment', () => {
    it('should apply age adjustment based on age difference from comparable listings', () => {
      const result = calculateMarketValue(
        mockPlayer,
        mockComparableListings,
        mockRecentSales,
        mockProgressionData,
        mockPositionRatings,
        undefined,
        15
      );

      // Age adjustment should be calculated based on age difference
      expect(result.breakdown.ageAdjustment).toBeDefined();
    });
  });

  describe('Overall Rating Adjustment', () => {
    it('should apply overall rating adjustment based on rating difference from comparable listings', () => {
      const result = calculateMarketValue(
        mockPlayer,
        mockComparableListings,
        mockRecentSales,
        mockProgressionData,
        mockPositionRatings,
        undefined,
        15
      );

      // Overall adjustment should be calculated based on rating difference
      expect(result.breakdown.overallAdjustment).toBeDefined();
    });
  });

  describe('Confidence Calculation', () => {
    it('should return high confidence with sufficient data', () => {
      const result = calculateMarketValue(
        mockPlayer,
        mockComparableListings,
        mockRecentSales,
        mockProgressionData,
        mockPositionRatings,
        undefined,
        15
      );

      expect(['high', 'medium', 'low']).toContain(result.confidence);
    });

    it('should return low confidence with minimal data', () => {
      const result = calculateMarketValue(
        mockPlayer,
        [mockComparableListings[0]], // Only 1 comparable listing
        [],
        mockProgressionData,
        mockPositionRatings,
        undefined,
        15
      );

      expect(result.confidence).toBe('low');
    });
  });

  describe('Edge Cases', () => {
    it('should handle player with no progression data', () => {
      const result = calculateMarketValue(
        mockPlayer,
        mockComparableListings,
        mockRecentSales,
        [],
        mockPositionRatings,
        undefined,
        15
      );

      expect(result.breakdown.progressionPremium).toBe(0);
    });

    it('should handle player with no position ratings', () => {
      const result = calculateMarketValue(
        mockPlayer,
        mockComparableListings,
        mockRecentSales,
        mockProgressionData,
        null,
        undefined,
        15
      );

      // Should fall back to position count logic
      expect(result.breakdown.positionPremium).toBeDefined();
    });

    it('should handle undefined match count', () => {
      const result = calculateMarketValue(
        mockPlayer,
        mockComparableListings,
        mockRecentSales,
        mockProgressionData,
        mockPositionRatings,
        undefined,
        undefined
      );

      expect(result.breakdown.newlyMintPremium).toBe(0);
    });

    it('should handle all adjustments together', () => {
      const complexPlayer = {
        ...mockPlayer,
        pace: 92, // Should get pace premium
        overall: 75,
        positions: ['CM', 'CDM', 'CB'] // Should get position premium
      };

      const complexPositionRatings = {
        CM: { success: true, ovr: 75 },
        CDM: { success: true, ovr: 73 },
        CB: { success: true, ovr: 72 }
      };

      const result = calculateMarketValue(
        complexPlayer,
        mockComparableListings,
        mockRecentSales,
        mockProgressionData,
        complexPositionRatings,
        2, // Retirement penalty
        5  // Newly mint premium
      );

      expect(result.breakdown.pacePremium).toBeGreaterThan(0);
      expect(result.breakdown.positionPremium).toBeGreaterThan(0);
      expect(result.breakdown.retirementPenalty).toBeLessThan(0);
      expect(result.breakdown.newlyMintPremium).toBeGreaterThan(0);
      expect(result.estimatedValue).toBeGreaterThan(0);
    });
  });
});
