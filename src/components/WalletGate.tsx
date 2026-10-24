"use client";

import React, { useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { normalizeWalletAddress } from '../utils/walletAddress';
import { PageHeader, Panel, btnPrimary, btnSecondary } from './ui';

interface WalletGateProps {
  title: string;
  /** What the page shows once there is a wallet, e.g. "every player you own" */
  description: string;
}

/**
 * Shown in place of a page that needs a wallet: connect your own, or paste any wallet address to look around read-only.
 * While the saved login is still being checked it shows a spinner instead, so a connected visitor never sees it flash.
 */
const WalletGate: React.FC<WalletGateProps> = ({ title, description }) => {
  const { connectWallet, viewWallet, isLoading, isReady = true } = useWallet();
  const [address, setAddress] = useState('');
  const [invalid, setInvalid] = useState(false);

  if (!isReady) {
    return (
      <div className="flex flex-col gap-[22px]">
        <PageHeader title={title} />
        <Panel className="flex items-center justify-center gap-3 px-6 py-12 text-muted">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-accent border-t-transparent"></div>
          <span>Checking wallet connection...</span>
        </Panel>
      </div>
    );
  }

  const submit = (value: string) => {
    if (!viewWallet(value)) setInvalid(true);
  };

  return (
    <div className="flex flex-col gap-[22px]">
      <PageHeader title={title} subtitle={`Connect a wallet to see ${description}.`} />
      <Panel className="grid md:grid-cols-[1fr_auto_1fr] gap-6 md:gap-0 p-6 sm:p-8">
        <div className="flex flex-col items-start gap-3 md:pr-8">
          <span className="grid place-items-center w-11 h-11 rounded-xl bg-accent text-accent-fg" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
              <rect x="3" y="6" width="18" height="13" rx="3" />
              <path d="M16 12.5h2M3 10h18" />
            </svg>
          </span>
          <h2 className="m-0 font-display text-xl font-bold">Connect your wallet</h2>
          <p className="m-0 text-sm text-muted">Sign in with your Dapper wallet to see your own players and clubs, sync your data and save squads.</p>
          <button type="button" onClick={connectWallet} disabled={isLoading} className={`${btnPrimary} mt-1`}>
            {isLoading ? 'Connecting...' : 'Connect Wallet'}
          </button>
        </div>

        <div className="flex md:flex-col items-center gap-3 text-xs font-bold uppercase tracking-[0.1em] text-muted-3" aria-hidden="true">
          <span className="flex-1 h-px md:h-auto md:w-px bg-line" />
          or
          <span className="flex-1 h-px md:h-auto md:w-px bg-line" />
        </div>

        <form
          className="flex flex-col items-start gap-3 md:pl-8"
          onSubmit={(e) => {
            e.preventDefault();
            submit(address);
          }}
        >
          <span className="grid place-items-center w-11 h-11 rounded-xl border border-line-2 bg-chip text-fg-2" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </span>
          <h2 className="m-0 font-display text-xl font-bold">View any wallet</h2>
          <p className="m-0 text-sm text-muted">Paste a wallet address to look around read-only.</p>
          <div className="flex w-full max-w-md gap-2 mt-1">
            <input
              type="text"
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                setInvalid(false);
              }}
              onPaste={(e) => {
                const pasted = e.clipboardData.getData('text');
                if (normalizeWalletAddress(pasted)) {
                  e.preventDefault();
                  setAddress(pasted.trim());
                  submit(pasted);
                }
              }}
              placeholder="0x…"
              aria-label="Wallet address"
              aria-invalid={invalid}
              spellCheck={false}
              className={`flex-1 min-w-0 h-10 px-3.5 rounded-xl border bg-field font-mono text-sm text-strong outline-none focus:border-line-hover ${invalid ? 'border-red-500/60' : 'border-line-3'}`}
            />
            <button type="submit" className={btnSecondary}>
              View
            </button>
          </div>
          {invalid && (
            <p className="m-0 text-sm text-danger-ink" role="alert">
              That isn&apos;t a wallet address. It should be 0x followed by 16 letters and numbers.
            </p>
          )}
        </form>
      </Panel>
    </div>
  );
};

export default WalletGate;
