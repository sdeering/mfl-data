import { NextRequest, NextResponse } from 'next/server';
import { importToken, sessionWallet } from '@/src/lib/session';

export const dynamic = 'force-dynamic';

/** GET /api/auth/import-token: the MFL import bookmark's key for the signed-in wallet */
export function GET(request: NextRequest) {
  const wallet = sessionWallet(request);
  if (!wallet) return NextResponse.json({ success: false, error: 'Verify your wallet first' }, { status: 401 });
  return NextResponse.json({ success: true, token: importToken(wallet) }, { headers: { 'Cache-Control': 'no-store' } });
}
