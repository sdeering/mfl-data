'use client';

import { useState, useEffect } from 'react';
import { supabase, TABLES } from '../lib/supabase';

interface TableStats {
  tableName: string;
  count: number;
  lastSynced: string | null;
}

export default function DatabaseViewer() {
  const [tableStats, setTableStats] = useState<TableStats[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTableStats = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const tables = [
        TABLES.USERS,
        TABLES.CLUBS,
        TABLES.AGENCY_PLAYERS,
        TABLES.PLAYERS,
        TABLES.MATCHES,
        TABLES.SYNC_STATUS
      ];

      const statsPromises = tables.map(async (table) => {
        try {
          // Get count
          const { count, error: countError } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true });

          if (countError) throw countError;

          // Get last synced
          const { data: lastSyncedData, error: lastSyncedError } = await supabase
            .from(table)
            .select('last_synced')
            .order('last_synced', { ascending: false })
            .limit(1)
            .single();

          return {
            tableName: table,
            count: count || 0,
            lastSynced: lastSyncedData?.last_synced || null
          };
        } catch (error) {
          console.warn(`Error fetching stats for ${table}:`, error);
          return {
            tableName: table,
            count: 0,
            lastSynced: null
          };
        }
      });

      const stats = await Promise.all(statsPromises);
      setTableStats(stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTableStats();
  }, []);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Database Tables Status
        </h2>
        <button
          onClick={fetchTableStats}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-2 px-3 font-medium text-gray-900 dark:text-white">
                Table
              </th>
              <th className="text-left py-2 px-3 font-medium text-gray-900 dark:text-white">
                Records
              </th>
              <th className="text-left py-2 px-3 font-medium text-gray-900 dark:text-white">
                Last Synced
              </th>
            </tr>
          </thead>
          <tbody>
            {tableStats.map((stat) => (
              <tr key={stat.tableName} className="border-b border-gray-100 dark:border-gray-700">
                <td className="py-2 px-3 text-gray-900 dark:text-white font-mono text-xs">
                  {stat.tableName}
                </td>
                <td className="py-2 px-3 text-gray-900 dark:text-white">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    stat.count > 0 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                  }`}>
                    {stat.count}
                  </span>
                </td>
                <td className="py-2 px-3 text-gray-600 dark:text-gray-400 text-xs">
                  {formatDate(stat.lastSynced)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-blue-800 dark:text-blue-200 text-sm">
          <strong>Note:</strong> The Players table should be populated with agency players during sync. 
          If it's empty, the sync may not be working correctly.
        </p>
      </div>
    </div>
  );
}

