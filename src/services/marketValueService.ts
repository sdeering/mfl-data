import { mflApi } from './mflApi';
import { calculateMarketValue } from '../utils/marketValueCalculator';
import { fetchPlayerSaleHistory } from './playerSaleHistoryService';
import { fetchPlayerExperienceHistory, processProgressionData } from './playerExperienceService';
import { fetchPlayerMatches } from './playerMatchesService';
import { fetchMarketData } from './marketDataService';
import { calculateAllPositionOVRs } from '../utils/ruleBasedPositionCalculator';
import { supabase, TABLES } from '../lib/supabase';
import type { MarketValueEstimate } from '../utils/marketValueCalculator';

// In-memory cache for market values (1 hour TTL)
interface MarketValueCacheEntry {
  result: MarketValueCalculationResult;
  timestamp: number;
}

const marketValueCache = new Map<string, MarketValueCacheEntry>();
const MARKET_VALUE_CACHE_TTL = 60 * 60 * 1000; // 1 hour

const isCacheValid = (timestamp: number): boolean => {
  return Date.now() - timestamp < MARKET_VALUE_CACHE_TTL;
};

// Export function to clear cache for testing
export function clearMarketValueCache(): void {
  marketValueCache.clear();
}

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
    const playerIdStr = playerId.toString();
    console.log(`🔍 Checking database cache for player ${playerIdStr} (max age: ${maxAgeHours}h)`);
    
    const { data, error } = await supabase
      .from(TABLES.MARKET_VALUES)
      .select('*')
      .eq('mfl_player_id', parseInt(playerIdStr))
      .maybeSingle();

    if (error) {
      console.log(`❌ Cache lookup error for player ${playerIdStr}:`, error);
      return null;
    }
    
    if (!data || !data.data) {
      console.log(`❌ No cached data found in database for player ${playerIdStr}`);
      return null;
    }

    console.log(`📦 Found cached data for player ${playerIdStr}, checking age...`);
    console.log(`   - calculated_at: ${data.data.calculated_at}`);
    console.log(`   - cache_version: ${data.data.cache_version || 'none'}`);
    console.log(`   - market_value: $${data.data.market_value || 0}`);

    if (!data.data.calculated_at) {
      console.log(`❌ Cached data for player ${playerIdStr} missing calculated_at timestamp`);
      return null;
    }

    const calculatedAt = new Date(data.data.calculated_at);
    const now = new Date();
    const ageHours = (now.getTime() - calculatedAt.getTime()) / (1000 * 60 * 60);

    console.log(`   - Age: ${ageHours.toFixed(2)} hours (max: ${maxAgeHours}h)`);

    if (ageHours > maxAgeHours) {
      console.log(`❌ Cached data for player ${playerIdStr} expired (${ageHours.toFixed(2)}h old, max ${maxAgeHours}h)`);
      return null; // Expired
    }

    // Additional validation: Check cache version (only invalidate if version exists and doesn't match)
    const currentCacheVersion = '1.1';
    if (data.data.cache_version && data.data.cache_version !== currentCacheVersion) {
      console.log(`⚠️ Cached data for player ${playerIdStr} has outdated cache version (${data.data.cache_version} vs ${currentCacheVersion}), invalidating cache`);
      return null; // Invalidate outdated cache
    } else if (!data.data.cache_version) {
      console.log(`ℹ️ Cached data for player ${playerIdStr} has no cache version (old format), accepting it`);
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
  const playerIdStr = playerId.toString();
  const cacheKey = `market_value_${playerIdStr}`;
  
  // Check in-memory cache first (1 hour TTL)
  if (!forceRecalculate) {
    const cached = marketValueCache.get(cacheKey);
    if (cached && isCacheValid(cached.timestamp)) {
      const age = ((Date.now() - cached.timestamp) / (1000 * 60 * 60)).toFixed(2);
      console.log(`🎯 IN-MEMORY CACHE HIT: Using cached market value for player ${playerIdStr}: $${cached.result.marketValue || 0} (${age}h old)`);
      return cached.result;
    } else if (cached) {
      console.log(`⏰ In-memory cache expired for player ${playerIdStr}, checking database...`);
    } else {
      console.log(`🔍 No in-memory cache for player ${playerIdStr}, checking database...`);
    }
    
    // Check database cache (1 hour TTL)
    console.log(`🔍 Checking database cache for player ${playerIdStr}...`);
    const dbCached = await getCachedMarketValue(playerId, walletAddress, 1); // 1 hour
    if (dbCached) {
      console.log(`✅ Database cache found for player ${playerIdStr}`);
      
      // Skip the zero-value verification for now - it causes delays and shows "Calculating..."
      // The cache is valid for 1 hour, so we'll trust it
      // If cache reports 0 (Unknown), just return it - don't verify (too slow)
      
      // Cache in memory for faster subsequent access
      marketValueCache.set(cacheKey, { result: dbCached, timestamp: Date.now() });
      console.log(`📋 Using cached market value for player ${playerIdStr} (${dbCached.marketValue === 0 ? 'Unknown' : `$${dbCached.marketValue}`})`);
      return dbCached;
    }
  }

  // Calculate fresh value (no cache found or force recalculate)
  console.log(`🔄 No valid cache found - Calculating fresh market value for player ${playerIdStr} (forceRecalculate: ${forceRecalculate})`);
  const result = await calculatePlayerMarketValue(playerId, walletAddress);
  
  // Cache the result in memory
  if (result.success) {
    marketValueCache.set(cacheKey, { result, timestamp: Date.now() });
    console.log(`💾 Cached market value in memory for player ${playerIdStr}: $${result.marketValue || 0}`);
  }
  
  return result;
}

