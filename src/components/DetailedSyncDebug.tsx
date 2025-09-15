'use client';

import { useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { supabase, TABLES } from '../lib/supabase';
import { supabaseSyncService } from '../services/supabaseSyncService';

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
      // Check agency players
      const { data: agencyPlayers, error: agencyError } = await supabase
        .from(TABLES.AGENCY_PLAYERS)
        .select('*')
        .eq('wallet_address', account)
        .limit(5);
      
      addLog(`Agency players count: ${agencyPlayers?.length || 0}`);
      if (agencyError) addLog(`Agency players error: ${agencyError.message}`);
      
      // Check players table
      const { data: players, error: playersError } = await supabase
        .from(TABLES.PLAYERS)
        .select('*')
        .limit(5);
      
      addLog(`Players table count: ${players?.length || 0}`);
      if (playersError) addLog(`Players table error: ${playersError.message}`);
      
      // Check sync status
      const { data: syncStatus, error: syncError } = await supabase
        .from(TABLES.SYNC_STATUS)
        .select('*')
        .order('updated_at', { ascending: false });
      
      addLog(`Sync status entries: ${syncStatus?.length || 0}`);
      if (syncError) addLog(`Sync status error: ${syncError.message}`);
      
    } catch (error: any) {
      addLog(`Error checking tables: ${error.message}`);
    }
  };

  const testDirectPlayerInsert = async () => {
    addLog('=== TESTING DIRECT PLAYER INSERT ===');
    
    try {
      const testPlayer = {
        mfl_player_id: 999999,
        data: {
          id: 999999,
          name: 'Test Player',
          position: 'ST',
          club: { id: 1, name: 'Test Club' }
        },
        last_synced: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from(TABLES.PLAYERS)
        .upsert(testPlayer, {
          onConflict: 'mfl_player_id'
        });

      if (error) {
        addLog(`Direct insert error: ${error.message}`);
        addLog(`Error details: ${JSON.stringify(error)}`);
      } else {
        addLog('Direct insert successful');
        
        // Clean up test data
        await supabase
          .from(TABLES.PLAYERS)
          .delete()
          .eq('mfl_player_id', 999999);
        addLog('Test data cleaned up');
      }
    } catch (error: any) {
      addLog(`Direct insert exception: ${error.message}`);
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
      // Check agency players
      const { data: agencyPlayers, error: agencyError } = await supabase
        .from(TABLES.AGENCY_PLAYERS)
        .select('*')
        .eq('wallet_address', account);
      
      addLog(`Agency players count after sync: ${agencyPlayers?.length || 0}`);
      if (agencyError) addLog(`Agency players error: ${agencyError.message}`);
      
      // Check players table
      const { data: players, error: playersError } = await supabase
        .from(TABLES.PLAYERS)
        .select('*');
      
      addLog(`Players table count after sync: ${players?.length || 0}`);
      if (playersError) addLog(`Players table error: ${playersError.message}`);
      
      // Show sample data
      if (agencyPlayers && agencyPlayers.length > 0) {
        addLog(`Sample agency player: ${JSON.stringify(agencyPlayers[0], null, 2)}`);
      }
      
      if (players && players.length > 0) {
        addLog(`Sample player: ${JSON.stringify(players[0], null, 2)}`);
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

