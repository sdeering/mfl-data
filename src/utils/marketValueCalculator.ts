import type { MarketListing } from '../services/marketDataService';
import type { PlayerSaleHistoryEntry } from '../types/playerSaleHistory';
import type { MFLPlayerMetadata } from '../types/mflApi';
import type { ProgressionDataPoint } from '../types/playerExperience';

export interface MarketValueEstimate {
  estimatedValue: number;
  confidence: 'high' | 'medium' | 'low';
  breakdown: {
    comparableListings: number;
    recentSales: number;
    ageAdjustment: number;
    overallAdjustment: number;
          positionPremium: number;
      progressionPremium: number;
      retirementPenalty: number;
      newlyMintPremium: number;
      pacePenalty: number;
      pacePremium: number;
      heightAdjustment: number;
      totalAdjustments: number;
  };
  details: {
    comparableListings: MarketListing[];
    recentSales: PlayerSaleHistoryEntry[];
    comparableAverage: number;
    recentSalesAverage: number;
    baseValue: number;
  };
}

export function calculateMarketValue(
  player: MFLPlayerMetadata,
  comparableListings: MarketListing[],
  recentSales: PlayerSaleHistoryEntry[],
  progressionData: ProgressionDataPoint[] = [],
  positionRatings?: { [position: string]: number },
  retirementYears?: number,
  matchCount?: number,
  playerId?: number
): MarketValueEstimate {
  // Validate that player metadata exists
  if (!player) {
    throw new Error('Player metadata is required for market value calculation');
  }
  

  let baseValue = 0;
  let comparableAverage = 0;
  let recentSalesAverage = 0;
  
  // Calculate average from comparable listings
  if (comparableListings && comparableListings.length > 0) {
    // Filter out extreme outliers (prices more than 3x the median)
    const prices = comparableListings.map(listing => listing.price).sort((a, b) => a - b);
    const medianPrice = prices[Math.floor(prices.length / 2)];
    const maxReasonablePrice = medianPrice * 3;
    
    const filteredListings = comparableListings.filter(listing => listing.price <= maxReasonablePrice);
    
    if (filteredListings.length > 0) {
      comparableAverage = filteredListings.reduce((sum, listing) => sum + listing.price, 0) / filteredListings.length;
      // Apply -20% adjustment to account for live listings vs sold listings difference
      baseValue = comparableAverage * 0.80;
    } else {
      // If all listings were filtered out, use the original average
      comparableAverage = comparableListings.reduce((sum, listing) => sum + listing.price, 0) / comparableListings.length;
      baseValue = comparableAverage * 0.80;
    }
  }
  
  // Calculate weighted average from recent sales (last 3 sales)
  const recentSalesData = recentSales ? recentSales.slice(0, 3) : [];
  if (recentSalesData.length > 0) {
    const now = Date.now();
    const oneYearInMs = 365 * 24 * 60 * 60 * 1000;
    
    // Calculate weighted average based on time ago and overall rating similarity
    let totalWeightedPrice = 0;
    let totalWeight = 0;
    
    recentSalesData.forEach(sale => {
      // Time weight: More recent sales get higher weight
      const timeAgo = now - sale.purchaseDateTime;
      const timeWeight = Math.max(0.1, 1 - (timeAgo / oneYearInMs)); // 1.0 for recent, 0.1 for 1+ year old
      
      // Overall rating weight: Sales with similar overall ratings get higher weight
      const overallAtSale = sale.player?.metadata?.overall || player.overall;
      const overallDifference = Math.abs(player.overall - overallAtSale);
      const overallWeight = Math.max(0.1, 1 - (overallDifference / 10)); // 1.0 for same rating, 0.1 for 10+ point difference
      
      // Combined weight (time and overall rating)
      const combinedWeight = timeWeight * overallWeight;
      
      totalWeightedPrice += sale.price * combinedWeight;
      totalWeight += combinedWeight;
    });
    
    recentSalesAverage = totalWeight > 0 ? totalWeightedPrice / totalWeight : 0;
    
    // If we have both comparable listings and recent sales, weight them
    if (comparableListings.length > 0) {
      // Calculate base value using average of comparableAverage and recentSalesAverage
      baseValue = (comparableAverage + recentSalesAverage) / 2;
    } else {
      baseValue = recentSalesAverage;
    }
  }
  
  // If no market data available, use enhanced fallback calculation
  if (baseValue === 0) {
    // Enhanced fallback calculation based on multiple factors
    let fallbackBaseValue = 0;
    
    // Base value by overall rating tiers (more realistic curve)
    if (player.overall >= 90) {
      fallbackBaseValue = 800 + (player.overall - 90) * 100; // $800-$1300 for 90+
    } else if (player.overall >= 85) {
      fallbackBaseValue = 400 + (player.overall - 85) * 80; // $400-$800 for 85-89
    } else if (player.overall >= 80) {
      fallbackBaseValue = 200 + (player.overall - 80) * 40; // $200-$400 for 80-84
    } else if (player.overall >= 75) {
      fallbackBaseValue = 100 + (player.overall - 75) * 20; // $100-$200 for 75-79
    } else if (player.overall >= 70) {
      fallbackBaseValue = 50 + (player.overall - 70) * 10; // $50-$100 for 70-74
    } else {
      fallbackBaseValue = Math.max(25, player.overall * 3); // $25-$210 for <70
    }
    
    // Age adjustment (younger players more valuable)
    const ageAdjustment = player.age <= 25 ? fallbackBaseValue * 0.2 : 
                         player.age <= 30 ? 0 : 
                         player.age <= 35 ? fallbackBaseValue * -0.1 : fallbackBaseValue * -0.3;
    
    // Position premium (attacking positions more valuable)
    const positionPremium = player.positions.some(pos => ['ST', 'CF', 'CAM', 'LW', 'RW'].includes(pos)) ? 
                           fallbackBaseValue * 0.15 : 0;
    
    // Multiple positions bonus
    const multiPositionBonus = player.positions.length > 1 ? fallbackBaseValue * 0.1 : 0;
    
    baseValue = fallbackBaseValue + ageAdjustment + positionPremium + multiPositionBonus;
  }
  
  // Round base value to whole number for display consistency
  const roundedBaseValue = Math.max(1, Math.round(baseValue)); // Ensure minimum value of 1 to avoid division issues
  
  // Apply adjustments
  let totalAdjustments = 0;
  
  // Age adjustment (weight based on age difference from comparable listings)
  let ageAdjustment = 0;
  if (comparableListings.length > 0) {
    const avgComparableAge = comparableListings.reduce((sum, listing) => sum + (listing.player?.metadata?.age || 0), 0) / comparableListings.length;
    const ageDifference = (player.age || 0) - avgComparableAge;
    // 2% adjustment per year of age difference
    ageAdjustment = roundedBaseValue * (ageDifference * 0.02);
    totalAdjustments += ageAdjustment;
  }
  
  // Overall rating adjustment
  let overallAdjustment = 0;
  if (comparableListings.length > 0) {
    const avgComparableOverall = comparableListings.reduce((sum, listing) => sum + (listing.player?.metadata?.overall || 0), 0) / comparableListings.length;
    const overallDifference = (player.overall || 0) - avgComparableOverall;
    // 3% adjustment per overall point difference
    overallAdjustment = roundedBaseValue * (overallDifference * 0.03);
    totalAdjustments += overallAdjustment;
  }
  
  // Position premium (dynamic based on calculated position ratings within 5 points of overall)
  let positionPremium = 0;
  
  if (positionRatings) {
    // Count positions where the calculated rating is within 6 points of overall
    const playablePositions = Object.entries(positionRatings).filter(([position, rating]) => {
      return rating > 0 && Math.abs((rating || 0) - (player.overall || 0)) <= 6;
    });
    
    const playablePositionCount = playablePositions.length;
    

    
    if (playablePositionCount > 1) {
      // Position premium based on number of playable positions
      if (playablePositionCount === 2) {
        positionPremium = roundedBaseValue * 0.10; // +10% for 2 playable positions
      } else if (playablePositionCount === 3) {
        positionPremium = roundedBaseValue * 0.15; // +15% for 3 playable positions
      } else if (playablePositionCount >= 4) {
        positionPremium = roundedBaseValue * 0.20; // +20% for 4+ playable positions
      }
      
      totalAdjustments += positionPremium;
    }
  } else {
    // Fallback to original logic if position ratings not available
    if (player.positions.length > 1) {
      if (player.positions.length === 2) {
        positionPremium = roundedBaseValue * 0.10; // +10% for 2 positions
      } else if (player.positions.length === 3) {
        positionPremium = roundedBaseValue * 0.15; // +15% for 3 positions
      } else if (player.positions.length >= 4) {
        positionPremium = roundedBaseValue * 0.20; // +20% for 4+ positions
      }
      
      totalAdjustments += positionPremium;
    }
  }
  

  
                // Progression premium (up to 25% if exceptional progression, -5% if minimal progression over past 10 age years)
              let progressionPremium = 0;
              // Don't apply progression premium if player is retiring
              if (progressionData.length > 0 && (!retirementYears || retirementYears === 0)) {
                // Get progression data for the past 10 age years
                const currentAge = player.age;
                const tenYearsAgo = currentAge - 10;

                // Find progression points within the past 10 age years
                const recentProgression = progressionData.filter(point => {
                  const pointAge = point.age;
                  return pointAge !== undefined && pointAge >= tenYearsAgo && pointAge <= currentAge;
                });

                if (recentProgression.length >= 2) {
                  // Calculate overall progression over the period
                  const oldestPoint = recentProgression[0];
                  const newestPoint = recentProgression[recentProgression.length - 1];
                  const overallProgression = (newestPoint.overall || 0) - (oldestPoint.overall || 0);
                  


                  // Determine progression premium (pro rata up to 25% for phenomenal progression, -20% for negative progression)
                  if (overallProgression >= 20) {
                    // Phenomenal progression: +25%
                    progressionPremium = roundedBaseValue * 0.25;
                  } else if (overallProgression >= 16) {
                    // Extraordinary progression: +20%
                    progressionPremium = roundedBaseValue * 0.20;
                  } else if (overallProgression >= 12) {
                    // Exceptional progression: +15%
                    progressionPremium = roundedBaseValue * 0.15;
                  } else if (overallProgression >= 8) {
                    // Significant progression: +10%
                    progressionPremium = roundedBaseValue * 0.10;
                  } else if (overallProgression >= 5) {
                    // Impressive progression: +5%
                    progressionPremium = roundedBaseValue * 0.05;
                  } else if (overallProgression === 0) {
                    // Aggressive penalty for zero progression
                    progressionPremium = roundedBaseValue * -0.15; // -15% for no progression
                  } else if (overallProgression <= 1) {
                    // Minimal progression: -5%
                    progressionPremium = roundedBaseValue * -0.05;
                  }
                  // Moderate progression (2-4 points): no adjustment
                }
                totalAdjustments += progressionPremium;
              }
  
  // Retirement penalty (based on years until retirement)
  let retirementPenalty = 0;
  if (retirementYears && retirementYears > 0) {
    if (retirementYears === 1) {
      retirementPenalty = roundedBaseValue * -0.65; // -65% for 1 year left
    } else if (retirementYears === 2) {
      retirementPenalty = roundedBaseValue * -0.45; // -45% for 2 years left
    } else if (retirementYears === 3) {
      retirementPenalty = roundedBaseValue * -0.30; // -30% for 3 years left
    }
    totalAdjustments += retirementPenalty;
  }
  
  // Newly mint premium (10% if player has less than 10 matches)
  let newlyMintPremium = 0;
  if (matchCount !== undefined && matchCount < 10) {
    newlyMintPremium = roundedBaseValue * 0.10; // +10% for newly minted players
    totalAdjustments += newlyMintPremium;
  }
  
  // Pace penalty (-10% if player has Overall > 60 and Pace < 50, excluding goalkeepers)
  let pacePenalty = 0;
  if ((player.overall || 0) > 60 && (player.pace || 0) < 50 && !player.positions.includes('GK')) {
    pacePenalty = roundedBaseValue * -0.10; // -10% for slow players with high overall (excluding goalkeepers)
    totalAdjustments += pacePenalty;
  }
  
  // Pace premium (+10% for Pace >= 90, +5% for Pace 85-90, if primary position is not a wide/fullback position)
  let pacePremium = 0;
  if ((player.pace || 0) >= 85) {
    // Check if primary position is NOT a wide/fullback position
    const widePositions = ['LW', 'RW', 'LB', 'RB', 'LWB', 'RWB'];
    const primaryPosition = player.positions[0]; // First position is typically the primary
    
    if (!widePositions.includes(primaryPosition)) {
      if ((player.pace || 0) >= 90) {
        pacePremium = roundedBaseValue * 0.10; // +10% for very fast players (90+) in non-wide positions
      } else if ((player.pace || 0) >= 85) {
        pacePremium = roundedBaseValue * 0.05; // +5% for fast players (85-89) in non-wide positions
      }
      totalAdjustments += pacePremium;
    }
  }
  
  // Height premium/penalty for goalkeepers
  let heightAdjustment = 0;
  if (player.positions.includes('GK')) {
    // Convert height from cm to feet and inches
    const heightInCm = player.height || 0;
    const heightInFeet = heightInCm / 30.48;
    const feet = Math.floor(heightInFeet);
    const inches = Math.round((heightInFeet - feet) * 12);
    
    // Debug logging for height calculation

    
    // Apply height adjustments for goalkeepers
    if (heightInFeet > 6.167) { // 6' 2" = 6.167 feet
      // Height > 6' 2" (apply Height premium +5%)
      heightAdjustment = roundedBaseValue * 0.05;
      // Round up to minimum $1 for height premium
      if (heightAdjustment > 0) {
        heightAdjustment = Math.max(1, Math.ceil(heightAdjustment));
      }

    } else if (heightInFeet < 5.75) { // 5' 9" = 5.75 feet
      // Height < 5' 9" (apply Height penalty -5%)
      heightAdjustment = roundedBaseValue * -0.05;

          }
    
    totalAdjustments += heightAdjustment;
  }
  
  // Helper function to round small adjustments up to $1
  const roundSmallAdjustment = (adjustment: number) => {
    // Check for NaN or undefined values
    if (isNaN(adjustment) || adjustment === undefined || adjustment === null) {
      return 0;
    }
    
    if (adjustment > 0.01 && adjustment < 1) {
      return 1;
    } else if (adjustment < -0.01 && adjustment > -1) {
      return -1;
    }
    return Math.round(adjustment);
  };
  
  // Calculate final estimated value using sum of individually rounded adjustments
  const roundedTotalAdjustments = roundSmallAdjustment(ageAdjustment) + 
    roundSmallAdjustment(overallAdjustment) + 
    roundSmallAdjustment(positionPremium) + 
    roundSmallAdjustment(progressionPremium) + 
    roundSmallAdjustment(retirementPenalty) + 
    roundSmallAdjustment(newlyMintPremium) + 
    roundSmallAdjustment(pacePenalty) + 
    roundSmallAdjustment(pacePremium) + 
    roundSmallAdjustment(heightAdjustment);
  
  const estimatedValue = Math.max(0, roundedBaseValue + roundedTotalAdjustments);
  

  
  // If the difference between base value and estimated value is $0.50 or less, use base value
  const finalEstimatedValue = Math.abs(estimatedValue - roundedBaseValue) <= 0.5 ? roundedBaseValue : estimatedValue;
  

  
  
  

  
  // Determine confidence level based on comparable listings count
  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (comparableListings.length >= 25) {
    confidence = 'high';
  } else if (comparableListings.length >= 10) {
    confidence = 'medium';
  }
  

  
  return {
    estimatedValue: Math.round(finalEstimatedValue),
    confidence,
    breakdown: {
      comparableListings: comparableListings.length,
      recentSales: recentSales.length,
      ageAdjustment: roundSmallAdjustment(ageAdjustment),
      overallAdjustment: roundSmallAdjustment(overallAdjustment),
      positionPremium: roundSmallAdjustment(positionPremium),
      progressionPremium: roundSmallAdjustment(progressionPremium),
      retirementPenalty: roundSmallAdjustment(retirementPenalty),
      newlyMintPremium: roundSmallAdjustment(newlyMintPremium),
      pacePenalty: roundSmallAdjustment(pacePenalty),
      pacePremium: roundSmallAdjustment(pacePremium),
      heightAdjustment: roundSmallAdjustment(heightAdjustment),
      totalAdjustments: roundedTotalAdjustments
    },
    details: {
      comparableListings,
      recentSales: recentSalesData,
      comparableAverage: Math.round(comparableAverage),
      recentSalesAverage: Math.round(recentSalesAverage),
      baseValue: Math.round(baseValue)
    }
  };
}
