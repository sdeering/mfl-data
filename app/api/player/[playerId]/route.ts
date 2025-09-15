import { NextRequest, NextResponse } from 'next/server';
import { mflApi } from '@/src/services/mflApi';

export async function GET(
  request: NextRequest,
  { params }: { params: { playerId: string } }
) {
  try {
    const { playerId } = params;
    
    if (!playerId) {
      return NextResponse.json(
        { error: 'Player ID is required' },
        { status: 400 }
      );
    }

    // Fetch player data from MFL API
    const player = await mflApi.getPlayer(playerId);
    
    return NextResponse.json({
      success: true,
      player
    });
  } catch (error) {
    console.error('Error fetching player data:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch player data' 
      },
      { status: 500 }
    );
  }
}
