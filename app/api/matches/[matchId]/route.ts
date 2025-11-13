import { NextRequest, NextResponse } from 'next/server';

const MFL_API_BASE = 'https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod';
const TIMEOUT_MS = 30000; // 30 seconds

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const startTime = Date.now();
  
  try {
    const { matchId } = await params;
    const { searchParams } = new URL(request.url);
    const withFormations = searchParams.get('withFormations') === 'true';
    
    if (!matchId) {
      return NextResponse.json(
        { success: false, error: 'Match ID is required' },
        { status: 400 }
      );
    }

    console.log(`[API] GET /api/matches/${matchId} - withFormations: ${withFormations}`);
    
    const url = `${MFL_API_BASE}/matches/${matchId}${withFormations ? '?withFormations=true' : ''}`;
    console.log(`[API] Fetching from MFL API: ${url}`);
    
    // Use native fetch with proper timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log(`[API] Timeout reached, aborting request for match ${matchId}`);
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
      console.log(`[API] Successfully fetched match ${matchId}`);
      
      return NextResponse.json({
        success: true,
        data: data
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
      console.error(`[API] Error fetching match ${matchId} (took ${duration}ms):`, errorDetails);
      
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
          error: error instanceof Error ? error.message : 'Failed to fetch match data'
        },
        { status: 500 }
      );
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[API] Unexpected error in match proxy (took ${duration}ms):`, error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}

