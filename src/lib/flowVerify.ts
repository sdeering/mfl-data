import * as fcl from '@onflow/fcl'
import { normalizeWalletAddress } from '../utils/walletAddress'

/*
 * Server-only. Asks Flow mainnet whether signatures are the account's: FCL runs a script against the FCLCrypto
 * contract, which checks them against the account's keys and their weights.
 */

const FCL_CRYPTO_MAINNET = '0xb4b82a1c9d21d284'

export interface CompositeSignature {
  f_type: string
  f_vsn: string
  addr: string
  keyId: number
  signature: string
}

let configured = false
const configure = () => {
  if (configured) return
  fcl.config({ 'accessNode.api': 'https://rest-mainnet.onflow.org', 'flow.network': 'mainnet' })
  configured = true
}

/** Signatures as FCL wants them, all by the one account; null when any is malformed */
export function cleanSignatures(value: unknown, wallet: string): CompositeSignature[] | null {
  if (!Array.isArray(value) || !value.length || value.length > 10) return null
  const signatures: CompositeSignature[] = []
  for (const item of value) {
    const sig = item as Partial<CompositeSignature> | null
    if (!sig || normalizeWalletAddress(String(sig.addr ?? '')) !== wallet) return null
    if (!Number.isInteger(sig.keyId) || typeof sig.signature !== 'string' || !/^[0-9a-f]+$/i.test(sig.signature)) return null
    signatures.push({ f_type: 'CompositeSignature', f_vsn: '1.0.0', addr: wallet, keyId: sig.keyId!, signature: sig.signature })
  }
  return signatures
}

/** Whether the wallet signed an account proof of our code for our app */
export async function verifyAccountProof(appIdentifier: string, wallet: string, nonce: string, signatures: CompositeSignature[]): Promise<boolean> {
  configure()
  return fcl.AppUtils.verifyAccountProof(appIdentifier, { address: wallet, nonce, signatures }, { fclCryptoContract: FCL_CRYPTO_MAINNET })
}

/** Whether the wallet signed the message (hex) */
export async function verifyUserSignatures(messageHex: string, signatures: CompositeSignature[]): Promise<boolean> {
  configure()
  return fcl.AppUtils.verifyUserSignatures(messageHex, signatures, { fclCryptoContract: FCL_CRYPTO_MAINNET })
}
