import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/squads/[id] - Get a specific squad
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data: squad, error } = await supabase
      .from('squads')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error) {
      console.error('Error fetching squad:', error);
      return NextResponse.json(
        { error: 'Squad not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ squad });
  } catch (error) {
    console.error('Error in GET /api/squads/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/squads/[id] - Update a squad
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Check if squad exists and belongs to the wallet
    const { data: existingSquad, error: fetchError } = await supabase
      .from('squads')
      .select('*')
      .eq('id', params.id)
      .eq('wallet_address', walletAddress)
      .single();

    if (fetchError || !existingSquad) {
      return NextResponse.json(
        { error: 'Squad not found or access denied' },
        { status: 404 }
      );
    }

    // Check if new squad name conflicts with existing squads (excluding current one)
    const { data: nameConflict } = await supabase
      .from('squads')
      .select('id')
      .eq('wallet_address', walletAddress)
      .eq('squad_name', squadName)
      .neq('id', params.id)
      .single();

    if (nameConflict) {
      return NextResponse.json(
        { error: 'Squad name already exists' },
        { status: 409 }
      );
    }

    // Update squad
    const { data: squad, error } = await supabase
      .from('squads')
      .update({
        squad_name: squadName,
        formation_id: formationId,
        players: players
      })
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating squad:', error);
      return NextResponse.json(
        { error: 'Failed to update squad' },
        { status: 500 }
      );
    }

    return NextResponse.json({ squad });
  } catch (error) {
    console.error('Error in PUT /api/squads/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/squads/[id] - Delete a squad
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    // Check if squad exists and belongs to the wallet
    const { data: existingSquad, error: fetchError } = await supabase
      .from('squads')
      .select('*')
      .eq('id', params.id)
      .eq('wallet_address', walletAddress)
      .single();

    if (fetchError || !existingSquad) {
      return NextResponse.json(
        { error: 'Squad not found or access denied' },
        { status: 404 }
      );
    }

    // Delete squad
    const { error } = await supabase
      .from('squads')
      .delete()
      .eq('id', params.id);

    if (error) {
      console.error('Error deleting squad:', error);
      return NextResponse.json(
        { error: 'Failed to delete squad' },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Squad deleted successfully' });
  } catch (error) {
    console.error('Error in DELETE /api/squads/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
