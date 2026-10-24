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
import { Panel, btnSecondary } from './ui';

interface PlayerSaleHistoryProps {
  playerId: string;
  playerName: string;
  playerMetadata: MFLPlayerMetadata;
  marketValueEstimate?: MarketValueEstimate | null;
}

const gainClass = 'font-semibold text-green-600 dark:text-green-400';
const lossClass = 'font-semibold text-danger-ink';

const CONFIDENCE_TEXT: Record<string, string> = {
  high: 'text-green-600 dark:text-green-400',
  medium: 'text-warn-ink',
  low: 'text-danger-ink',
};

const BreakdownRow: React.FC<{ label: string; children: React.ReactNode; valueClassName?: string }> = ({ label, children, valueClassName = 'font-semibold text-fg' }) => (
  <div className="flex justify-between gap-3">
    <span className="text-muted">{label}</span>
    <span className={valueClassName}>{children}</span>
  </div>
);

// The estimate shown above the sales. Without any sales there is no height adjustment row.
function MarketValueEstimateCard({ estimate, showHeightAdjustment }: { estimate: MarketValueEstimate; showHeightAdjustment: boolean }) {
  const { breakdown } = estimate;
  return (
    <div className="p-4 rounded-2xl border border-line bg-inset">
      <h4 className="m-0 mb-3 font-display text-lg font-bold text-center text-fg">
        Market Value Estimate
      </h4>

      {/* Main Estimate - Centered */}
      <div className="text-center mb-4">
        <div className="font-display text-[34px] font-extrabold leading-none tracking-[-0.02em] tabular-nums text-accent-ink">
          ${estimate.estimatedValue.toLocaleString()}
        </div>
        <div className="text-sm text-muted mt-2">
          Confidence:
          <span className={`ml-1 font-semibold ${CONFIDENCE_TEXT[estimate.confidence] ?? CONFIDENCE_TEXT.low}`}>
            {estimate.confidence.charAt(0).toUpperCase() + estimate.confidence.slice(1)}
          </span>
        </div>
      </div>

      {/* Breakdown - New Row */}
      <div className="text-sm space-y-1 max-w-md mx-auto">
        <BreakdownRow label="Base value:">${estimate.details.baseValue.toLocaleString()}</BreakdownRow>
        {breakdown.positionPremium > 0 && (
          <BreakdownRow label="Positions premium:" valueClassName={gainClass}>+${breakdown.positionPremium.toLocaleString()}</BreakdownRow>
        )}
        {breakdown.progressionPremium !== 0 && (
          <BreakdownRow
            label={`${breakdown.progressionPremium > 0 ? 'Progression premium' : 'Progression penalty'}:`}
            valueClassName={breakdown.progressionPremium > 0 ? gainClass : lossClass}
          >
            {breakdown.progressionPremium > 0 ? '+' : '-'}${Math.abs(breakdown.progressionPremium).toLocaleString()}
          </BreakdownRow>
        )}
        {breakdown.retirementPenalty !== 0 && (
          <BreakdownRow label="Retirement penalty:" valueClassName={lossClass}>-${Math.abs(breakdown.retirementPenalty).toLocaleString()}</BreakdownRow>
        )}
        {breakdown.newlyMintPremium > 0 && (
          <BreakdownRow label="Newly mint premium:" valueClassName={gainClass}>+${breakdown.newlyMintPremium.toLocaleString()}</BreakdownRow>
        )}
        {breakdown.pacePenalty !== 0 && (
          <BreakdownRow label="Pace penalty:" valueClassName={lossClass}>-${Math.abs(breakdown.pacePenalty).toLocaleString()}</BreakdownRow>
        )}
        {breakdown.pacePremium > 0 && (
          <BreakdownRow label="Pace premium:" valueClassName={gainClass}>+${breakdown.pacePremium.toLocaleString()}</BreakdownRow>
        )}
        {showHeightAdjustment && breakdown.heightAdjustment !== 0 && (
          <BreakdownRow
            label={`${breakdown.heightAdjustment > 0 ? 'Height premium' : 'Height penalty'}:`}
            valueClassName={breakdown.heightAdjustment > 0 ? gainClass : lossClass}
          >
            {breakdown.heightAdjustment > 0 ? '+' : '-'}${Math.abs(breakdown.heightAdjustment).toLocaleString()}
          </BreakdownRow>
        )}
      </div>

      {/* Data Sources */}
      <div className="mt-4 pt-3 border-t border-divider">
        <div className="text-xs text-muted space-y-1">
          <div>Based on {breakdown.comparableListings} comparable listings and {breakdown.recentSales} recent sales</div>
          <div className="italic text-muted-3">* this is just an estimate, please do your own research *</div>
        </div>
      </div>
    </div>
  );
}

export default function PlayerSaleHistory({ playerId, playerName, playerMetadata, marketValueEstimate: propMarketValueEstimate }: PlayerSaleHistoryProps) {
  const [saleHistory, setSaleHistory] = useState<PlayerSaleHistoryEntry[]>([]);
  const [progressionData, setProgressionData] = useState<ProgressionDataPoint[]>([]);
  const [marketValueEstimate, setMarketValueEstimate] = useState<MarketValueEstimate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllSales, setShowAllSales] = useState(false);

  // Update market value estimate when prop changes
  useEffect(() => {
    if (propMarketValueEstimate) {
      console.log('📊 PlayerSaleHistory: Updating market value estimate from props:', propMarketValueEstimate.estimatedValue);
      setMarketValueEstimate(propMarketValueEstimate);
    }
  }, [propMarketValueEstimate]);

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
      } catch (err) {
        setError('Failed to load sale history');
      } finally {
        setIsLoading(false);
      }
    };

    if (playerId) {
      loadData();
    }
  }, [playerId, playerMetadata]);

  // Loading state
  if (isLoading) {
    return (
      <Panel className="w-full p-[18px]">
        <div className="flex items-center justify-center h-48">
          <div data-testid="loading-spinner" className="animate-spin rounded-full h-6 w-6 border-2 border-accent border-t-transparent"></div>
        </div>
      </Panel>
    );
  }

  // Error state - only show for actual errors, not for no sale history
  if (error && error !== 'No sale history available') {
    return (
      <Panel className="w-full p-[18px]">
        <div className="flex items-center justify-center h-48">
          <div className="text-center text-muted">
            <p className="m-0 text-sm">{error}</p>
          </div>
        </div>
      </Panel>
    );
  }

  // No data state
  if (saleHistory.length === 0) {
    return (
      <Panel className="w-full">
        {/* Market Value Estimate - At the top */}
        {marketValueEstimate && (
          <div className="px-[18px] pt-[18px]">
            <MarketValueEstimateCard estimate={marketValueEstimate} showHeightAdjustment={false} />
          </div>
        )}

        <div className="px-[18px] py-4">
          <h3 className="m-0 font-display text-lg font-bold">Sale History</h3>
          <p className="m-0 mt-0.5 text-sm text-muted">No transactions</p>
        </div>
        <div className="flex items-center justify-center h-32 border-t border-line">
          <div className="text-center text-muted">
            <p className="m-0 text-sm">No sale history available</p>
          </div>
        </div>
      </Panel>
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
    <Panel className="w-full overflow-hidden">
      {/* Market Value Estimate - At the top */}
      {marketValueEstimate && (
        <div className="px-[18px] pt-[18px]">
          <MarketValueEstimateCard estimate={marketValueEstimate} showHeightAdjustment />
        </div>
      )}

      <div className="px-[18px] py-4">
        <h3 className="m-0 font-display text-lg font-bold">Sale History</h3>
        <p className="m-0 mt-0.5 text-sm text-muted">{saleHistory.length} transactions</p>
      </div>

      <div className="border-t border-line">
        {displayedSales.map((sale) => (
          <div
            key={sale.id}
            className="flex justify-between items-start gap-3 px-[18px] py-3 border-b border-divider last:border-b-0 hover:bg-row-hover transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 text-sm font-semibold text-fg">
                <span>
                  {sale.sellerName || (sale.sellerAddress ? `${sale.sellerAddress.slice(0, 8)}...${sale.sellerAddress.slice(-6)}` : 'Unknown')}
                </span>
                <span className="text-muted-3">→</span>
                <span>
                  {sale.buyerName || (sale.buyerAddress ? `${sale.buyerAddress.slice(0, 8)}...${sale.buyerAddress.slice(-6)}` : 'Unknown')}
                </span>
              </div>
              <p className="m-0 mt-1 text-[13px] text-muted">
                {formatDate(sale.purchaseDateTime)}
              </p>
            </div>
            <div className="text-right">
              <span className="font-display text-lg font-extrabold tabular-nums text-accent-ink">
                ${formatPrice(sale.price)}
              </span>
              <p className="m-0 mt-0.5 text-xs font-medium text-fg-3">
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
        ))}
      </div>

      {/* Show More/Less Button */}
      {saleHistory.length > 5 && (
        <div className="flex justify-center px-[18px] py-4 border-t border-divider">
          <button
            onClick={() => setShowAllSales(!showAllSales)}
            className={btnSecondary}
          >
            {showAllSales
              ? `Show Less Sales`
              : `Show ${saleHistory.length - 5} More Sales`
            }
          </button>
        </div>
      )}
    </Panel>
  );
}
