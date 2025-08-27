import React from 'react';
import type { MFLPlayer } from '../types/mflApi';

interface PlayerStatsGridProps {
  player: MFLPlayer;
}

// Function to get tier color based on rating value
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

export const PlayerStatsGrid: React.FC<PlayerStatsGridProps> = ({ player }) => {
  // Check if player is a goalkeeper
  const isGoalkeeper = player.metadata.positions?.includes('GK') || player.metadata.positions?.[0] === 'GK';
  
  const stats = isGoalkeeper 
    ? [{ label: 'GK', value: player.metadata.overall }]
    : [
        { label: 'PAC', value: player.metadata.pace },
        { label: 'DRI', value: player.metadata.dribbling },
        { label: 'PAS', value: player.metadata.passing },
        { label: 'SHO', value: player.metadata.shooting },
        { label: 'DEF', value: player.metadata.defense },
        { label: 'PHY', value: player.metadata.physical },
      ];

  return (
    <div className={`grid grid-flow-row ${isGoalkeeper ? 'grid-cols-1' : 'grid-cols-6'} items-start justify-center`}>
      {/* Header row */}
      {stats.map((stat) => (
        <div key={`header-${stat.label}`} className="border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 border-b px-2 py-1.5 text-center text-base font-semibold tracking-wide whitespace-nowrap uppercase">
          {stat.label}
        </div>
      ))}
      
      {/* Values row */}
      {stats.map((stat) => {
        const tierColors = getTierColor(stat.value);
        return (
          <div key={`value-${stat.label}`} className="flex flex-col items-center justify-start gap-1.5 px-1 pt-2">
            <div className="relative">
              <div className={`flex items-center justify-center rounded-lg shadow-sm px-3 py-2 text-center font-bold ${tierColors.text} ${tierColors.bg} ${tierColors.border}`} style={{ fontSize: '22px' }}>
                {stat.value}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PlayerStatsGrid;
