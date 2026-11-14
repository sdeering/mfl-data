"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import * as fcl from '@onflow/fcl';
import { normalizeWalletAddress } from '../utils/walletAddress';
import { APP_IDENTIFIER, signInMessage } from '../utils/signIn';

interface WalletContextType {
  isConnected: boolean;
  account: string | null;
  user: any;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  isLoading: boolean;
  error: string | null;
  // True once the saved login and any viewed wallet have been checked, so pages don't flash their wallet prompt
  isReady: boolean;
  // A wallet pasted in to look around read-only, when none is connected
  viewedAddress: string | null;
  viewWallet: (address: string) => boolean;
  stopViewingWallet: () => void;
  /**
   * The wallet this browser has proved it holds, by a signature Flow checked: the server only trusts this one, so
   * private pages and AI analyses need it. Null until proved.
   */
  verifiedWallet: string | null;
  /** The connected wallet is the verified one */
  isVerified: boolean;
  /** The verified wallet is on the site's whitelist (src/lib/aiAccess.ts), which lets it into Player Scouting */
  isWhitelisted: boolean;
  /** Proves the connected wallet: asks it to sign, which may open Dapper */
  verifyWallet: () => Promise<void>;
  isVerifying: boolean;
  verifyError: string | null;
  /** The session this browser already had has been read, so pages don't flash a verify prompt */
  isSessionChecked: boolean;
}

const nonce = async (): Promise<string> => {
  const response = await fetch('/api/auth/nonce', { cache: 'no-store' });
  const result = await response.json();
  if (!response.ok || typeof result.nonce !== 'string') throw new Error('Could not start the sign-in');
  return result.nonce;
};

interface VerifiedSession {
  wallet: string;
  whitelisted: boolean;
}

/** Sends a signature to the server, which checks it with Flow; resolves to the verified wallet */
const proveSession = async (payload: { kind: 'account-proof' | 'user-signature'; address: string; nonce: string; signatures: unknown }): Promise<VerifiedSession> => {
  const response = await fetch('/api/auth/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.success) throw new Error(result.error || `Sign-in failed (${response.status})`);
  return { wallet: result.wallet, whitelisted: result.whitelisted === true };
};

/** The account proof the wallet gave at login, when it gave one */
const accountProofOf = (user: any): { address: string; nonce: string; signatures: unknown } | null => {
  const service = (user?.services ?? []).find((item: any) => item?.type === 'account-proof');
  const data = service?.data;
  return data?.nonce && Array.isArray(data?.signatures) ? { address: data.address ?? user.addr, nonce: data.nonce, signatures: data.signatures } : null;
};

const VIEWED_WALLET_KEY = 'mfl-data-viewed-wallet';

const WalletContext = createContext<WalletContextType | undefined>(undefined);

interface WalletProviderProps {
  children: ReactNode;
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const router = useRouter();
  const [isConnected, setIsConnected] = useState(false);
  const [account, setAccount] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [viewedAddress, setViewedAddress] = useState<string | null>(null);
  const [session, setSession] = useState<VerifiedSession | null>(null);
  const verifiedWallet = session?.wallet ?? null;
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [isSessionChecked, setIsSessionChecked] = useState(false);

  // The session this browser already has, if any
  useEffect(() => {
    fetch('/api/auth/session', { cache: 'no-store' })
      .then(response => response.json())
      .then(result => setSession(typeof result.wallet === 'string' ? { wallet: result.wallet, whitelisted: result.whitelisted === true } : null))
      .catch(() => {})
      .finally(() => setIsSessionChecked(true));
  }, []);

  // Initialize FCL and check connection on mount
  useEffect(() => {
    // Suppress WalletConnect warnings globally
    const originalWarn = console.warn;
    console.warn = (...args) => {
      if (args[0] && typeof args[0] === 'string' && 
          (args[0].includes('WalletConnect Service Plugin') || 
           args[0].includes('All dApps are expected to register for a WalletConnect projectId'))) {
        return; // Suppress WalletConnect warning
      }
      originalWarn.apply(console, args);
    };

    try {
      setViewedAddress(normalizeWalletAddress(window.localStorage.getItem(VIEWED_WALLET_KEY) ?? ''));
    } catch {
      // Remembering the viewed wallet is a convenience
    }

    const initializeFCL = async () => {
      try {
        // Configure FCL for Flow blockchain - bypass CORS issues
        fcl.config({
          'accessNode.api': 'https://rest-mainnet.onflow.org',
          'flow.network': 'mainnet',
          'app.detail.title': 'MFL Data',
          'app.detail.icon': 'https://mfldata.com/favicon.ico',
          'app.detail.url': 'https://mfldata.com',
          // Configure Dapper wallet directly to avoid CORS issues
          'discovery.wallet': 'https://accounts.meetdapper.com/fcl/authn-restricted',
          'discovery.wallet.method': 'TAB/RPC',
          // Add WalletConnect project ID to suppress warnings
          'discovery.wallet.method.https://accounts.meetdapper.com/fcl/authn-restricted': 'TAB/RPC',
          'fcl.walletConnect.projectId': 'mfl-data-app',
          // Asks the wallet to sign a one-time code of ours at login, so the server can trust who logged in
          'fcl.accountProof.resolver': async () => ({ appIdentifier: APP_IDENTIFIER, nonce: await nonce() }),
        });

        // Check if user is already authenticated
        const currentUser = await fcl.currentUser.snapshot();
        if (currentUser.loggedIn) {
          setUser(currentUser);
          setAccount(currentUser.addr ?? null);
          setIsConnected(true);
        }
      } catch (error) {
        console.error('Error initializing FCL:', error);
      } finally {
        setIsReady(true);
      }
    };

    initializeFCL();

    // Cleanup function to restore original console.warn
    return () => {
      console.warn = originalWarn;
    };
  }, []);

  // Listen for FCL user changes
  useEffect(() => {
    const unsubscribe = fcl.currentUser.subscribe((user: any) => {
      if (user.loggedIn) {
        setUser(user);
        setAccount(user.addr);
        setIsConnected(true);
        // A fresh login's account proof proves the wallet without asking anything more
        const proof = accountProofOf(user);
        if (proof) {
          proveSession({ kind: 'account-proof', ...proof })
            .then(verified => {
              setSession(verified);
              setVerifyError(null);
            })
            .catch(() => {});
        }
        // Their own wallet replaces one they were looking at
        stopViewingWallet();
        
        // Redirect to agency page after successful connection
        if (typeof window !== 'undefined' && window.location.pathname === '/') {
          router.push('/agency');
        }
      } else {
        setUser(null);
        setAccount(null);
        setIsConnected(false);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [router]);

  const connectWallet = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Suppress WalletConnect warning during authentication
      const originalWarn = console.warn;
      const originalError = console.error;
      
      console.warn = (...args) => {
        if (args[0] && typeof args[0] === 'string' && 
            (args[0].includes('WalletConnect Service Plugin') || 
             args[0].includes('All dApps are expected to register for a WalletConnect projectId'))) {
          return; // Suppress WalletConnect warning
        }
        originalWarn.apply(console, args);
      };

      console.error = (...args) => {
        if (args[0] && typeof args[0] === 'string' && 
            args[0].includes('WalletConnect Service Plugin')) {
          return; // Suppress WalletConnect error
        }
        originalError.apply(console, args);
      };

      // Authenticate with Dapper wallet
      await fcl.authenticate();

      // Restore original console methods after authentication
      console.warn = originalWarn;
      console.error = originalError;
    } catch (error: any) {
      console.error('Error connecting wallet:', error);
      setError(error.message || 'Failed to connect wallet. Please make sure you have a Flow-compatible wallet installed (like Dapper wallet) and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Proves the connected wallet to the server: its login's account proof when it has a fresh one, else a signed
   * message, else a fresh login, whose account proof does it.
   */
  const verifyWallet = async () => {
    setIsVerifying(true);
    setVerifyError(null);
    try {
      let current: any = await fcl.currentUser.snapshot();
      if (!current?.loggedIn) {
        await fcl.authenticate();
        current = await fcl.currentUser.snapshot();
      }
      const proof = accountProofOf(current);
      if (proof) {
        try {
          setSession(await proveSession({ kind: 'account-proof', ...proof }));
          return;
        } catch {
          // An old login's proof has expired: sign instead
        }
      }
      const code = await nonce();
      let signatures: unknown = null;
      try {
        signatures = await fcl.currentUser.signUserMessage(signInMessage(code));
      } catch {
        // The wallet doesn't sign messages: a fresh login gives an account proof
      }
      if (Array.isArray(signatures) && signatures.length) {
        setSession(await proveSession({ kind: 'user-signature', address: current.addr, nonce: code, signatures }));
        return;
      }
      await fcl.unauthenticate();
      await fcl.authenticate();
      const again = accountProofOf(await fcl.currentUser.snapshot());
      if (!again) throw new Error("Your wallet didn't give a sign-in proof. Ask @DogeSports69 on X for help.");
      setSession(await proveSession({ kind: 'account-proof', ...again }));
    } catch (error: any) {
      setVerifyError(error?.message || 'Could not verify your wallet');
    } finally {
      setIsVerifying(false);
    }
  };

  const disconnectWallet = async () => {
    try {
      fetch('/api/auth/session', { method: 'DELETE' }).catch(() => {});
      setSession(null);
      await fcl.unauthenticate();
      setUser(null);
      setAccount(null);
      setIsConnected(false);
      setError(null);
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
    }
  };

  const viewWallet = (address: string): boolean => {
    const normalized = normalizeWalletAddress(address);
    if (!normalized) return false;
    setViewedAddress(normalized);
    try {
      window.localStorage.setItem(VIEWED_WALLET_KEY, normalized);
    } catch {
      // Remembering the viewed wallet is a convenience
    }
    return true;
  };

  function stopViewingWallet() {
    setViewedAddress(null);
    try {
      window.localStorage.removeItem(VIEWED_WALLET_KEY);
    } catch {
      // Nothing was remembered
    }
  }

  const isVerified = !!account && !!verifiedWallet && normalizeWalletAddress(account) === verifiedWallet;
  const value: WalletContextType = {
    isConnected,
    account,
    user,
    connectWallet,
    disconnectWallet,
    isLoading,
    error,
    isReady,
    viewedAddress,
    viewWallet,
    stopViewingWallet,
    verifiedWallet,
    isVerified,
    isWhitelisted: isVerified && !!session?.whitelisted,
    verifyWallet,
    isVerifying,
    verifyError,
    isSessionChecked,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = (): WalletContextType => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

// Flow blockchain and Dapper wallet types
declare global {
  interface Window {
    fcl?: any;
    dapper?: {
      enable: () => Promise<string[]>;
      request: (args: { method: string; params?: any[] }) => Promise<any>;
    };
  }
}
