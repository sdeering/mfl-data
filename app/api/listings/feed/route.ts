import { NextRequest, NextResponse } from 'next/server';

const MFL_API_BASE = 'https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod';
const TIMEOUT_MS = 30000; // 30 seconds

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '25';
    const playerId = searchParams.get('playerId');

    if (!playerId) {
      return NextResponse.json(
        { success: false, error: 'playerId parameter is required' },
        { status: 400 }
      );
    }

    console.log(`[API] GET /api/listings/feed - playerId: ${playerId}, limit: ${limit}`);

    const url = `${MFL_API_BASE}/listings/feed?limit=${limit}&playerId=${playerId}`;
    console.log(`[API] Fetching from MFL API: ${url}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log(`[API] Timeout reached, aborting request for listings feed`);
      controller.abort();
    }, TIMEOUT_MS);
    
    try {
      const fetchStartTime = Date.now();
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
        next: { revalidate: 3600 }, // Cache for 1 hour
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
            error: `MFL API error: ${response.status} ${response.statusText}`,
            data: []
          },
          { status: response.status }
        );
      }
      
      const data = await response.json();
      console.log(`[API] Successfully fetched ${Array.isArray(data) ? data.length : 0} listings`);
      
      return NextResponse.json({
        success: true,
        data: Array.isArray(data) ? data : []
      });
    } catch (error: any) {
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;
      
      console.error(`[API] Error fetching listings feed (took ${duration}ms):`, error);
      
      if (error.name === 'AbortError' || error.message?.includes('aborted') || error.message?.includes('timeout')) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Request timeout - MFL API did not respond in time. Please try again.',
            data: []
          },
          { status: 504 }
        );
      }
      
      return NextResponse.json(
        { 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to fetch listings feed',
          data: []
        },
        { status: 500 }
      );
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[API] Unexpected error in listings feed proxy (took ${duration}ms):`, error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error',
        data: []
      },
      { status: 500 }
    );
  }
}

