'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { supabaseSyncService } from '../services/supabaseSyncService';
import { supabaseDataService } from '../services/supabaseDataService';
import { supabase } from '../lib/supabase';
import Link from 'next/link';

export default function SyncDebugTest() {
  const { account, isConnected } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [customWalletAddress, setCustomWalletAddress] = useState('');
  const [testedWallet, setTestedWallet] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [showSyncStatus, setShowSyncStatus] = useState(false);

  const runDebugTest = async () => {
    const walletToTest = customWalletAddress.trim() || account;
    
    if (!walletToTest) {
      setResults({ error: 'Please provide a wallet address to test' });
      return;
    }

    // Basic wallet address validation (accept both standard 42-char and MFL custom format)
    if (!walletToTest.startsWith('0x') || walletToTest.length < 4) {
      setResults({ error: 'Please enter a valid wallet address (must start with 0x)' });
      return;
    }
    
    setIsLoading(true);
    setResults(null);
    setTestedWallet(walletToTest);
    setShowSyncStatus(true);
    setSyncStatus({ message: 'Starting sync...', progress: 0 });
    
    try {
      console.log(`🔍 Starting sync debug test for wallet: ${walletToTest}`);
      
      // 1. Check current table counts
      setSyncStatus({ message: 'Checking current data...', progress: 10 });
      const agencyPlayers = await supabaseDataService.getAgencyPlayers(walletToTest);
      console.log('Current agency players count:', agencyPlayers.length);
      
      // 2. Run a manual sync
      console.log('🔄 Running manual sync...');
      setSyncStatus({ message: 'Syncing data from MFL.com...', progress: 20 });
      await supabaseSyncService.syncAllData(walletToTest, {
        forceRefresh: true,
        onProgress: (progress) => {
          console.log('Sync progress:', progress);
          setSyncStatus({
            message: progress.message || 'Syncing data...',
            progress: 20 + (progress.percentage || 0) * 0.6, // 20-80% range
            currentItem: progress.currentItem
          });
        }
      });
      
      // 3. Check table counts after sync
      setSyncStatus({ message: 'Verifying sync results...', progress: 85 });
      const agencyPlayersAfter = await supabaseDataService.getAgencyPlayers(walletToTest);
      console.log('Agency players count after sync:', agencyPlayersAfter.length);
      
      // 4. Check players table directly
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('*')
        .limit(5);
      
      console.log('Players table sample:', playersData);
      if (playersError) console.error('Players table error:', playersError);
      
      // 5. Check agency players table directly
      const { data: agencyPlayersData, error: agencyPlayersError } = await supabase
        .from('agency_players')
        .select('*')
        .eq('wallet_address', walletToTest)
        .limit(5);
      
      console.log('Agency players table sample:', agencyPlayersData);
      if (agencyPlayersError) console.error('Agency players table error:', agencyPlayersError);
      
      setSyncStatus({ message: 'Sync completed successfully!', progress: 100 });
      
      setResults({
        before: agencyPlayers.length,
        after: agencyPlayersAfter.length,
        playersTableSample: playersData,
        playersTableError: playersError,
        agencyPlayersTableSample: agencyPlayersData,
        agencyPlayersTableError: agencyPlayersError,
        success: true
      });
      
    } catch (error) {
      console.error('Debug test failed:', error);
      setSyncStatus({ message: 'Sync failed', progress: 0, error: true });
      setResults({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setIsLoading(false);
      // Hide sync status after a delay
      setTimeout(() => {
        setShowSyncStatus(false);
      }, 3000);
    }
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
        Sync Debug Test
      </h2>
      
      {/* Sync Status Dialog */}
      {showSyncStatus && syncStatus && (
        <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 max-w-sm z-50">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">
              Syncing Data from MFL.com
            </h3>
            <button
              onClick={() => setShowSyncStatus(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              ×
            </button>
          </div>
          
          <div className="mb-2">
            <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
              <span>{syncStatus.message}</span>
              <span>{Math.round(syncStatus.progress || 0)}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${
                  syncStatus.error ? 'bg-red-500' : 'bg-blue-500'
                }`}
                style={{ width: `${syncStatus.progress || 0}%` }}
              />
            </div>
          </div>
          
          {syncStatus.currentItem && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {syncStatus.currentItem}
            </p>
          )}
        </div>
      )}
      
      <div className="mb-4">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
          Connected Wallet: {account || 'Not connected (optional)'}
        </p>
        
        <div className="mb-4">
          <label htmlFor="debug-wallet-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Wallet Address to Test
          </label>
          <input
            id="debug-wallet-input"
            type="text"
            value={customWalletAddress}
            onChange={(e) => setCustomWalletAddress(e.target.value)}
            placeholder="0x2bb2bd99475d2504"
            className="w-full max-w-md px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Enter any wallet address to test sync functionality. If you're connected, leave empty to use your wallet.
          </p>
        </div>
        
        <button
          onClick={runDebugTest}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? 'Running Test...' : 'Run Debug Test'}
        </button>
      </div>

      {results && (
        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Results:</h3>
          <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
            {JSON.stringify(results, null, 2)}
          </pre>
          
          {results.success && testedWallet && (
            <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-green-800 dark:text-green-200 text-sm mb-2">
                ✅ Sync completed successfully! View the agency players:
              </p>
              <Link 
                href={`/agency/${testedWallet}`}
                className="inline-flex items-center px-3 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors"
              >
                View Agency: {testedWallet}
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
