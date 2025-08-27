import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const playerId = searchParams.get('playerId');

  if (!playerId) {
    return NextResponse.json({ error: 'Player ID is required' }, { status: 400 });
  }

  try {
    const url = `https://mflplayer.info/player/${playerId}`;
    
    // Use a CORS proxy to avoid CORS issues
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    
    const response = await fetch(proxyUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.contents) {
      throw new Error('No content received from proxy');
    }
    
    const html = data.contents;
    
    // Parse the HTML to extract position ratings
    const positionRatings = parsePositionRatingsFromHTML(html, playerId);
    
    return NextResponse.json({
      playerId,
      positionRatings,
      success: true
    });
    
  } catch (error) {
    console.error('Error scraping position ratings:', error);
    return NextResponse.json({
      playerId,
      positionRatings: [],
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Parse position ratings from HTML content
 */
function parsePositionRatingsFromHTML(html: string, playerId: string): any[] {
  const ratings: any[] = [];
  
  try {
    // Use a simple regex approach to extract position ratings
    // Look for patterns like "LB Primary +0 82" or "CB Secondary -6 76"
    const positionPattern = /([A-Z]{2,3})\s+(Primary|Secondary|Unfamiliar)\s+([+-]?\d+)\s+(\d+)/g;
    let match;
    
    while ((match = positionPattern.exec(html)) !== null) {
      ratings.push({
        position: match[1],
        familiarity: match[2].toUpperCase(),
        difference: parseInt(match[3]),
        rating: parseInt(match[4])
      });
    }
    
    // If no matches found, try alternative patterns
    if (ratings.length === 0) {
      // Look for any text that might contain position ratings
      const lines = html.split('\n');
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.match(/^[A-Z]{2,3}\s+.*\d+$/)) {
          // Try to extract position and rating
          const parts = trimmedLine.split(/\s+/);
          if (parts.length >= 2) {
            const position = parts[0];
            const lastPart = parts[parts.length - 1];
            const rating = parseInt(lastPart);
            
            if (position && !isNaN(rating)) {
              ratings.push({
                position,
                familiarity: 'UNFAMILIAR',
                difference: 0,
                rating
              });
            }
          }
        }
      }
    }
    
  } catch (error) {
    console.error('Error parsing HTML:', error);
  }
  
  return ratings;
}
