import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

    const { data: squads, error } = await supabase
      .from('squads')
      .select('*')
      .eq('wallet_address', walletAddress)
      .order('updated_at', { ascending: false });

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

    // Check if squad name already exists for this wallet
    const { data: existingSquad } = await supabase
      .from('squads')
      .select('id')
      .eq('wallet_address', walletAddress)
      .eq('squad_name', squadName)
      .single();

    if (existingSquad) {
      return NextResponse.json(
        { error: 'Squad name already exists' },
        { status: 409 }
      );
    }

    // Create new squad
    const { data: squad, error } = await supabase
      .from('squads')
      .insert({
        wallet_address: walletAddress,
        squad_name: squadName,
        formation_id: formationId,
        players: players
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating squad:', error);
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
