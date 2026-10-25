import { NextRequest, NextResponse } from 'next/server';
import { executeRaw } from '../../../../src/lib/db-helpers';

// More than anyone has squads, so a request can't make the statement huge
const MAX_SQUADS = 200;

// PUT /api/squads/order - Put a wallet's squads in the order given, first to last
export async function PUT(request: NextRequest) {
  try {
    const { walletAddress, squadIds } = await request.json();

    if (
      !walletAddress ||
      !Array.isArray(squadIds) ||
      squadIds.length === 0 ||
      squadIds.length > MAX_SQUADS ||
      !squadIds.every(id => typeof id === 'string')
    ) {
      return NextResponse.json({ error: 'A wallet address and the squad IDs in order are required' }, { status: 400 });
    }

    // One statement, so the list is never left half in its new order. Only the wallet's own squads change.
    const { error } = await executeRaw(
      `UPDATE squads SET sort_order = CASE id ${squadIds.map(() => 'WHEN ? THEN ?').join(' ')} END
       WHERE wallet_address = ? AND id IN (${squadIds.map(() => '?').join(', ')})`,
      [...squadIds.flatMap((id: string, index: number) => [id, index]), walletAddress, ...squadIds]
    );

    if (error) {
      console.error('Error ordering squads:', error);
      return NextResponse.json({ error: 'Failed to save the order of the squads' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error in PUT /api/squads/order:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
