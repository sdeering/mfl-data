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

    // The new api.playmfl.com host dropped /users/{wallet}/clubs, so try the
    // query-based variants first (list endpoints require a limit, like /players).
    const candidates = [
      `${MFL_API_BASE_URL}/clubs?ownerWalletAddress=${walletAddress}&limit=400`,
      `${MFL_API_BASE_URL}/clubs?walletAddress=${walletAddress}&limit=400`,
      `${MFL_API_BASE_URL}/users/${walletAddress}/clubs`,
    ];

    const failures: string[] = [];

    try {
      for (const url of candidates) {
        const response = await fetchWithTimeout(url);

        if (response.ok) {
          const clubs = normalizeClubs(await response.json());
          console.log(`✅ [API] Clubs fetched successfully from ${url}: ${clubs.length} clubs`);
          return NextResponse.json({ success: true, data: clubs });
        }

        const body = (await response.text().catch(() => '')).slice(0, 300);
        console.error(`❌ [API] Clubs API error for ${url}: ${response.status} - ${body}`);
        failures.push(`${url.replace(MFL_API_BASE_URL, '')} -> ${response.status} ${body}`);
      }

      return NextResponse.json(
        { success: false, error: `MFL API rejected all club endpoints: ${failures.join(' | ')}`, data: [] },
        { status: 502 }
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
