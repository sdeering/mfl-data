import { NextResponse } from 'next/server';
import { makeNonce } from '@/src/lib/session';

export const dynamic = 'force-dynamic';

/** GET /api/auth/nonce: a one-time code for the wallet to sign at login, good for 10 minutes */
export function GET() {
  return NextResponse.json({ nonce: makeNonce() }, { headers: { 'Cache-Control': 'no-store' } });
}
