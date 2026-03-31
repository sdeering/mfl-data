'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '../contexts/WalletContext';
// Uses /api/data/db-stats endpoint instead of direct database access

export default function DatabaseStatusChecker() {
  const { isConnected, account } = useWallet();
  const [status, setStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkDatabaseStatus = async () => {
    if (!account) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('Checking database status for wallet:', account);
      
      // Check database status via API
      const res = await fetch(`/api/data/db-stats?walletAddress=${encodeURIComponent(account)}`);
      if (!res.ok) throw new Error('Failed to fetch database status');
      const dbStats = await res.json();

      const statusData = {
        walletAddress: account,
        timestamp: new Date().toISOString(),
        tables: {
          users: {
            count: dbStats.tables?.users?.count || 0,
            data: dbStats.tables?.users?.sample?.[0] || null,
            error: dbStats.tables?.users?.error || null
          },
          agencyPlayers: {
            count: dbStats.tables?.agency_players?.count || 0,
            sampleData: dbStats.tables?.agency_players?.sample || [],
            error: dbStats.tables?.agency_players?.error || null
          },
          players: {
            count: dbStats.tables?.players?.count || 0,
            sampleData: dbStats.tables?.players?.sample || [],
            error: dbStats.tables?.players?.error || null
          },
          clubs: {
            count: dbStats.tables?.clubs?.count || 0,
            sampleData: dbStats.tables?.clubs?.sample || [],
            error: dbStats.tables?.clubs?.error || null
          },
          matches: {
            count: dbStats.tables?.matches?.count || 0,
            sampleData: dbStats.tables?.matches?.sample || [],
            error: dbStats.tables?.matches?.error || null
          },
          syncStatus: {
            count: dbStats.tables?.sync_status?.count || 0,
            data: dbStats.tables?.sync_status?.sample || [],
            error: dbStats.tables?.sync_status?.error || null
          }
        }
      };

      console.log('Database status:', statusData);
      setStatus(statusData);
    } catch (error: any) {
      console.error('Error checking database status:', error);
      setError(error.message || 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected && account) {
      checkDatabaseStatus();
    }
  }, [isConnected, account]);

  if (!isConnected) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Database Status Checker</h1>
        <p>Please connect your wallet to check database status.</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Database Status Checker</h1>
      <p className="mb-4">Wallet: {account}</p>
      
      <div className="mb-4">
        <button
          onClick={checkDatabaseStatus}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? 'Checking...' : 'Refresh Status'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          <strong>Error:</strong> {error}
        </div>
      )}

      {status && (
        <div className="space-y-6">
          <div className="bg-gray-100 p-4 rounded">
            <h2 className="text-lg font-semibold mb-2">Table Counts</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{status.tables.users.count}</div>
                <div className="text-sm text-gray-600">Users</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{status.tables.agencyPlayers.count}</div>
                <div className="text-sm text-gray-600">Agency Players</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{status.tables.players.count}</div>
                <div className="text-sm text-gray-600">Players</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{status.tables.clubs.count}</div>
                <div className="text-sm text-gray-600">Clubs</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{status.tables.matches.count}</div>
                <div className="text-sm text-gray-600">Matches</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-indigo-600">{status.tables.syncStatus.count}</div>
                <div className="text-sm text-gray-600">Sync Status</div>
              </div>
            </div>
          </div>

          {status.tables.syncStatus.data.length > 0 && (
            <div className="bg-gray-100 p-4 rounded">
              <h2 className="text-lg font-semibold mb-2">Sync Status</h2>
              <div className="space-y-2">
                {status.tables.syncStatus.data.map((item: any, index: number) => (
                  <div key={index} className="flex justify-between items-center p-2 bg-white rounded">
                    <span className="font-medium">{item.data_type}</span>
                    <span className={`px-2 py-1 rounded text-sm ${
                      item.status === 'completed' ? 'bg-green-100 text-green-800' :
                      item.status === 'failed' ? 'bg-red-100 text-red-800' :
                      item.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {item.status} ({item.progress_percentage}%)
                    </span>
                    <span className="text-sm text-gray-600">
                      {item.last_synced ? new Date(item.last_synced).toLocaleString() : 'Never'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {status.tables.agencyPlayers.count > 0 && (
            <div className="bg-gray-100 p-4 rounded">
              <h2 className="text-lg font-semibold mb-2">Agency Players Sample</h2>
              <div className="space-y-2">
                {status.tables.agencyPlayers.sampleData.map((player: any, index: number) => (
                  <div key={index} className="p-2 bg-white rounded">
                    <div className="font-medium">Player ID: {player.mfl_player_id}</div>
                    <div className="text-sm text-gray-600">
                      Name: {player.data?.name || 'N/A'}
                    </div>
                    <div className="text-sm text-gray-600">
                      Last Synced: {new Date(player.last_synced).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-gray-100 p-4 rounded">
            <h2 className="text-lg font-semibold mb-2">Raw Data</h2>
            <pre className="text-xs overflow-auto max-h-96 bg-black text-green-400 p-4 rounded">
              {JSON.stringify(status, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

