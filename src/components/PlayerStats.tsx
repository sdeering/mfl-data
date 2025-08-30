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
}

export default function PlayerStats({ player }: PlayerStatsProps) {
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

  const overallTierColors = getTierColor(overall);

  const stats = [
    { label: 'Player ID', value: `#${player.id}` },
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
                    <span className="text-lg font-bold px-3 py-2 rounded-lg shadow-sm text-gray-900 dark:text-white bg-gradient-to-r from-white to-gray-100 dark:from-gray-400 dark:to-gray-500">
                      <span className="text-xl mr-2">{getCountryFlag(stat.value as string)}</span>
                      {formatCountryName(stat.value as string)}
                    </span>
                  ) : stat.isAgency ? (
                    <a 
                      href={`https://app.playmfl.com/users/${player.ownedBy.walletAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`text-lg font-bold px-3 py-2 rounded-lg shadow-sm text-gray-900 dark:text-white bg-gradient-to-r from-white to-gray-100 dark:from-gray-400 dark:to-gray-500 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors cursor-pointer`}
                    >
                      {stat.value}
                    </a>
                  ) : stat.isTeam ? (
                    stat.isFreeAgent ? (
                      <span className="text-lg font-bold px-3 py-2 rounded-lg shadow-sm text-gray-900 dark:text-white bg-gradient-to-r from-white to-gray-100 dark:from-gray-400 dark:to-gray-500">
                        {stat.value}
                      </span>
                    ) : stat.isDevCentre ? (
                      <span className="text-lg font-bold px-3 py-2 rounded-lg shadow-sm text-gray-900 dark:text-white bg-gradient-to-r from-white to-gray-100 dark:from-gray-400 dark:to-gray-500">
                        {stat.value}
                      </span>
                    ) : stat.teamId ? (
                      <a 
                        href={`https://app.playmfl.com/clubs/${stat.teamId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-lg font-bold px-3 py-2 rounded-lg shadow-sm text-gray-900 dark:text-white bg-gradient-to-r from-white to-gray-100 dark:from-gray-400 dark:to-gray-500 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors cursor-pointer"
                      >
                        {stat.value}
                      </a>
                    ) : (
                      <span className="text-lg font-bold px-3 py-2 rounded-lg shadow-sm text-gray-900 dark:text-white bg-gradient-to-r from-white to-gray-100 dark:from-gray-400 dark:to-gray-500">
                        {stat.value}
                      </span>
                    )
                  ) : (
                    <span 
                      className={`font-bold px-3 py-2 rounded-lg shadow-sm ${
                        stat.isRating ? `${overallTierColors.bg} ${overallTierColors.text} ${overallTierColors.border}` : 'text-gray-900 dark:text-white bg-gradient-to-r from-white to-gray-100 dark:from-gray-400 dark:to-gray-500'
                      }`}
                      style={{ fontSize: stat.isRating ? '22px' : '18px' }}
                    >
                      {stat.value}
                    </span>
                  )}

                </>
              ) : (
                <span className="text-sm text-gray-400 dark:text-gray-500 italic bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-lg">Not available</span>
              )}
            </div>
          </div>
        ))}
    </div>
  );
};
