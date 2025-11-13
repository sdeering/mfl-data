import { NextRequest, NextResponse } from 'next/server';
import { mflApi } from '@/src/services/mflApi';

// Cache for player info pages (6 hours)
const playerCache = new Map<string, { data: any; timestamp: number }>();
const PLAYER_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

// Clean up expired cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of playerCache.entries()) {
    if (now - entry.timestamp > PLAYER_CACHE_TTL) {
      playerCache.delete(key);
    }
  }
}, 60 * 60 * 1000); // Clean up every hour

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ playerId: string }> }
) {
  const startTime = Date.now();
  
  try {
    const { playerId } = await params;
    
    console.log(`[API] GET /api/player/${playerId} - Starting request`);
    
    if (!playerId) {
      return NextResponse.json(
        { error: 'Player ID is required' },
        { status: 400 }
      );
    }

    // Check cache first (6 hours TTL)
    const cacheKey = `player_${playerId}`;
    const cached = playerCache.get(cacheKey);
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < PLAYER_CACHE_TTL) {
      const duration = Date.now() - startTime;
      console.log(`[API] Cache HIT for player ${playerId} (took ${duration}ms)`);
      return NextResponse.json({
        success: true,
        data: cached.data
      });
    }

    // Fetch player data from MFL API
    console.log(`[API] Cache MISS - Fetching player ${playerId} from MFL API...`);
    
    // The MFL API service has a built-in 10s timeout, but we add an extra layer
    const player = await mflApi.getPlayer(playerId);
    
    // Store in cache
    playerCache.set(cacheKey, {
      data: player,
      timestamp: now
    });
    
    const duration = Date.now() - startTime;
    console.log(`[API] Successfully fetched player ${playerId} in ${duration}ms`);
    
    return NextResponse.json({
      success: true,
      data: player
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[API] Error fetching player data (took ${duration}ms):`, error);
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch player data';
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage
      },
      { status: 500 }
    );
  }
}
