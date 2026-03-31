'use client';

import { useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { supabaseSyncService } from '../services/clientSyncService';

export default function DetailedSyncDebug() {
  const { isConnected, account } = useWallet();
  const [isSyncing, setIsSyncing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    console.log(`[${timestamp}] ${message}`);
  };

  const checkTablesBeforeSync = async () => {
    addLog('=== CHECKING TABLES BEFORE SYNC ===');

    try {
      const res = await fetch(`/api/data/db-stats?walletAddress=${encodeURIComponent(account || '')}`);
      if (!res.ok) {
        addLog(`Error checking tables: HTTP ${res.status}`);
        return;
      }
      const dbStats = await res.json();

      addLog(`Agency players count: ${dbStats.tables?.agency_players?.count || 0}`);
      addLog(`Players table count: ${dbStats.tables?.players?.count || 0}`);
      addLog(`Sync status entries: ${dbStats.tables?.sync_status?.count || 0}`);

    } catch (error: any) {
      addLog(`Error checking tables: ${error.message}`);
    }
  };

  const testDirectPlayerInsert = async () => {
    addLog('=== TESTING DIRECT PLAYER INSERT ===');
    addLog('Direct insert test is not available in client mode (server-only operation)');
    addLog('Skipping direct insert test - use sync instead');

    // Simulate the old behavior by just checking connectivity
    try {
      const res = await fetch('/api/data/db-stats');
      if (!res.ok) {
        addLog(`Database connectivity error: HTTP ${res.status}`);
      } else {
        addLog('Database connection verified successfully');
      }
    } catch (error: any) {
      addLog(`Database connectivity check exception: ${error.message}`);
    }
  };

  const runDetailedSync = async () => {
    if (!account) {
      setError('Please connect your wallet first');
      return;
    }

    setIsSyncing(true);
    setError(null);
    setLogs([]);

    try {
      await checkTablesBeforeSync();
      
      addLog('=== STARTING DETAILED SYNC ===');
      
      // Test direct insert first
      await testDirectPlayerInsert();
      
      // Run the actual sync
      await supabaseSyncService.syncAllData(account, {
        forceRefresh: true,
        onProgress: (progressUpdate) => {
          addLog(`Progress: ${progressUpdate.dataType} - ${progressUpdate.message} (${progressUpdate.progress}%)`);
          if (progressUpdate.error) {
            addLog(`Error in ${progressUpdate.dataType}: ${progressUpdate.error}`);
          }
        },
        onComplete: () => {
          addLog('=== SYNC COMPLETED ===');
          checkTablesAfterSync();
        },
        onError: (error) => {
          addLog(`Sync failed: ${error.message}`);
          setError(error.message);
          setIsSyncing(false);
        }
      });
    } catch (error: any) {
      addLog(`Sync exception: ${error.message}`);
      setError(error.message);
      setIsSyncing(false);
    }
  };

  const checkTablesAfterSync = async () => {
    addLog('=== CHECKING TABLES AFTER SYNC ===');

    try {
      const res = await fetch(`/api/data/db-stats?walletAddress=${encodeURIComponent(account || '')}`);
      if (!res.ok) {
        addLog(`Error checking tables after sync: HTTP ${res.status}`);
        return;
      }
      const dbStats = await res.json();

      addLog(`Agency players count after sync: ${dbStats.tables?.agency_players?.count || 0}`);
      addLog(`Players table count after sync: ${dbStats.tables?.players?.count || 0}`);

      // Show sample data
      const agencySample = dbStats.tables?.agency_players?.sample;
      if (agencySample && agencySample.length > 0) {
        addLog(`Sample agency player: ${JSON.stringify(agencySample[0], null, 2)}`);
      }

      const playersSample = dbStats.tables?.players?.sample;
      if (playersSample && playersSample.length > 0) {
        addLog(`Sample player: ${JSON.stringify(playersSample[0], null, 2)}`);
      }

    } catch (error: any) {
      addLog(`Error checking tables after sync: ${error.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Detailed Sync Debug</h1>
        <p>Please connect your wallet to debug the sync process.</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Detailed Sync Debug</h1>
      <p className="mb-4">Wallet: {account}</p>

      <div className="mb-4 space-x-4">
        <button
          onClick={checkTablesBeforeSync}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Check Tables
        </button>
        <button
          onClick={testDirectPlayerInsert}
          className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
        >
          Test Direct Insert
        </button>
        <button
          onClick={runDetailedSync}
          disabled={isSyncing}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
        >
          {isSyncing ? 'Syncing...' : 'Run Detailed Sync'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          <strong>Error:</strong> {error}
        </div>
      )}

      {logs.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-2">Debug Logs</h2>
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

