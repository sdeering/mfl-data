import { NextRequest, NextResponse } from 'next/server';
import { MFL_API_BASE_URL, getMflAuthHeaders } from '@/src/config/mflApi';

const TIMEOUT_MS = 30000; // 30 seconds

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const playersIds = searchParams.get('playersIds');
    const interval = searchParams.get('interval') || 'ALL';

    if (!playersIds) {
      return NextResponse.json(
        { success: false, error: 'playersIds parameter is required' },
        { status: 400 }
      );
    }

    console.log(`[API] GET /api/players/progressions - playersIds: ${playersIds}, interval: ${interval}`);

    const url = `${MFL_API_BASE_URL}/players/progressions?playersIds=${playersIds}&interval=${interval}`;
    console.log(`[API] Fetching from MFL API: ${url}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log(`[API] Timeout reached, aborting request for player progressions`);
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
            error: `MFL API error: ${response.status} ${response.statusText}`
          },
          { status: response.status }
        );
      }

      const data = await response.json();
      console.log(`[API] Successfully fetched progressions for ${playersIds}`);

      return NextResponse.json({
        success: true,
        data
      });
    } catch (error: any) {
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;

      console.error(`[API] Error fetching player progressions (took ${duration}ms):`, error);

      if (error.name === 'AbortError' || error.message?.includes('aborted') || error.message?.includes('timeout')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Request timeout - MFL API did not respond in time. Please try again.'
          },
          { status: 504 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch player progressions'
        },
        { status: 500 }
      );
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[API] Unexpected error in player progressions proxy (took ${duration}ms):`, error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}
