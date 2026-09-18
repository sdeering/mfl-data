import { NextRequest, NextResponse } from 'next/server';
import { MFL_API_BASE_URL, getMflAuthHeaders } from '@/src/config/mflApi';

const TIMEOUT_MS = 30000; // 30 seconds

// Coach catalog with pricing as seen by this club (MFL: GET /coaches?clubId=)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  try {
    const { clubId } = await params;

    if (!clubId || !/^\d+$/.test(clubId)) {
      return NextResponse.json(
        { success: false, error: 'Valid club ID is required' },
        { status: 400 }
      );
    }

    const url = `${MFL_API_BASE_URL}/coaches?clubId=${clubId}`;
    console.log(`[API] Fetching from MFL API: ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        ...getMflAuthHeaders(),
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`[API] MFL API returned error status ${response.status}:`, errorText);
      return NextResponse.json(
        { success: false, error: `MFL API error: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('[API] Error fetching coaches:', error);
    const isTimeout = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    return NextResponse.json(
      {
        success: false,
        error: isTimeout
          ? 'Request timeout - MFL API did not respond in time. Please try again.'
          : error instanceof Error ? error.message : 'Failed to fetch coaches',
      },
      { status: isTimeout ? 504 : 500 }
    );
  }
}
