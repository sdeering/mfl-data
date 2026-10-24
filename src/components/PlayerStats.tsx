import React from 'react';
import { formatHeight } from '@/src/utils/heightConverter';
import { getCountryFlag, formatCountryName } from '@/src/utils/countryFlags';
import type { MFLPlayer } from '@/src/types/mflApi';
import type { MarketValueEstimate } from '@/src/utils/marketValueCalculator';

const valueClass = 'text-[15px] font-bold text-fg';
const linkValueClass = `${valueClass} hover:text-accent-ink transition-colors cursor-pointer`;
const pillClass = 'inline-flex items-center whitespace-nowrap leading-tight rounded-full font-bold';

const TAG_CLASSES: Record<string, string> = {
  slow: 'bg-[rgba(249,115,22,.16)] text-orange-ink',
  retirement: 'bg-[rgba(249,115,22,.16)] text-orange-ink',
  fast: 'bg-[rgba(138,230,58,.14)] text-pos-ink',
  lightningFast: 'bg-[rgba(138,230,58,.14)] text-pos-ink',
  positions: 'bg-[rgba(138,230,58,.14)] text-pos-ink',
  newlyMinted: 'bg-violet-bg text-violet-ink',
};

const CONFIDENCE_CLASSES: Record<string, string> = {
  high: 'bg-[rgba(138,230,58,.14)] text-pos-ink',
  medium: 'bg-[rgba(255,190,90,.14)] text-warn-ink',
  low: 'bg-red-500/18 text-danger-ink',
};

interface PlayerStatsProps {
  player: MFLPlayer;
  marketValueEstimate?: MarketValueEstimate | null;
  progressionData?: any[] | null;
  matchCount?: number;
  isCalculatingMarketValue?: boolean;
  // Set when showing the player as minted: agency, team and market value are swapped
  // for the mint date, since only the current ones are known
  mintedOn?: string;
}

export default function PlayerStats({ player, marketValueEstimate, progressionData, matchCount, isCalculatingMarketValue, mintedOn }: PlayerStatsProps) {
  const {
    metadata: {
      overall,
      age,
      height,
      nationalities,
      preferredFoot,
      positions
    }
  } = player;



  // Generate tags based on player data
  const generateTags = () => {
    const tags = [];
    
    // Pace-based tags
    if (player.metadata.pace) {
      if (player.metadata.pace < 55) {
        tags.push({
          text: '🐢 Slow',
          type: 'slow'
        });
      } else if (player.metadata.pace >= 95) {
        tags.push({
          text: '⚡ Lightning Fast',
          type: 'lightningFast'
        });
      } else if (player.metadata.pace > 90) {
        tags.push({
          text: 'Fast',
          type: 'fast'
        });
      }
    }
    
    // Retirement tag
    if (player.metadata.retirementYears && player.metadata.retirementYears > 0) {
      tags.push({
        text: `Retirement in ${player.metadata.retirementYears} year${player.metadata.retirementYears > 1 ? 's' : ''}`,
        type: 'retirement'
      });
    }
    
    // Multiple positions tag (check if player has multiple playable positions)
    if (marketValueEstimate?.breakdown?.positionPremium && marketValueEstimate.breakdown.positionPremium > 0) {
      tags.push({
        text: 'Multiple positions',
        type: 'positions',
        icon: (
          <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18 4l-4 4h3v6h-3l4 4 4-4h-3V8h3l-4-4zM6 8H3l4-4 4 4H8v6h3l-4 4-4-4h3V8z"/>
          </svg>
        )
      });
    }
    
    // Single owner tag (check if player has no sales history)
    // Suppress if Newly minted is present (implied)
    const willAddNewlyMinted = (() => {
      if (!(progressionData && matchCount !== undefined && matchCount < 10)) return false;
      const hasProgression = progressionData.some((entry: any, index: number) => {
        if (index === 0) return false;
        const currentEntry = entry;
        const previousEntry = progressionData[index - 1];
        return (
          currentEntry.pace > previousEntry.pace ||
          currentEntry.shooting > previousEntry.shooting ||
          currentEntry.passing > previousEntry.passing ||
          currentEntry.dribbling > previousEntry.dribbling ||
          currentEntry.defending > previousEntry.defending ||
          currentEntry.physical > previousEntry.physical ||
          currentEntry.overall > previousEntry.overall
        );
      });
      return !hasProgression;
    })();

    if (marketValueEstimate?.details?.recentSales?.length === 0 && !willAddNewlyMinted) {
      tags.push({
        text: 'Single owner',
        type: 'singleOwner'
      });
    }
    
    // Newly minted tag
    if (progressionData && matchCount !== undefined && matchCount < 10) {
      // Check if there's no progression on any stats
      const hasProgression = progressionData.some((entry: any, index: number) => {
        if (index === 0) return false; // Skip first entry as there's no previous to compare
        
        const currentEntry = entry;
        const previousEntry = progressionData[index - 1];
        
        // Check if any stat has increased
        return (
          currentEntry.pace > previousEntry.pace ||
          currentEntry.shooting > previousEntry.shooting ||
          currentEntry.passing > previousEntry.passing ||
          currentEntry.dribbling > previousEntry.dribbling ||
          currentEntry.defending > previousEntry.defending ||
          currentEntry.physical > previousEntry.physical ||
          currentEntry.overall > previousEntry.overall
        );
      });
      
      if (!hasProgression) {
        tags.push({
          text: 'Newly minted',
          type: 'newlyMinted'
        });
      }
    }
    
    return tags.length > 0 ? tags : undefined;
  };

  const stats = [
    { label: 'Player ID', value: `#${player.id}` },
    { label: 'Player name', value: `${player.metadata.firstName} ${player.metadata.lastName}` },
    { label: 'Country', value: nationalities?.[0], isCountry: true },
    { label: 'Age', value: age },
    { label: 'Height', value: formatHeight(height), isHeight: true },
    { label: 'Preferred Foot', value: preferredFoot },
    { 
      label: 'Positions', 
      value: positions.join(', '), 
      isPositions: true 
    },
    { label: 'Minted', value: mintedOn, isMintOnly: true },
    { 
      label: 'Agency', 
      value: player.ownedBy.name || (player.ownedBy.walletAddress ? `${player.ownedBy.walletAddress.slice(0, 8)}...${player.ownedBy.walletAddress.slice(-6)}` : undefined), 
      isAgency: true,
      isCurrentOnly: true
    },
    { 
      label: 'Team', 
      value: player.activeContract?.club?.name || (player.activeContract ? 'In development centre' : 'Free Agent'), 
      isTeam: true, 
      teamId: player.activeContract?.club?.id,
      isFreeAgent: !player.activeContract,
      isDevCentre: player.activeContract && !player.activeContract.club?.name,
      isCurrentOnly: true
    },
    {
      label: 'Market Value Est',
      value: isCalculatingMarketValue ? 'Calculating...' : (marketValueEstimate ? 
        (marketValueEstimate.estimatedValue === 0 ? 'Unknown' : `$${marketValueEstimate.estimatedValue.toLocaleString()}`) 
        : undefined),
      isMarketValue: true,
      confidence: marketValueEstimate?.estimatedValue === 0 ? undefined : marketValueEstimate?.confidence,
      breakdown: marketValueEstimate?.breakdown,
      details: marketValueEstimate?.details,
      isCalculating: isCalculatingMarketValue,
      isCurrentOnly: true
    },
    {
      label: 'Tags',
      value: generateTags(),
      isTags: true
    }
  ].filter(stat => (mintedOn ? !stat.isCurrentOnly : !stat.isMintOnly));



  return (
    <div>
        {stats.map((stat, index) => (
          <div key={index} className="flex items-center justify-between gap-3 min-h-[46px] py-2 border-b border-divider last:border-b-0">
            <span className="text-[13px] font-semibold text-muted">{stat.label}</span>
            <div className="flex flex-wrap items-center justify-end gap-1.5 min-w-0 text-right">
              {stat.value !== undefined && stat.value !== null ? (
                <>
                  {stat.isCountry ? (
                    <span className={`${valueClass} flex items-center gap-2`}>
                      <span className="text-lg leading-none">{getCountryFlag(stat.value as string)}</span>
                      {formatCountryName(stat.value as string)}
                    </span>
                  ) : stat.isAgency ? (
                    <a
                      href={`https://app.playmfl.com/users/${player.ownedBy.walletAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={linkValueClass}
                    >
                      {stat.value}
                    </a>
                  ) : stat.isTeam ? (
                    stat.teamId && !stat.isFreeAgent && !stat.isDevCentre ? (
                      <a
                        href={`https://app.playmfl.com/clubs/${stat.teamId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={linkValueClass}
                      >
                        {stat.value}
                      </a>
                    ) : (
                      <span className={valueClass}>{stat.value}</span>
                    )
                  ) : stat.isMarketValue ? (
                    <div className="flex items-center gap-1.5">
                      {stat.isCalculating ? (
                        <div className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-accent border-t-transparent"></div>
                          <span className={valueClass}>Calculating...</span>
                        </div>
                      ) : (
                        <>
                          <span className={valueClass}>
                            {stat.value}
                          </span>
                          {stat.confidence && (
                            <span className={`${pillClass} px-2.5 py-[3px] text-[11px] ${CONFIDENCE_CLASSES[stat.confidence] ?? CONFIDENCE_CLASSES.low}`}>
                              {stat.confidence}
                            </span>
                          )}
                        </>
                      )}
                      {stat.breakdown && !stat.isCalculating && (
                        <div className="relative group flex">
                          <svg className="w-4 h-4 text-muted-3 hover:text-fg-2 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                          </svg>
                          {/* Tooltip */}
                          <div className="absolute bottom-full right-0 mb-2 px-3.5 py-3 rounded-xl border border-line-2 bg-panel text-left text-xs font-medium text-fg-3 shadow-[0_20px_50px_rgba(0,0,0,.45)] opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                            <div className="font-display text-sm font-bold text-fg mb-1.5">Market Value Estimate</div>
                            <div className="space-y-1">
                              <div>Base value: ${stat.details?.baseValue?.toLocaleString()}</div>

                              {stat.breakdown.positionPremium > 0 && (
                                <div>Positions premium: +${stat.breakdown.positionPremium.toLocaleString()}</div>
                              )}

                              {stat.breakdown.progressionPremium !== 0 && (
                                <div>{stat.breakdown.progressionPremium > 0 ? 'Progression premium' : 'Progression penalty'}: {stat.breakdown.progressionPremium > 0 ? '+' : '-'}${Math.abs(stat.breakdown.progressionPremium).toLocaleString()}</div>
                              )}
                              {stat.breakdown.retirementPenalty !== 0 && (
                                <div>Retirement penalty: -${Math.abs(stat.breakdown.retirementPenalty).toLocaleString()}</div>
                              )}
                              {stat.breakdown.newlyMintPremium > 0 && (
                                <div>Newly mint premium: +${stat.breakdown.newlyMintPremium.toLocaleString()}</div>
                              )}
                              {stat.breakdown.pacePenalty !== 0 && (
                                <div>Pace penalty: -${Math.abs(stat.breakdown.pacePenalty).toLocaleString()}</div>
                              )}
                              {stat.breakdown.pacePremium > 0 && (
                                <div>Pace premium: +${stat.breakdown.pacePremium.toLocaleString()}</div>
                              )}
                              {stat.breakdown.heightAdjustment !== 0 && (
                                <div>{stat.breakdown.heightAdjustment > 0 ? 'Height premium' : 'Height penalty'}: {stat.breakdown.heightAdjustment > 0 ? '+' : '-'}${Math.abs(stat.breakdown.heightAdjustment).toLocaleString()}</div>
                              )}
                            </div>
                            <div className="border-t border-divider pt-1.5 mt-1.5 space-y-1 text-muted">
                              <div>Based on {stat.breakdown.comparableListings} comparable listings and {stat.breakdown.recentSales} recent sales</div>
                              <div>Confidence: {stat.confidence}</div>
                              <div className="italic text-muted-3">* this is just an estimate, please do your own research *</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : stat.isTags ? (
                    stat.value && stat.value.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 items-center justify-end">
                        {stat.value.map((tag: any, index: number) => (
                          <span
                            key={index}
                            className={`${pillClass} px-3 py-1.5 text-xs ${TAG_CLASSES[tag.type] ?? 'bg-chip text-fg-3'}`}
                          >
                            {tag.icon && tag.icon}
                            <span>{tag.text}</span>
                          </span>
                        ))}
                      </div>
                    ) : null
                  ) : (
                    <span className={valueClass}>
                      {Array.isArray(stat.value) ? null : stat.value}
                    </span>
                  )}

                </>
              ) : stat.isTags ? (
                // Don't show anything for empty tags
                null
              ) : (
                <span className="text-[13px] font-medium text-faint">Not available</span>
              )}
            </div>
          </div>
        ))}
    </div>
  );
};
