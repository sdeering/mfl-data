import { mflApi } from './mflApi';
import { calculateMarketValue } from '../utils/marketValueCalculator';
import { fetchPlayerSaleHistory } from './playerSaleHistoryService';
import { fetchPlayerExperienceHistory, processProgressionData } from './playerExperienceService';
import { fetchPlayerMatches } from './playerMatchesService';
import { fetchMarketData } from './marketDataService';
import { calculateAllPositionOVRs } from '../utils/ruleBasedPositionCalculator';
import { supabase, TABLES } from '../lib/supabase';
import type { MarketValueEstimate } from '../utils/marketValueCalculator';

export interface MarketValueCalculationResult {
  success: boolean;
  marketValue?: number;
  confidence?: string;
  details?: any;
  error?: string;
}

/**
 * Centralized market value calculation function
 * Call this with just a player ID to get consistent market value calculations
 * across the entire application
 */
export async function calculatePlayerMarketValue(
  playerId: string | number,
  walletAddress?: string
): Promise<MarketValueCalculationResult> {
  try {
    const playerIdStr = playerId.toString();
    console.log(`🔄 Calculating market value for player ${playerIdStr}...`);

    // Fetch player data from MFL API
    let player;
    let playerMetadata;
    try {
      player = await mflApi.getPlayer(playerIdStr);
      playerMetadata = player.metadata;
    } catch (error) {
      console.error(`❌ Error fetching player ${playerIdStr}:`, error);
      return {
        success: false,
        error: 'Player not found'
      };
    }

    // Calculate position ratings the same way as the player page
    const playerForOVR = {
      id: player.id,
      name: `${player.metadata.firstName} ${player.metadata.lastName}`,
      attributes: {
        PAC: player.metadata.pace,
        SHO: player.metadata.shooting,
        PAS: player.metadata.passing,
        DRI: player.metadata.dribbling,
        DEF: player.metadata.defense,
        PHY: player.metadata.physical,
        GK: player.metadata.goalkeeping || 0
      },
      positions: player.metadata.positions,
      overall: player.metadata.overall
    };
    const positionRatingsResult = calculateAllPositionOVRs(playerForOVR);
    const positionRatings = Object.entries(positionRatingsResult.results).reduce((acc, [position, result]) => {
      if (result.success) {
        acc[position] = result.ovr;
      }
      return acc;
    }, {} as { [position: string]: number });


    // Fetch all required data in parallel
    const [marketResponse, historyResponse, progressionResponse, matchesResponse] = await Promise.all([
      fetchMarketData({
        positions: playerMetadata.positions,
        ageMin: Math.max(1, playerMetadata.age - 1),
        ageMax: playerMetadata.age + 1,
        overallMin: Math.max(1, playerMetadata.overall - 1),
        overallMax: playerMetadata.overall + 1,
        limit: 50
      }),
      fetchPlayerSaleHistory(playerIdStr, 25),
      fetchPlayerExperienceHistory(playerIdStr),
      fetchPlayerMatches(playerIdStr)
    ]);

    const comparableListings = marketResponse.success ? marketResponse.data : [];
    const recentSales = historyResponse.success ? historyResponse.data : [];
    const progressionData = progressionResponse.success ? processProgressionData(progressionResponse.data) : [];
    const matchCount = matchesResponse.success ? matchesResponse.data.length : 0;

    // Calculate market value using the real algorithm
    const marketValueEstimate = calculateMarketValue(
      playerMetadata,
      comparableListings,
      recentSales,
      progressionData,
      positionRatings,
      playerMetadata.retirementYears,
      matchCount,
      parseInt(playerIdStr)
    );

    // Store the calculated market value in the database
    // Market values are player-specific, not wallet-specific
    const { error: upsertError } = await supabase
      .from(TABLES.MARKET_VALUES)
      .upsert({
        mfl_player_id: parseInt(playerIdStr),
        data: {
          market_value: marketValueEstimate.estimatedValue,
          confidence: marketValueEstimate.confidence,
          breakdown: marketValueEstimate.breakdown,
          details: marketValueEstimate.details,
          calculated_at: new Date().toISOString(),
          cache_version: '1.1' // Version to handle service changes
        },
        last_synced: new Date().toISOString()
      }, {
        onConflict: 'mfl_player_id'
      });
    
    if (upsertError) {
      console.warn(`⚠️ Error storing market value for player ${playerIdStr}:`, upsertError);
    }

    return {
      success: true,
      marketValue: marketValueEstimate.estimatedValue,
      confidence: marketValueEstimate.confidence,
      details: {
        market_value: marketValueEstimate.estimatedValue,
        confidence: marketValueEstimate.confidence,
        breakdown: marketValueEstimate.breakdown,
        details: marketValueEstimate.details
      }
    };

  } catch (error) {
    console.error('❌ Error calculating market value:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}

/**
 * Get cached market value from database if available and not expired
 */
export async function getCachedMarketValue(
  playerId: string | number,
  walletAddress?: string, // Keep for backward compatibility but don't use it
  maxAgeHours: number = 168 // 7 days default
): Promise<MarketValueCalculationResult | null> {
  try {
    console.log(`🔍 Checking cache for player ${playerId}`);
    
    const { data, error } = await supabase
      .from(TABLES.MARKET_VALUES)
      .select('*')
      .eq('mfl_player_id', parseInt(playerId.toString()))
      .maybeSingle();

    if (error) {
      console.log(`❌ Cache lookup error for player ${playerId}:`, error);
      return null;
    }
    
    if (!data || !data.data) {
      console.log(`❌ No cached data found for player ${playerId}`);
      return null;
    }

    const calculatedAt = new Date(data.data.calculated_at);
    const now = new Date();
    const ageHours = (now.getTime() - calculatedAt.getTime()) / (1000 * 60 * 60);

    if (ageHours > maxAgeHours) {
      console.log(`❌ Cached data for player ${playerId} expired (${ageHours.toFixed(2)}h old, max ${maxAgeHours}h)`);
      return null; // Expired
    }

    // Additional validation: Check cache version
    const currentCacheVersion = '1.1';
    if (data.data.cache_version && data.data.cache_version !== currentCacheVersion) {
      console.log(`⚠️ Cached data for player ${playerId} has outdated cache version (${data.data.cache_version} vs ${currentCacheVersion}), invalidating cache`);
      return null; // Invalidate outdated cache
    }

    // Additional validation: Check if cached value of 0 (Unknown) is actually valid
    // Only invalidate if it's 0 with 0 comparable listings AND 0 recent sales
    // This indicates a legitimate "Unknown" value due to insufficient data
    if (data.data.market_value === 0 && 
        data.data.breakdown?.comparableListings === 0 && 
        data.data.breakdown?.recentSales === 0) {
      console.log(`✅ Cached value of 0 for player ${playerId} is legitimate "Unknown" (0 comparable listings, 0 recent sales)`);
      // This is a valid "Unknown" value, don't invalidate
    }

    console.log(`✅ Found valid cached data for player ${playerId}: $${data.data.market_value} (${ageHours.toFixed(2)}h old)`);
    return {
      success: true,
      marketValue: data.data.market_value,
      confidence: data.data.confidence,
      details: {
        market_value: data.data.market_value,
        confidence: data.data.confidence,
        breakdown: data.data.breakdown,
        details: data.data.details
      }
    };
  } catch (error) {
    console.error('Error getting cached market value:', error);
    return null;
  }
}

/**
 * Calculate market value with caching - returns cached value if available and fresh,
 * otherwise calculates new value
 */
export async function getPlayerMarketValue(
  playerId: string | number,
  walletAddress?: string,
  forceRecalculate: boolean = false
): Promise<MarketValueCalculationResult> {
  // Try to get cached value first (unless force recalculate)
  if (!forceRecalculate) {
    const cached = await getCachedMarketValue(playerId, walletAddress);
    if (cached) {
      console.log(`📋 Using cached market value for player ${playerId}`);
      return cached;
    }
  }

  // Calculate fresh value
  console.log(`🔄 Calculating fresh market value for player ${playerId}`);
  return await calculatePlayerMarketValue(playerId, walletAddress);
}
