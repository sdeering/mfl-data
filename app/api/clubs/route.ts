import { NextRequest, NextResponse } from 'next/server';

const MFL_API_BASE = 'https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod';

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

    // Try the /users/{walletAddress}/clubs endpoint first
    const url = `${MFL_API_BASE}/users/${walletAddress}/clubs`;
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'MFL-Player-Search/1.0'
        },
        signal: controller.signal
      }).finally(() => clearTimeout(timeout));

      if (!response.ok) {
        console.error(`❌ [API] Clubs API error: ${response.status} - ${response.statusText}`);
        
        // If 502 or other server error, try fallback endpoint
        if (response.status >= 500) {
          console.log(`🔄 [API] Trying fallback endpoint: /clubs?walletAddress=`);
          const fallbackUrl = `${MFL_API_BASE}/clubs?walletAddress=${walletAddress}`;
          const fallbackResponse = await fetch(fallbackUrl, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'MFL-Player-Search/1.0'
            },
            signal: controller.signal
          });

          if (fallbackResponse.ok) {
            const fallbackData = await fallbackResponse.json();
            console.log(`✅ [API] Fallback endpoint succeeded: ${Array.isArray(fallbackData) ? fallbackData.length : fallbackData.clubs?.length || 0} clubs`);
            return NextResponse.json({
              success: true,
              data: Array.isArray(fallbackData) ? fallbackData : (fallbackData.clubs || [])
            });
          }
        }

        return NextResponse.json(
          { success: false, error: `HTTP ${response.status}: ${response.statusText}`, data: [] },
          { status: response.status }
        );
      }

      const data = await response.json();
      
      // Handle both response formats: { clubs: [...] } or direct array
      const clubs = Array.isArray(data) ? data : (data.clubs || []);
      
      console.log(`✅ [API] Clubs fetched successfully: ${clubs.length} clubs`);
      
      return NextResponse.json({
        success: true,
        data: clubs
      });

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

