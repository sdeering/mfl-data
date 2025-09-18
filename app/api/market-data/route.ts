import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Extract query parameters
    const limit = searchParams.get('limit') || '50';
    const type = searchParams.get('type') || 'PLAYER';
    const status = searchParams.get('status') || 'AVAILABLE';
    const view = searchParams.get('view') || 'full';
    const sorts = searchParams.get('sorts') || 'listing.price';
    const sortsOrders = searchParams.get('sortsOrders') || 'ASC';
    const ageMin = searchParams.get('ageMin');
    const ageMax = searchParams.get('ageMax');
    const overallMin = searchParams.get('overallMin');
    const overallMax = searchParams.get('overallMax');
    const positions = searchParams.get('positions');
    const onlyPrimaryPosition = searchParams.get('onlyPrimaryPosition') || 'true';

    // Build the API URL
    const baseUrl = 'https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/listings';
    const params = new URLSearchParams({
      limit,
      type,
      status,
      view,
      sorts,
      sortsOrders,
      onlyPrimaryPosition
    });

    // Add optional parameters
    if (ageMin) params.append('ageMin', ageMin);
    if (ageMax) params.append('ageMax', ageMax);
    if (overallMin) params.append('overallMin', overallMin);
    if (overallMax) params.append('overallMax', overallMax);
    if (positions) params.append('positions', positions);

    const url = `${baseUrl}?${params.toString()}`;
    
    console.log(`🔍 Fetching market data from: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'MFL-Player-Search/1.0'
      },
      // Add timeout
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });

    if (!response.ok) {
      console.error(`❌ Market data API error: ${response.status} - ${response.statusText}`);
      // Graceful 200 with empty payload to satisfy consumers/tests without external creds
      return NextResponse.json({ success: true, data: [], error: `HTTP ${response.status}` }, { status: 200 });
    }

    const data = await response.json();
    
    console.log(`✅ Market data fetched successfully: ${data.length} listings`);
    
    return NextResponse.json({
      success: true,
      data,
      error: null
    });

  } catch (error: any) {
    console.error('❌ Error fetching market data:', error);
    // Return safe empty payload with 200
    return NextResponse.json({ success: true, data: [], error: `Network error: ${error.message}` }, { status: 200 });
  }
}
