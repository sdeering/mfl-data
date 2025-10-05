'use client';

import { useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { supabaseSyncService } from '../services/supabaseSyncService';

export default function SyncTestPage() {
  const { isConnected, account } = useWallet();
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [customWalletAddress, setCustomWalletAddress] = useState('');

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const handleSync = async () => {
    const walletToSync = customWalletAddress.trim() || account;
    
    if (!walletToSync) {
      setError('Please provide a wallet address to test sync functionality');
      return;
    }

    // Basic wallet address validation
    if (!walletToSync.startsWith('0x') || walletToSync.length !== 42) {
      setError('Please enter a valid wallet address (0x followed by 40 characters)');
      return;
    }

    setIsSyncing(true);
    setError(null);
    setProgress([]);
    setLogs([]);

    addLog(`Starting sync for wallet: ${walletToSync}`);

    try {
      await supabaseSyncService.syncAllData(walletToSync, {
        forceRefresh: true,
        onProgress: (progressUpdate) => {
          addLog(`Progress: ${progressUpdate.dataType} - ${progressUpdate.message} (${progressUpdate.progress}%)`);
          setProgress(prev => {
            const existingIndex = prev.findIndex(p => p.dataType === progressUpdate.dataType);
            if (existingIndex >= 0) {
              const newProgress = [...prev];
              newProgress[existingIndex] = progressUpdate;
              return newProgress;
            } else {
              return [...prev, progressUpdate];
            }
          });
        },
        onComplete: () => {
          addLog('Sync completed successfully!');
          setIsSyncing(false);
        },
        onError: (error) => {
          addLog(`Sync failed: ${error.message}`);
          setError(error.message);
          setIsSyncing(false);
        }
      });
    } catch (error: any) {
      addLog(`Sync error: ${error.message}`);
      setError(error.message);
      setIsSyncing(false);
    }
  };

  const handleTestConnection = async () => {
    addLog('Testing database connection...');
    const isConnected = await supabaseSyncService.testConnection();
    addLog(`Connection test result: ${isConnected ? 'SUCCESS' : 'FAILED'}`);
  };

  // Remove wallet connection requirement - anyone can use this page

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Sync Test Page</h1>
      <p className="mb-4">Connected Wallet: {account || 'Not connected (optional)'}</p>

      <div className="mb-6">
        <label htmlFor="wallet-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Wallet Address to Test
        </label>
        <input
          id="wallet-input"
          type="text"
          value={customWalletAddress}
          onChange={(e) => setCustomWalletAddress(e.target.value)}
          placeholder="0x82b2e72ccb6c355c"
          className="w-full max-w-md px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Enter any wallet address to test sync functionality. If you're connected, leave empty to use your wallet.
        </p>
      </div>

      <div className="mb-4 space-x-4">
        <button
          onClick={handleTestConnection}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Test Connection
        </button>
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
        >
          {isSyncing ? 'Syncing...' : 'Start Sync'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          <strong>Error:</strong> {error}
        </div>
      )}

      {progress.length > 0 && (
        <div className="mb-4">
          <h2 className="text-lg font-semibold mb-2">Sync Progress</h2>
          <div className="space-y-2">
            {progress.map((item, index) => (
              <div key={index} className="p-3 bg-gray-100 rounded">
                <div className="flex justify-between items-center">
                  <span className="font-medium">{item.dataType}</span>
                  <span className="text-sm text-gray-600">{item.progress}%</span>
                </div>
                <div className="text-sm text-gray-700 mt-1">{item.message}</div>
                {item.error && (
                  <div className="text-sm text-red-600 mt-1">Error: {item.error}</div>
                )}
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${item.progress}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {logs.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-2">Logs</h2>
          <div className="bg-black text-green-400 p-4 rounded font-mono text-sm max-h-96 overflow-y-auto">
            {logs.map((log, index) => (
              <div key={index}>{log}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

