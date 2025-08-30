'use client';

import React, { useState, useEffect } from 'react';
import { fetchPlayerSaleHistory } from '../services/playerSaleHistoryService';
import { fetchPlayerExperienceHistory } from '../services/playerExperienceService';
import { calculatePlayerStatsAtSale } from '../utils/saleHistoryCalculator';
import type { PlayerSaleHistoryEntry } from '../types/playerSaleHistory';
import type { ProgressionDataPoint } from '../types/playerExperience';

interface PlayerSaleHistoryProps {
  playerId: string;
  playerName: string;
}

export default function PlayerSaleHistory({ playerId, playerName }: PlayerSaleHistoryProps) {
  const [saleHistory, setSaleHistory] = useState<PlayerSaleHistoryEntry[]>([]);
  const [progressionData, setProgressionData] = useState<ProgressionDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllSales, setShowAllSales] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch both sale history and progression data
        const [historyResponse, progressionResponse] = await Promise.all([
          fetchPlayerSaleHistory(playerId),
          fetchPlayerExperienceHistory(playerId)
        ]);
        
        if (historyResponse.success && historyResponse.data.length > 0) {
          setSaleHistory(historyResponse.data);
        } else {
          setError(historyResponse.error || 'No sale history available');
        }

        if (progressionResponse.success && progressionResponse.data.length > 0) {
          setProgressionData(progressionResponse.data);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load sale history');
      } finally {
        setIsLoading(false);
      }
    };

    if (playerId) {
      loadData();
    }
  }, [playerId]);

  // Loading state
  if (isLoading) {
    return (
      <div className="w-full p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="w-full p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-center h-48">
          <div className="text-center text-gray-500 dark:text-gray-400">
            <p className="text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // No data state
  if (saleHistory.length === 0) {
    return (
      <div className="w-full p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Sale History</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">No transactions</p>
        </div>
        <div className="flex items-center justify-center h-48">
          <div className="text-center text-gray-500 dark:text-gray-400">
            <p className="text-sm">No sale history available</p>
          </div>
        </div>
      </div>
    );
  }

  // Show only first 5 sales initially, or all if showAllSales is true
  const displayedSales = showAllSales ? saleHistory : saleHistory.slice(0, 5);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const formattedDate = date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    
    // If older than 365 days, show in years
    if (diffDays > 365) {
      const diffYears = Math.floor(diffDays / 365);
      return `${formattedDate} (${diffYears} year${diffYears > 1 ? 's' : ''} ago)`;
    }
    
    return `${formattedDate} (${diffDays} days ago)`;
  };

  const formatPrice = (price: number) => {
    return price.toLocaleString();
  };

  return (
    <div className="w-full p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Sale History</h3>
        <p className="text-base text-gray-500 dark:text-gray-400">{saleHistory.length} transactions</p>
      </div>
      
      <div className="space-y-3">
        {displayedSales.map((sale, index) => (
          <div 
            key={sale.id} 
            className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
          >
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1">
                                                 <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {sale.sellerName}
                  </span>
                  <span className="text-gray-400">→</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {sale.buyerName}
                  </span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {formatDate(sale.purchaseDateTime)}
                </p>
              </div>
                            <div className="text-right">
                <span className="text-lg font-bold text-green-600">
                  ${formatPrice(sale.price)}
                </span>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {(() => {
                    const historicalStats = calculatePlayerStatsAtSale(sale.purchaseDateTime, progressionData);
                    if (historicalStats) {
                      return `Overall: ${historicalStats.overall} (Age: ${historicalStats.age})`;
                    } else {
                      return `Overall: ${sale.player.metadata.overall}`;
                    }
                  })()}
                </p>
              </div>
            </div>
            

          </div>
        ))}
      </div>
      
      {/* Show More/Less Button */}
      {saleHistory.length > 5 && (
        <div className="text-center mt-4">
          <button
            onClick={() => setShowAllSales(!showAllSales)}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-white transition-all duration-200 font-medium text-sm cursor-pointer"
          >
            {showAllSales 
              ? `Show Less Sales` 
              : `Show ${saleHistory.length - 5} More Sales`
            }
          </button>
        </div>
      )}
    </div>
  );
}
