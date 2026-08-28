import { NextRequest, NextResponse } from 'next/server';
import { MFL_API_BASE_URL, getMflAuthHeaders } from '@/src/config/mflApi';

const TIMEOUT_MS = 30000; // 30 seconds

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
        { success: false, error: 'Player ID is required' },
        { status: 400 }
      );
    }

    const url = `${MFL_API_BASE_URL}/players/${playerId}`;
    console.log(`[API] Fetching from MFL API: ${url}`);
    
    // Use native fetch with proper timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log(`[API] Timeout reached, aborting request for player ${playerId}`);
      controller.abort();
    }, TIMEOUT_MS);
    
    try {
      const fetchStartTime = Date.now();
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          ...getMflAuthHeaders(),
        },
        signal: controller.signal,
        // Cache for 6 hours (21600 seconds)
        next: { revalidate: 21600 },
      });
      
      clearTimeout(timeoutId);
      const fetchDuration = Date.now() - fetchStartTime;
      const totalDuration = Date.now() - startTime;
      
      console.log(`[API] Fetch completed in ${fetchDuration}ms, total ${totalDuration}ms, status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error(`[API] MFL API returned error status ${response.status}:`, errorText);
        return NextResponse.json(
          { 
            success: false, 
            error: `MFL API error: ${response.status} ${response.statusText}`
          },
          { status: response.status }
        );
      }
      
      const data = await response.json();
      console.log(`[API] Successfully parsed JSON response for player ${playerId}`);
      
      // The MFL API returns { player: {...} } format
      const playerData = data?.player || data;
      
      if (!playerData) {
        console.error(`[API] No player data in response:`, JSON.stringify(data).substring(0, 200));
        return NextResponse.json(
          { 
            success: false, 
            error: 'Player data not found in API response'
          },
          { status: 404 }
        );
      }
      
      console.log(`[API] Successfully fetched player ${playerId} in ${totalDuration}ms`);
      return NextResponse.json({
        success: true,
        data: playerData
      });
    } catch (error: any) {
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;
      
      // Log detailed error information
      const errorDetails = {
        name: error?.name,
        message: error?.message,
        cause: error?.cause?.message,
        code: error?.code,
      };
      console.error(`[API] Error fetching player ${playerId} (took ${duration}ms):`, errorDetails);
      
      // Handle specific error types
      if (error.name === 'AbortError' || error.message?.includes('aborted') || error.message?.includes('timeout')) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Request timeout - MFL API did not respond in time. Please try again.'
          },
          { status: 504 }
        );
      }
      
      if (error.message?.includes('404') || error.message?.includes('not found')) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Player not found'
          },
          { status: 404 }
        );
      }
      
      // Network errors
      if (error.message?.includes('fetch failed') || error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
        console.error(`[API] Network error details:`, {
          code: error.code,
          message: error.message,
          errno: error.errno,
          syscall: error.syscall,
        });
        return NextResponse.json(
          { 
            success: false, 
            error: `Network error: ${error.message || 'Unable to reach MFL API'}. Please check your connection and try again.`
          },
          { status: 503 }
        );
      }
      
      return NextResponse.json(
        { 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to fetch player data'
        },
        { status: 500 }
      );
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[API] Unexpected error in player proxy (took ${duration}ms):`, error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}
