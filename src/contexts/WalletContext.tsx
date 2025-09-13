"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as fcl from '@onflow/fcl';

interface WalletContextType {
  isConnected: boolean;
  account: string | null;
  user: any;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  isLoading: boolean;
  error: string | null;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

interface WalletProviderProps {
  children: ReactNode;
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [account, setAccount] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize FCL and check connection on mount
  useEffect(() => {
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
        });

        // Check if user is already authenticated
        const currentUser = await fcl.currentUser.snapshot();
        if (currentUser.loggedIn) {
          setUser(currentUser);
          setAccount(currentUser.addr);
          setIsConnected(true);
        }
      } catch (error) {
        console.error('Error initializing FCL:', error);
      }
    };

    initializeFCL();
  }, []);

  // Listen for FCL user changes
  useEffect(() => {
    const unsubscribe = fcl.currentUser.subscribe((user: any) => {
      if (user.loggedIn) {
        setUser(user);
        setAccount(user.addr);
        setIsConnected(true);
        
        // Redirect to agency page after successful connection
        if (typeof window !== 'undefined' && window.location.pathname === '/') {
          window.location.href = '/agency';
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
  }, []);

  const connectWallet = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Suppress WalletConnect warning during authentication
      const originalWarn = console.warn;
      console.warn = (...args) => {
        if (args[0] && typeof args[0] === 'string' && args[0].includes('WalletConnect Service Plugin')) {
          return; // Suppress WalletConnect warning
        }
        originalWarn.apply(console, args);
      };

      // Use FCL authentication which will show available wallets including Dapper
      console.log('Starting FCL authentication...');
      
      // Skip discovery debug to avoid CORS issues
      console.log('Attempting to connect to Dapper wallet directly...');
      
      // Authenticate with Dapper wallet
      await fcl.authenticate();
      console.log('FCL authentication completed');

      // Restore original console.warn after authentication
      console.warn = originalWarn;
    } catch (error: any) {
      console.error('Error connecting wallet:', error);
      setError(error.message || 'Failed to connect wallet. Please make sure you have a Flow-compatible wallet installed (like Dapper wallet) and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectWallet = async () => {
    try {
      await fcl.unauthenticate();
      setUser(null);
      setAccount(null);
      setIsConnected(false);
      setError(null);
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
    }
  };

  const value: WalletContextType = {
    isConnected,
    account,
    user,
    connectWallet,
    disconnectWallet,
    isLoading,
    error,
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
