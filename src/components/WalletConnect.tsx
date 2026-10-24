"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useWallet } from '../contexts/WalletContext';
import { useSupabaseSyncUI } from '../contexts/SupabaseSyncContext';

interface WalletConnectProps {
  className?: string;
}

const WalletIcon: React.FC = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
    <rect x="3" y="6" width="18" height="13" rx="3" />
    <path d="M16 12.5h2M3 10h18" />
  </svg>
);

const Spinner: React.FC<{ label?: string }> = ({ label }) => (
  <svg className="animate-spin w-4 h-4 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

const pillClass =
  'flex-none flex items-center gap-2 h-10 px-4 rounded-full bg-accent text-accent-fg text-[13px] font-bold whitespace-nowrap cursor-pointer transition-colors hover:bg-[#d8fb74] disabled:opacity-50 disabled:cursor-not-allowed';
const itemClass = 'w-full flex items-center gap-2 h-10 px-3 rounded-[10px] text-left text-sm font-semibold transition-colors cursor-pointer';

const WalletConnect: React.FC<WalletConnectProps> = ({ className = '' }) => {
  const { isConnected, account, connectWallet, disconnectWallet, isLoading, error, viewedAddress = null, stopViewingWallet } = useWallet();
  const { startSync, stopSync, isSyncing, progress } = useSupabaseSyncUI();
  const [showDropdown, setShowDropdown] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Show the tick for a moment after copying the address
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}…${address.slice(-4)}`;
  };

  const handleConnect = async () => {
      try {
        await connectWallet();
      } catch (error) {
        console.error('Dapper wallet connection failed:', error);
      }
  };

  const handleDisconnect = () => {
    disconnectWallet();
    setShowDropdown(false);
  };

  const handleCopyAddress = async () => {
    if (!account) return;
    try {
      await navigator.clipboard.writeText(account);
      setCopied(true);
    } catch (error) {
      console.error('Copying the wallet address failed:', error);
    }
  };

  const handleSync = () => {
    startSync(true); // Force refresh = true (clear all relationships and pull fresh)
  };

  // Label of the sync step currently running, e.g. "agency players"
  const currentSyncStep = progress.find(p => p.status === 'in_progress')?.dataType.split(':')[0].replace(/_/g, ' ');


  if (isConnected && account) {
    return (
      <div className="relative flex-none">
        <button onClick={() => setShowDropdown(!showDropdown)} className={`${pillClass} ${className}`} aria-expanded={showDropdown}>
          {isSyncing ? <Spinner label="Syncing data" /> : <WalletIcon />}
          <span className="hidden sm:inline font-mono font-medium">{formatAddress(account)}</span>
        </button>

        {showDropdown && (
          <div className="absolute right-0 top-12 w-60 p-1.5 rounded-2xl border border-line-2 bg-panel shadow-[0_20px_50px_rgba(0,0,0,.45)] z-50">
            <div className="px-3 pt-2 pb-3 mb-1 border-b border-divider">
              <p className="text-xs font-semibold text-muted">Connected as</p>
              <div className="flex items-center gap-1.5">
                <p className="min-w-0 font-mono text-sm text-fg break-all">{account}</p>
                <button
                  type="button"
                  onClick={handleCopyAddress}
                  className={`flex-shrink-0 p-1 rounded-md transition-colors cursor-pointer ${copied ? 'text-accent-ink' : 'text-muted hover:text-accent-ink hover:bg-chip'}`}
                  aria-label={copied ? 'Copied' : 'Copy wallet address'}
                  title={copied ? 'Copied' : 'Copy wallet address'}
                >
                  {copied ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            {isSyncing ? (
              <>
                <div className={`${itemClass} text-accent-ink cursor-default`}>
                  <Spinner />
                  <span className="truncate">{currentSyncStep ? `Syncing ${currentSyncStep}...` : 'Syncing...'}</span>
                </div>
                <button onClick={stopSync} className={`${itemClass} text-fg-2 hover:bg-chip`}>
                  Stop Sync
                </button>
              </>
            ) : (
              <button onClick={handleSync} className={`${itemClass} text-accent-ink hover:bg-chip`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Sync Agency Data</span>
              </button>
            )}
            <Link href="/settings" onClick={() => setShowDropdown(false)} className={`${itemClass} text-fg-2 hover:bg-chip`}>
              Settings
            </Link>
            <button onClick={handleDisconnect} className={`${itemClass} text-danger-ink hover:bg-red-500/10`}>
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {viewedAddress && (
        <span
          className="hidden md:flex flex-none items-center gap-1.5 h-10 pl-3.5 pr-1 rounded-full border border-[rgba(var(--glass-rgb),.12)] bg-[rgba(var(--glass-rgb),.05)] text-[13px] font-semibold text-fg-2 whitespace-nowrap"
          title="Looking at this wallet read-only"
        >
          Viewing <span className="font-mono font-medium text-fg">{formatAddress(viewedAddress)}</span>
          <button
            type="button"
            onClick={stopViewingWallet}
            aria-label="Stop viewing this wallet"
            title="Stop viewing this wallet"
            className="grid place-items-center w-8 h-8 rounded-full text-muted cursor-pointer transition-colors hover:text-fg hover:bg-chip"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </span>
      )}
      <button onClick={handleConnect} disabled={isLoading} className={`${pillClass} ${className}`}>
        {isLoading ? <Spinner /> : <WalletIcon />}
        <span className="hidden min-[30rem]:inline">{isLoading ? 'Connecting...' : 'Connect Wallet'}</span>
        <span className="min-[30rem]:hidden">{isLoading ? '' : 'Connect'}</span>
      </button>
    </>
  );
};

export default WalletConnect;
