'use client';

import React, { useState, useEffect } from 'react';
import { fetchPlayerSaleHistory } from '../services/playerSaleHistoryService';
import { fetchPlayerExperienceHistory, processProgressionData } from '../services/playerExperienceService';
import { calculatePlayerStatsAtSale } from '../utils/saleHistoryCalculator';
import { fetchMarketData } from '../services/marketDataService';
import { calculateMarketValue } from '../utils/marketValueCalculator';
import type { PlayerSaleHistoryEntry } from '../types/playerSaleHistory';
import type { ProgressionDataPoint } from '../types/playerExperience';
import type { MarketValueEstimate } from '../utils/marketValueCalculator';
import type { MFLPlayerMetadata } from '../types/mflApi';

interface PlayerSaleHistoryProps {
  playerId: string;
  playerName: string;
  playerMetadata: MFLPlayerMetadata;
  marketValueEstimate?: MarketValueEstimate | null;
}

export default function PlayerSaleHistory({ playerId, playerName, playerMetadata, marketValueEstimate: propMarketValueEstimate }: PlayerSaleHistoryProps) {
  const [saleHistory, setSaleHistory] = useState<PlayerSaleHistoryEntry[]>([]);
  const [progressionData, setProgressionData] = useState<ProgressionDataPoint[]>([]);
  const [marketValueEstimate, setMarketValueEstimate] = useState<MarketValueEstimate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllSales, setShowAllSales] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch sale history, progression data, and market data
        const [historyResponse, progressionResponse, marketResponse] = await Promise.all([
          fetchPlayerSaleHistory(playerId),
          fetchPlayerExperienceHistory(playerId),
          fetchMarketData({
            positions: playerMetadata.positions,
            ageMin: Math.max(1, playerMetadata.age - 1),
            ageMax: playerMetadata.age + 1,
            overallMin: Math.max(1, playerMetadata.overall - 1),
            overallMax: playerMetadata.overall + 1,
            limit: 50
          })
        ]);
        
        if (historyResponse.success && historyResponse.data.length > 0) {
          setSaleHistory(historyResponse.data);
        } else {
          // Don't set error for no sale history - this is normal
          setSaleHistory([]);
        }

        if (progressionResponse.success && progressionResponse.data.length > 0) {
          const processedData = processProgressionData(progressionResponse.data);
          setProgressionData(processedData);
        }

        // Use the market value estimate from props (calculated with position ratings)
        if (propMarketValueEstimate) {
          setMarketValueEstimate(propMarketValueEstimate);
        }
      } catch (err) {
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

  // Error state - only show for actual errors, not for no sale history
  if (error && error !== 'No sale history available') {
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
        {/* Market Value Estimate - At the top */}
        {marketValueEstimate && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <h4 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3 text-center">
              Market Value Estimate
            </h4>
            
            {/* Main Estimate - Centered */}
            <div className="text-center mb-4">
              <div className="text-3xl font-bold" style={{ color: '#00a63e' }}>
                ${marketValueEstimate.estimatedValue.toLocaleString()}
              </div>
              <div className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                Confidence: 
                <span className={`ml-1 font-medium ${
                  marketValueEstimate.confidence === 'high' ? 'text-green-600 dark:text-green-400' :
                  marketValueEstimate.confidence === 'medium' ? 'text-yellow-600 dark:text-yellow-400' :
                  'text-red-600 dark:text-red-400'
                }`}>
                  {marketValueEstimate.confidence.charAt(0).toUpperCase() + marketValueEstimate.confidence.slice(1)}
                </span>
              </div>
            </div>

            {/* Breakdown - New Row */}
            <div className="text-sm space-y-1 max-w-md mx-auto">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Base value:</span>
                <span className="font-medium">${marketValueEstimate.details.baseValue.toLocaleString()}</span>
              </div>
              

              {marketValueEstimate.breakdown.positionPremium > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Positions premium:</span>
                  <span className="font-medium text-green-600">+${marketValueEstimate.breakdown.positionPremium.toLocaleString()}</span>
                </div>
              )}
              {marketValueEstimate.breakdown.singleOwnerPremium > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Single owner premium:</span>
                  <span className="font-medium text-green-600">+${marketValueEstimate.breakdown.singleOwnerPremium.toLocaleString()}</span>
                </div>
              )}
              {marketValueEstimate.breakdown.progressionPremium !== 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">{marketValueEstimate.breakdown.progressionPremium > 0 ? 'Progression premium' : 'Progression penalty'}:</span>
                  <span className={`font-medium ${marketValueEstimate.breakdown.progressionPremium > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {marketValueEstimate.breakdown.progressionPremium > 0 ? '+' : '-'}${Math.abs(marketValueEstimate.breakdown.progressionPremium).toLocaleString()}
                  </span>
                </div>
              )}
              {marketValueEstimate.breakdown.retirementPenalty !== 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Retirement penalty:</span>
                  <span className="font-medium text-red-600">-${Math.abs(marketValueEstimate.breakdown.retirementPenalty).toLocaleString()}</span>
                </div>
              )}
              {marketValueEstimate.breakdown.newlyMintPremium > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Newly mint premium:</span>
                  <span className="font-medium text-green-600">+${marketValueEstimate.breakdown.newlyMintPremium.toLocaleString()}</span>
                </div>
              )}
              {marketValueEstimate.breakdown.pacePenalty !== 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Pace penalty:</span>
                  <span className="font-medium text-red-600">-${Math.abs(marketValueEstimate.breakdown.pacePenalty).toLocaleString()}</span>
                </div>
              )}
              {marketValueEstimate.breakdown.pacePremium > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Pace premium:</span>
                  <span className="font-medium text-green-600">+${marketValueEstimate.breakdown.pacePremium.toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Data Sources */}
            <div className="mt-4 pt-3 border-t border-blue-200 dark:border-blue-800">
              <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                <div>Based on {marketValueEstimate.breakdown.comparableListings} comparable listings and {marketValueEstimate.breakdown.recentSales} recent sales</div>
                <div className="italic text-gray-500 dark:text-gray-400">* this is just an estimate, please do your own research *</div>
              </div>
            </div>
          </div>
        )}

        <div className="mb-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Sale History</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">No transactions</p>
        </div>
        <div className="flex items-center justify-center h-32">
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
      {/* Market Value Estimate - At the top */}
      {marketValueEstimate && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <h4 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3 text-center">
            Market Value Estimate
          </h4>
          
          {/* Main Estimate - Centered */}
          <div className="text-center mb-4">
            <div className="text-3xl font-bold" style={{ color: '#00a63e' }}>
              ${marketValueEstimate.estimatedValue.toLocaleString()}
            </div>
            <div className="text-sm text-blue-700 dark:text-blue-300 mt-1">
              Confidence: 
              <span className={`ml-1 font-medium ${
                marketValueEstimate.confidence === 'high' ? 'text-green-600 dark:text-green-400' :
                marketValueEstimate.confidence === 'medium' ? 'text-yellow-600 dark:text-yellow-400' :
                'text-red-600 dark:text-red-400'
              }`}>
                {marketValueEstimate.confidence.charAt(0).toUpperCase() + marketValueEstimate.confidence.slice(1)}
              </span>
            </div>
          </div>

          {/* Breakdown - New Row */}
          <div className="text-sm space-y-1 max-w-md mx-auto">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Base value:</span>
              <span className="font-medium">${marketValueEstimate.details.baseValue.toLocaleString()}</span>
            </div>


            {marketValueEstimate.breakdown.positionPremium > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Positions premium:</span>
                <span className="font-medium text-green-600">+${marketValueEstimate.breakdown.positionPremium.toLocaleString()}</span>
              </div>
            )}
            {marketValueEstimate.breakdown.singleOwnerPremium > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Single owner premium:</span>
                <span className="font-medium text-green-600">+${marketValueEstimate.breakdown.singleOwnerPremium.toLocaleString()}</span>
              </div>
            )}
            {marketValueEstimate.breakdown.progressionPremium !== 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">{marketValueEstimate.breakdown.progressionPremium > 0 ? 'Progression premium' : 'Progression penalty'}:</span>
                <span className={`font-medium ${marketValueEstimate.breakdown.progressionPremium > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {marketValueEstimate.breakdown.progressionPremium > 0 ? '+' : '-'}${Math.abs(marketValueEstimate.breakdown.progressionPremium).toLocaleString()}
                </span>
              </div>
            )}
            {marketValueEstimate.breakdown.retirementPenalty !== 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Retirement penalty:</span>
                <span className="font-medium text-red-600">-${Math.abs(marketValueEstimate.breakdown.retirementPenalty).toLocaleString()}</span>
              </div>
            )}
            {marketValueEstimate.breakdown.newlyMintPremium > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Newly mint premium:</span>
                <span className="font-medium text-green-600">+${marketValueEstimate.breakdown.newlyMintPremium.toLocaleString()}</span>
              </div>
            )}
            {marketValueEstimate.breakdown.pacePenalty !== 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Pace penalty:</span>
                <span className="font-medium text-red-600">-${Math.abs(marketValueEstimate.breakdown.pacePenalty).toLocaleString()}</span>
              </div>
            )}
            {marketValueEstimate.breakdown.pacePremium > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Pace premium:</span>
                <span className="font-medium text-green-600">+${marketValueEstimate.breakdown.pacePremium.toLocaleString()}</span>
              </div>
            )}
            {marketValueEstimate.breakdown.heightAdjustment !== 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">{marketValueEstimate.breakdown.heightAdjustment > 0 ? 'Height premium' : 'Height penalty'}:</span>
                <span className={`font-medium ${marketValueEstimate.breakdown.heightAdjustment > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {marketValueEstimate.breakdown.heightAdjustment > 0 ? '+' : '-'}${Math.abs(marketValueEstimate.breakdown.heightAdjustment).toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* Data Sources */}
          <div className="mt-4 pt-3 border-t border-blue-200 dark:border-blue-800">
            <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
              <div>Based on {marketValueEstimate.breakdown.comparableListings} comparable listings and {marketValueEstimate.breakdown.recentSales} recent sales</div>
              <div className="italic text-gray-500 dark:text-gray-400">* this is just an estimate, please do your own research *</div>
            </div>
          </div>
        </div>
      )}

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
                    {sale.sellerName || (sale.sellerAddress ? `${sale.sellerAddress.slice(0, 8)}...${sale.sellerAddress.slice(-6)}` : 'Unknown')}
                  </span>
                  <span className="text-gray-400">→</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {sale.buyerName || (sale.buyerAddress ? `${sale.buyerAddress.slice(0, 8)}...${sale.buyerAddress.slice(-6)}` : 'Unknown')}
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
                      return `Overall: ${historicalStats.overall} (Age: ${Math.round(historicalStats.age)})`;
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
