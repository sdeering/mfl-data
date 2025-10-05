import { NextRequest, NextResponse } from 'next/server';
import { getPlayerMarketValue } from '../../../../src/services/marketValueService';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ playerId: string }> }
) {
  try {
    const { playerId } = await params;
    const { walletAddress, forceRecalculate } = await request.json();

    // Use the centralized market value calculation service
    const result = await getPlayerMarketValue(
      playerId, 
      walletAddress, 
      forceRecalculate || false
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.error === 'Player not found' ? 404 : 500 }
      );
    }

    return NextResponse.json({
      success: true,
      marketValue: result.marketValue,
      confidence: result.confidence,
      details: result.details
    });

  } catch (error) {
    console.error('❌ Error calculating market value:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
