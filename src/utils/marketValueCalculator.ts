import type { MarketListing } from '../services/marketDataService';
import type { PlayerSaleHistoryEntry } from '../types/playerSaleHistory';
import type { MFLPlayerMetadata } from '../types/mflApi';

export interface MarketValueEstimate {
  estimatedValue: number;
  confidence: 'high' | 'medium' | 'low';
  breakdown: {
    comparableListings: number;
    recentSales: number;
    ageAdjustment: number;
    overallAdjustment: number;
    positionPremium: number;
    singleOwnerPremium: number;
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
  recentSales: PlayerSaleHistoryEntry[]
): MarketValueEstimate {
  let baseValue = 0;
  let comparableAverage = 0;
  let recentSalesAverage = 0;
  
  // Calculate average from comparable listings
  if (comparableListings.length > 0) {
    comparableAverage = comparableListings.reduce((sum, listing) => sum + listing.price, 0) / comparableListings.length;
    baseValue = comparableAverage;
  }
  
  // Calculate average from recent sales (last 3 sales)
  const recentSalesData = recentSales.slice(0, 3);
  if (recentSalesData.length > 0) {
    recentSalesAverage = recentSalesData.reduce((sum, sale) => sum + sale.price, 0) / recentSalesData.length;
    
    // If we have both comparable listings and recent sales, weight them
    if (comparableListings.length > 0) {
      baseValue = (comparableAverage * 0.7) + (recentSalesAverage * 0.3);
    } else {
      baseValue = recentSalesAverage;
    }
  }
  
  // Apply adjustments
  let totalAdjustments = 0;
  
  // Age adjustment (weight based on age difference from comparable listings)
  let ageAdjustment = 0;
  if (comparableListings.length > 0) {
    const avgComparableAge = comparableListings.reduce((sum, listing) => sum + listing.player.metadata.age, 0) / comparableListings.length;
    const ageDifference = player.age - avgComparableAge;
    // 2% adjustment per year of age difference
    ageAdjustment = baseValue * (ageDifference * 0.02);
    totalAdjustments += ageAdjustment;
  }
  
  // Overall rating adjustment
  let overallAdjustment = 0;
  if (comparableListings.length > 0) {
    const avgComparableOverall = comparableListings.reduce((sum, listing) => sum + listing.player.metadata.overall, 0) / comparableListings.length;
    const overallDifference = player.overall - avgComparableOverall;
    // 3% adjustment per overall point difference
    overallAdjustment = baseValue * (overallDifference * 0.03);
    totalAdjustments += overallAdjustment;
  }
  
  // Position premium (5% if multiple positions)
  let positionPremium = 0;
  if (player.positions.length > 1) {
    positionPremium = baseValue * 0.05;
    totalAdjustments += positionPremium;
  }
  
  // Single owner premium (5% if no sales history)
  let singleOwnerPremium = 0;
  if (recentSales.length === 0) {
    singleOwnerPremium = baseValue * 0.05;
    totalAdjustments += singleOwnerPremium;
  }
  
  // Calculate final estimated value
  const estimatedValue = Math.max(0, baseValue + totalAdjustments);
  
  // Determine confidence level
  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (comparableListings.length >= 5 && recentSales.length >= 2) {
    confidence = 'high';
  } else if (comparableListings.length >= 3 || recentSales.length >= 1) {
    confidence = 'medium';
  }
  
  return {
    estimatedValue: Math.round(estimatedValue),
    confidence,
    breakdown: {
      comparableListings: comparableListings.length,
      recentSales: recentSales.length,
      ageAdjustment: Math.round(ageAdjustment),
      overallAdjustment: Math.round(overallAdjustment),
      positionPremium: Math.round(positionPremium),
      singleOwnerPremium: Math.round(singleOwnerPremium),
      totalAdjustments: Math.round(totalAdjustments)
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
