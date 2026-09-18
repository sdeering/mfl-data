import { NextRequest, NextResponse } from 'next/server';
import { MFL_API_BASE_URL, getMflAuthHeaders } from '@/src/config/mflApi';

// Normalize both response shapes to the { title, club, tactics, competitions }
// wrapper the frontend expects (MFLClubData in clubsService).
// - /clubs?ownerWalletAddress= returns raw club objects
// - the legacy /users/{wallet}/clubs returned pre-wrapped items
function normalizeClubs(data: any): any[] {
  const list = Array.isArray(data) ? data : (data?.clubs || []);
  return list.map((item: any) => {
    if (item && typeof item === 'object' && 'club' in item) {
      return { competitions: [], ...item };
    }
    return {
      title: item?.name ?? '',
      club: item,
      tactics: false,
      competitions: [],
    };
  });
}

async function fetchWithTimeout(url: string, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'MFL-Player-Search/1.0',
        ...getMflAuthHeaders(),
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'walletAddress parameter is required' },
        { status: 400 }
      );
    }

    console.log(`🔍 [API] Fetching clubs for wallet: ${walletAddress}`);

    try {
      // Primary endpoint: /clubs?ownerWalletAddress= (same convention as /players)
      const url = `${MFL_API_BASE_URL}/clubs?ownerWalletAddress=${walletAddress}`;
      const response = await fetchWithTimeout(url);

      if (response.ok) {
        const clubs = normalizeClubs(await response.json());
        console.log(`✅ [API] Clubs fetched successfully: ${clubs.length} clubs`);
        return NextResponse.json({ success: true, data: clubs });
      }

      console.error(`❌ [API] Clubs API error: ${response.status} - ${response.statusText}`);

      // Fallback: legacy /users/{walletAddress}/clubs endpoint
      console.log(`🔄 [API] Trying fallback endpoint: /users/{walletAddress}/clubs`);
      const fallbackUrl = `${MFL_API_BASE_URL}/users/${walletAddress}/clubs`;
      const fallbackResponse = await fetchWithTimeout(fallbackUrl);

      if (fallbackResponse.ok) {
        const clubs = normalizeClubs(await fallbackResponse.json());
        console.log(`✅ [API] Fallback endpoint succeeded: ${clubs.length} clubs`);
        return NextResponse.json({ success: true, data: clubs });
      }

      return NextResponse.json(
        { success: false, error: `HTTP ${response.status}: ${response.statusText}`, data: [] },
        { status: response.status }
      );

    } catch (fetchError: any) {
      if (fetchError.name === 'AbortError' || fetchError.message?.includes('aborted')) {
        console.error('⏰ [API] Request timeout fetching clubs');
        return NextResponse.json(
          { success: false, error: 'Request timeout - MFL API is slow or unreachable', data: [] },
          { status: 504 }
        );
      }
      throw fetchError;
    }

  } catch (error: any) {
    console.error('❌ [API] Error fetching clubs:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch clubs data',
        data: []
      },
      { status: 500 }
    );
  }
}
