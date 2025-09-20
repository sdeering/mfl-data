import React from 'react';
import { formatHeight } from '@/src/utils/heightConverter';
import { getCountryFlag, formatCountryName } from '@/src/utils/countryFlags';
import type { MFLPlayer } from '@/src/types/mflApi';

// Function to get tier color based on rating value (same as PlayerStatsGrid)
const getTierColor = (rating: number) => {
  if (rating >= 95) {
    return {
      bg: 'bg-[#87f6f8]',
      text: 'text-black',
      border: 'border-[var(--tier-common-foreground)]/15'
    };
  } else if (rating >= 85) {
    return {
      bg: 'bg-[#fa53ff]',
      text: 'text-white',
      border: 'border-[var(--tier-common-foreground)]/15'
    };
  } else if (rating >= 75) {
    return {
      bg: 'bg-[#0047ff]',
      text: 'text-white',
      border: 'border-[var(--tier-common-foreground)]/15'
    };
  } else if (rating >= 65) {
    return {
      bg: 'bg-[#71ff30]',
      text: 'text-black',
      border: 'border-[var(--tier-common-foreground)]/15'
    };
  } else if (rating >= 55) {
    return {
      bg: 'bg-[#ecd17f]',
      text: 'text-black',
      border: 'border-[var(--tier-common-foreground)]/15'
    };
  } else {
    return {
      bg: 'bg-[#9f9f9f]',
      text: 'text-white',
      border: 'border-[var(--tier-common-foreground)]/15'
    };
  }
};

interface PlayerStatsProps {
  player: MFLPlayer;
  marketValueEstimate?: {
    estimatedValue: number;
    confidence: 'high' | 'medium' | 'low';
    breakdown: {
      comparableListings: number;
      recentSales: number;
      ageAdjustment: number;
      overallAdjustment: number;
      positionPremium: number;
      progressionPremium: number;
      retirementPenalty: number;
      newlyMintPremium: number;
      pacePenalty: number;
      pacePremium: number;
      heightAdjustment: number;
      totalAdjustments: number;
    };
    details: {
      comparableListings: any[];
      recentSales: any[];
      comparableAverage: number;
      recentSalesAverage: number;
      baseValue: number;
    };
  } | null;
  progressionData?: any[] | null;
  matchCount?: number;
  isCalculatingMarketValue?: boolean;
}

export default function PlayerStats({ player, marketValueEstimate, progressionData, matchCount, isCalculatingMarketValue }: PlayerStatsProps) {
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
    { 
      label: 'Agency', 
      value: player.ownedBy.name || (player.ownedBy.walletAddress ? `${player.ownedBy.walletAddress.slice(0, 8)}...${player.ownedBy.walletAddress.slice(-6)}` : undefined), 
      isAgency: true 
    },
    { 
      label: 'Team', 
      value: player.activeContract?.club?.name || (player.activeContract ? 'In development centre' : 'Free Agent'), 
      isTeam: true, 
      teamId: player.activeContract?.club?.id,
      isFreeAgent: !player.activeContract,
      isDevCentre: player.activeContract && !player.activeContract.club?.name
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
      isCalculating: isCalculatingMarketValue
    },
    {
      label: 'Tags',
      value: generateTags(),
      isTags: true
    }
  ];



  return (
    <div className="space-y-3">
        {stats.map((stat, index) => (
          <div key={index} className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 tracking-wide">{stat.label}</span>
            <div className="flex items-center space-x-2">
              {stat.value !== undefined && stat.value !== null ? (
                <>
                  {stat.isCountry ? (
                    <span className="text-lg font-bold px-3 py-2 rounded-lg shadow-sm text-gray-900 dark:text-gray-900 bg-gradient-to-r from-white to-gray-100 dark:from-white dark:to-gray-100">
                      <span className="text-xl mr-2">{getCountryFlag(stat.value as string)}</span>
                      {formatCountryName(stat.value as string)}
                    </span>
                  ) : stat.isAgency ? (
                    <a 
                      href={`https://app.playmfl.com/users/${player.ownedBy.walletAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`text-lg font-bold px-3 py-2 rounded-lg shadow-sm text-gray-900 dark:text-gray-900 bg-gradient-to-r from-white to-gray-100 dark:from-white dark:to-gray-100 hover:bg-gray-50 dark:hover:bg-gray-50 transition-colors cursor-pointer`}
                    >
                      {stat.value}
                    </a>
                  ) : stat.isTeam ? (
                    stat.isFreeAgent ? (
                      <span className="text-lg font-bold px-3 py-2 rounded-lg shadow-sm text-gray-900 dark:text-gray-900 bg-gradient-to-r from-white to-gray-100 dark:from-white dark:to-gray-100">
                        {stat.value}
                      </span>
                    ) : stat.isDevCentre ? (
                      <span className="text-lg font-bold px-3 py-2 rounded-lg shadow-sm text-gray-900 dark:text-gray-900 bg-gradient-to-r from-white to-gray-100 dark:from-white dark:to-gray-100">
                        {stat.value}
                      </span>
                    ) : stat.teamId ? (
                      <a 
                        href={`https://app.playmfl.com/clubs/${stat.teamId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-lg font-bold px-3 py-2 rounded-lg shadow-sm text-gray-900 dark:text-gray-900 bg-gradient-to-r from-white to-gray-100 dark:from-white dark:to-gray-100 hover:bg-gray-50 dark:hover:bg-gray-50 transition-colors cursor-pointer"
                      >
                        {stat.value}
                      </a>
                    ) : (
                      <span className="text-lg font-bold px-3 py-2 rounded-lg shadow-sm text-gray-900 dark:text-gray-900 bg-gradient-to-r from-white to-gray-100 dark:from-white dark:to-gray-100">
                        {stat.value}
                      </span>
                    )
                  ) : stat.isMarketValue ? (
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center space-x-1 px-3 py-2 rounded-lg shadow-sm text-gray-900 dark:text-gray-900 bg-gradient-to-r from-white to-gray-100 dark:from-white dark:to-gray-100">
                        {stat.isCalculating ? (
                          <div className="flex items-center space-x-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                            <span className="text-lg font-bold">Calculating...</span>
                          </div>
                        ) : (
                          <>
                            <span className="text-lg font-bold">
                              {stat.value}
                            </span>
                            {stat.confidence && (
                              <span className={`text-xs px-2 py-1 rounded-full ml-2 ${
                                stat.confidence === 'high' 
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                  : stat.confidence === 'medium'
                                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                              }`}>
                                {stat.confidence}
                              </span>
                            )}
                          </>
                        )}
                        {stat.breakdown && !stat.isCalculating && (
                          <div className="relative group">
                            <svg className="w-4 h-4 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                            </svg>
                                                  {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10 max-w-xs">
                        <div className="font-semibold mb-1">Market Value Estimate</div>
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
                        <div className="border-t border-gray-700 pt-1 mt-1">
                          <div>Based on {stat.breakdown.comparableListings} comparable listings and {stat.breakdown.recentSales} recent sales</div>
                          <div>Confidence: {stat.confidence}</div>
                          <div className="italic text-gray-400">* this is just an estimate, please do your own research *</div>
                        </div>
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                      </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : stat.isHeight ? (
                    <span className="text-lg font-bold px-3 py-2 rounded-lg shadow-sm text-gray-900 dark:text-gray-900 bg-gradient-to-r from-white to-gray-100 dark:from-white dark:to-gray-100">
                      {stat.value}
                    </span>
                  ) : stat.isPositions ? (
                    <span className="text-lg font-bold px-3 py-2 rounded-lg shadow-sm text-gray-900 dark:text-gray-900 bg-gradient-to-r from-white to-gray-100 dark:from-white dark:to-gray-100">
                      {stat.value}
                    </span>
                  ) : stat.isTags ? (
                    stat.value && stat.value.length > 0 ? (
                      <div className="flex flex-wrap gap-1 items-center justify-end">
                        {stat.value.map((tag: any, index: number) => (
                          <span 
                            key={index}
                            className={`font-medium px-2 py-[2px] rounded-md flex items-center ${
                              tag.type === 'slow'
                                ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                                : tag.type === 'fast'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                : tag.type === 'lightningFast'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                : tag.type === 'retirement' 
                                ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                                : tag.type === 'positions'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                : tag.type === 'newlyMinted'
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                                : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                            }`}
                            style={{ fontSize: '16px' }}
                          >
                            {tag.icon && tag.icon}
                            <span>{tag.text}</span>
                          </span>
                        ))}
                      </div>
                    ) : null
                  ) : (
                    <span 
                      className="font-bold px-3 py-2 rounded-lg shadow-sm text-gray-900 dark:text-gray-900 bg-gradient-to-r from-white to-gray-100 dark:from-white dark:to-gray-100"
                      style={{ fontSize: '18px' }}
                    >
                      {Array.isArray(stat.value) ? null : stat.value}
                    </span>
                  )}

                </>
              ) : stat.isTags ? (
                // Don't show anything for empty tags
                null
              ) : (
                <span className="text-sm text-gray-400 dark:text-gray-500 italic bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-lg">Not available</span>
              )}
            </div>
          </div>
        ))}
    </div>
  );
};
