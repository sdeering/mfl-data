import { NextRequest, NextResponse } from 'next/server';
import { cleanSignatures, verifyAccountProof, verifyUserSignatures } from '@/src/lib/flowVerify';
import { takeRateLimits, visitorKey } from '@/src/lib/rateLimit';
import { APP_IDENTIFIER, SESSION_COOKIE, checkNonce, sessionCookieOptions, sessionValue, sessionWallet, signInMessage } from '@/src/lib/session';
import { normalizeWalletAddress } from '@/src/utils/walletAddress';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/** GET /api/auth/session: the wallet this browser has proved, or null */
export function GET(request: NextRequest) {
  return NextResponse.json({ wallet: sessionWallet(request) }, { headers: { 'Cache-Control': 'no-store' } });
}

/**
 * POST /api/auth/session { address, nonce, signatures, kind: 'account-proof' | 'user-signature' }
 * Proves the wallet: the signatures must be the account's, over our recent code, as Flow checks them. Then a
 * session cookie keeps it for 30 days.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const wallet = normalizeWalletAddress(typeof body?.address === 'string' ? body.address : '');
  const kind = body?.kind;
  const nonce = body?.nonce;
  const signatures = wallet ? cleanSignatures(body?.signatures, wallet) : null;
  if (!wallet || !signatures || (kind !== 'account-proof' && kind !== 'user-signature')) {
    return NextResponse.json({ success: false, error: "That isn't a wallet signature" }, { status: 400 });
  }
  if (!checkNonce(nonce)) return NextResponse.json({ success: false, error: 'That sign-in has expired. Try again.' }, { status: 400 });

  try {
    if (process.env.TURSO_DATABASE_URL) {
      const wait = await takeRateLimits([{ key: `auth:${visitorKey(request)}`, limit: 20, windowMs: 10 * 60 * 1000 }]);
      if (wait) return NextResponse.json({ success: false, error: 'Too many sign-ins. Try again in a few minutes.' }, { status: 429 });
    }
    const valid =
      kind === 'account-proof'
        ? await verifyAccountProof(APP_IDENTIFIER, wallet, nonce, signatures)
        : await verifyUserSignatures(signInMessage(nonce), signatures);
    if (!valid) return NextResponse.json({ success: false, error: "Flow says that signature isn't this wallet's" }, { status: 401 });
    const response = NextResponse.json({ success: true, wallet });
    response.cookies.set(SESSION_COOKIE, sessionValue(wallet), sessionCookieOptions);
    return response;
  } catch (error) {
    console.error('[API] POST /api/auth/session failed:', error);
    return NextResponse.json({ success: false, error: "Couldn't check the signature with Flow. Try again." }, { status: 502 });
  }
}

/** DELETE /api/auth/session: signs out */
export function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE, '', { ...sessionCookieOptions, maxAge: 0 });
  return response;
}
