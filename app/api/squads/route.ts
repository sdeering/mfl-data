import { NextRequest, NextResponse } from 'next/server';
import { selectAll, selectMaybeOne, updateWhere, upsertOne } from '../../../src/lib/db-helpers';

// GET /api/squads - Get all squads for a wallet
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    const { data: squads, error } = await selectAll('squads', {
      where: { wallet_address: walletAddress },
      orderBy: { column: 'updated_at', ascending: false }
    });

    if (error) {
      console.error('Error fetching squads:', error);
      return NextResponse.json(
        { error: 'Failed to fetch squads' },
        { status: 500 }
      );
    }

    return NextResponse.json({ squads });
  } catch (error) {
    console.error('Error in GET /api/squads:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/squads - Create a new squad
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress, squadName, formationId, players } = body;

    // Validation
    if (!walletAddress || !squadName || !formationId || !players) {
      return NextResponse.json(
        { error: 'Missing required fields: walletAddress, squadName, formationId, players' },
        { status: 400 }
      );
    }

    // Upsert: insert or overwrite on duplicate (wallet_address, squad_name)
    const { data: squad, error } = await upsertOne('squads', {
      wallet_address: walletAddress,
      squad_name: squadName,
      formation_id: formationId,
      players: players
    }, 'wallet_address, squad_name');

    if (error) {
      console.error('Error creating/updating squad:', error);
      return NextResponse.json(
        { error: 'Failed to create squad' },
        { status: 500 }
      );
    }

    return NextResponse.json({ squad }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/squads:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
