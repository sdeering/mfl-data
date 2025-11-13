import { NextRequest, NextResponse } from 'next/server';

const MFL_API_BASE = 'https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ownerWalletAddress = searchParams.get('ownerWalletAddress');
    const limit = searchParams.get('limit') || '1200';
    const isRetired = searchParams.get('isRetired');

    if (!ownerWalletAddress) {
      return NextResponse.json(
        { error: 'ownerWalletAddress parameter is required' },
        { status: 400 }
      );
    }

    console.log(`🔍 [API] Fetching players for wallet: ${ownerWalletAddress}`);

    // Build query parameters
    const params = new URLSearchParams({
      ownerWalletAddress,
      limit,
    });

    if (isRetired !== null && isRetired !== undefined) {
      params.append('isRetired', isRetired);
    }

    const url = `${MFL_API_BASE}/players?${params.toString()}`;
    
    console.log(`🌐 [API] Requesting: ${url}`);
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout for large player lists
    
    try {
      const startTime = Date.now();
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'MFL-Player-Search/1.0'
        },
        signal: controller.signal
      }).finally(() => clearTimeout(timeout));

      const duration = Date.now() - startTime;
      console.log(`📥 [API] Response received in ${duration}ms (status: ${response.status})`);

      if (!response.ok) {
        console.error(`❌ [API] Players API error: ${response.status} - ${response.statusText}`);
        return NextResponse.json(
          { success: false, error: `HTTP ${response.status}: ${response.statusText}`, data: [] },
          { status: response.status }
        );
      }

      const data = await response.json();
      
      console.log(`✅ [API] Players fetched successfully: ${Array.isArray(data) ? data.length : 0} players`);
      
      return NextResponse.json({
        success: true,
        data: Array.isArray(data) ? data : []
      });

    } catch (fetchError: any) {
      if (fetchError.name === 'AbortError' || fetchError.message?.includes('aborted')) {
        console.error('⏰ [API] Request timeout fetching players');
        return NextResponse.json(
          { success: false, error: 'Request timeout - MFL API is slow or unreachable', data: [] },
          { status: 504 }
        );
      }
      throw fetchError;
    }

  } catch (error: any) {
    console.error('❌ [API] Error fetching players:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to fetch players data',
        data: [] 
      },
      { status: 500 }
    );
  }
}

