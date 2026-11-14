import { NextResponse } from 'next/server'
import { isWhitelisted } from './aiAccess'
import { sessionWallet } from './session'

// Server-only. Pages for the whitelisted friends only (the AI whitelist in aiAccess.ts), such as Player Scouting.

/**
 * Why a request may not use a whitelisted-only API, or null when it may: it needs a verified session (401) whose
 * wallet is on the whitelist (403).
 */
export function whitelistDenial(request: { cookies: { get: (name: string) => { value: string } | undefined } }) {
  const wallet = sessionWallet(request)
  if (!wallet) return NextResponse.json({ success: false, error: 'Sign in with your wallet first' }, { status: 401 })
  if (!isWhitelisted(wallet)) return NextResponse.json({ success: false, error: 'This is invite-only. Ask @DogeSports69 on X for access.' }, { status: 403 })
  return null
}
