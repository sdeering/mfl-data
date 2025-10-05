'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { supabaseDataService } from '../services/supabaseDataService';

export default function AgencyPageDebug() {
  const { isConnected, account } = useWallet();
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDebugInfo = async () => {
    if (!account) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('Fetching agency players for wallet:', account);
      const agencyPlayers = await supabaseDataService.getAgencyPlayers(account);
      console.log('Agency players result:', agencyPlayers);
      
      setDebugInfo({
        walletAddress: account,
        agencyPlayersCount: agencyPlayers.length,
        agencyPlayers: agencyPlayers.slice(0, 3), // Show first 3 for debugging
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('Error fetching agency players:', error);
      setError(error.message || 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected && account) {
      fetchDebugInfo();
    }
  }, [isConnected, account]);

  if (!isConnected) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Agency Page Debug</h1>
        <p>Please connect your wallet to debug the agency page.</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Agency Page Debug</h1>
      
      <div className="mb-4">
        <button
          onClick={fetchDebugInfo}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? 'Loading...' : 'Refresh Debug Info'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          <strong>Error:</strong> {error}
        </div>
      )}

      {debugInfo && (
        <div className="bg-gray-100 p-4 rounded">
          <h2 className="text-lg font-semibold mb-2">Debug Information</h2>
          <pre className="text-sm overflow-auto">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

