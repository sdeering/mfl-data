import { NextRequest, NextResponse } from 'next/server';

const MFL_API_BASE = 'https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod';
const TIMEOUT_MS = 30000; // 30 seconds

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const startTime = Date.now();
  
  try {
    const { clubId } = await params;
    
    if (!clubId) {
      return NextResponse.json(
        { success: false, error: 'Club ID is required', data: [] },
        { status: 400 }
      );
    }

    console.log(`[API] GET /api/clubs/${clubId}/players`);
    
    const url = `${MFL_API_BASE}/clubs/${clubId}/players`;
    console.log(`[API] Fetching from MFL API: ${url}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log(`[API] Timeout reached, aborting request for club players`);
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
      console.log(`[API] Successfully fetched ${Array.isArray(data) ? data.length : 0} club players`);
      
      return NextResponse.json({
        success: true,
        data: Array.isArray(data) ? data : []
      });
    } catch (error: any) {
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;
      
      console.error(`[API] Error fetching club players (took ${duration}ms):`, error);
      
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
          error: error instanceof Error ? error.message : 'Failed to fetch club players',
          data: []
        },
        { status: 500 }
      );
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[API] Unexpected error in club players proxy (took ${duration}ms):`, error);
    
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

