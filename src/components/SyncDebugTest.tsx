'use client';

import { useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { supabaseSyncService } from '../services/supabaseSyncService';
import { supabaseDataService } from '../services/supabaseDataService';
import { supabase } from '../lib/supabase';

export default function SyncDebugTest() {
  const { account, isConnected } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any>(null);

  const runDebugTest = async () => {
    if (!account || !isConnected) return;
    
    setIsLoading(true);
    setResults(null);
    
    try {
      console.log('🔍 Starting sync debug test...');
      
      // 1. Check current table counts
      const agencyPlayers = await supabaseDataService.getAgencyPlayers(account);
      console.log('Current agency players count:', agencyPlayers.length);
      
      // 2. Run a manual sync
      console.log('🔄 Running manual sync...');
      await supabaseSyncService.syncAllData(account, {
        forceRefresh: true,
        onProgress: (progress) => {
          console.log('Sync progress:', progress);
        }
      });
      
      // 3. Check table counts after sync
      const agencyPlayersAfter = await supabaseDataService.getAgencyPlayers(account);
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
        .eq('wallet_address', account)
        .limit(5);
      
      console.log('Agency players table sample:', agencyPlayersData);
      if (agencyPlayersError) console.error('Agency players table error:', agencyPlayersError);
      
      setResults({
        before: agencyPlayers.length,
        after: agencyPlayersAfter.length,
        playersTableSample: playersData,
        playersTableError: playersError,
        agencyPlayersTableSample: agencyPlayersData,
        agencyPlayersTableError: agencyPlayersError
      });
      
    } catch (error) {
      console.error('Debug test failed:', error);
      setResults({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isConnected || !account) {
    return (
      <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h2 className="text-lg font-semibold text-yellow-800">Sync Debug Test</h2>
        <p className="text-yellow-700">Please connect your wallet to run the debug test.</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
        Sync Debug Test
      </h2>
      
      <div className="mb-4">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
          Wallet: {account}
        </p>
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
        </div>
      )}
    </div>
  );
}
