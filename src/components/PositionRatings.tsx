import React from 'react';
import type { MFLPlayer, MFLPosition } from '@/src/types/mflApi';
import { getRatingColors, getRatingStyle, getRatingBarStyle } from '@/src/utils/ratingColors';

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

interface PositionRatingsProps {
  player: MFLPlayer;
}

export const PositionRatings: React.FC<PositionRatingsProps> = ({ player }) => {

  const positionGroups = [
    {
      title: 'Goalkeeper',
      positions: [
        { key: 'GK' as MFLPosition, label: 'Goalkeeper' }
      ],
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200'
    },
    {
      title: 'Defense',
      positions: [
        { key: 'LB' as MFLPosition, label: 'Left Back' },
        { key: 'CB' as MFLPosition, label: 'Centre Back' },
        { key: 'RB' as MFLPosition, label: 'Right Back' },
        { key: 'LWB' as MFLPosition, label: 'Left Wing Back' },
        { key: 'RWB' as MFLPosition, label: 'Right Wing Back' }
      ],
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    },
    {
      title: 'Midfield',
      positions: [
        { key: 'CDM' as MFLPosition, label: 'Central Defensive Midfielder' },
        { key: 'CM' as MFLPosition, label: 'Central Midfielder' },
        { key: 'CAM' as MFLPosition, label: 'Central Attacking Midfielder' },
        { key: 'LM' as MFLPosition, label: 'Left Midfielder' },
        { key: 'RM' as MFLPosition, label: 'Right Midfielder' }
      ],
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    },
    {
      title: 'Attack',
      positions: [
        { key: 'LW' as MFLPosition, label: 'Left Winger' },
        { key: 'RW' as MFLPosition, label: 'Right Winger' },
        { key: 'CF' as MFLPosition, label: 'Centre Forward' },
        { key: 'ST' as MFLPosition, label: 'Striker' }
      ],
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200'
    }
  ];

  const isPlayerPosition = (position: MFLPosition): boolean => {
    return player.metadata.positions.includes(position);
  };

  const getPositionRating = (position: MFLPosition): number | undefined => {
    switch (position) {
      case 'GK':
        return player.metadata.goalkeeping;
      case 'LB':
      case 'CB':
      case 'RB':
      case 'LWB':
      case 'RWB':
        return player.metadata.defense;
      case 'CDM':
      case 'CM':
      case 'CAM':
      case 'LM':
      case 'RM':
        return player.metadata.passing;
      case 'LW':
      case 'RW':
      case 'CF':
      case 'ST':
        return player.metadata.shooting;
      default:
        return undefined;
    }
  };

  if (!player.metadata) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Position Ratings</h3>
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400">Position ratings not available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Position Ratings</h3>
      
      <div className="space-y-6">
        {positionGroups.map((group) => (
          <div key={group.title} className={`rounded-lg border ${group.borderColor} ${group.bgColor} p-4`}>
            <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">{group.title}</h4>
            <div className="grid grid-cols-1 gap-3 w-full">
              {group.positions.map((position) => {
                const rating = getPositionRating(position.key);
                const isPrimaryOrSecondary = isPlayerPosition(position.key);
                
                return (
                  <div 
                    key={position.key} 
                    className={`relative px-3 py-2 rounded-lg border transition-all duration-200 ${
                      isPrimaryOrSecondary 
                        ? `shadow-md ring-2 ring-blue-200 ${getRatingStyle(rating, player.metadata.overall)}` 
                        : `${getRatingStyle(rating, player.metadata.overall)} hover:bg-white hover:border-gray-300`
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className={`text-xs font-bold px-2 py-1 rounded ${
                          isPrimaryOrSecondary ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
                        } ${
                          isPrimaryOrSecondary && position.key === player.metadata.positions[0] ? 'border-4 border-green-500' : 
                          isPrimaryOrSecondary ? 'border-4 border-orange-500' : ''
                        }`}>
                          {position.key}
                        </span>
                        {isPrimaryOrSecondary && (
                          <span className={`text-xs font-semibold ${
                            position.key === player.metadata.positions[0] ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'
                          }`}>
                            {position.key === player.metadata.positions[0] ? 'Primary' : 'Secondary'}
                          </span>
                        )}
                      </div>
                      <span 
                        className={`font-bold px-3 py-2 rounded-lg shadow-sm ${rating ? getTierColor(rating).text : 'text-gray-500'} ${rating ? getTierColor(rating).bg : 'bg-gray-100'} ${rating ? getTierColor(rating).border : 'border-gray-300'}`}
                        style={{ fontSize: '22px' }}
                      >
                        {rating || '--'}
                      </span>
                    </div>
                    
                    <div className="mb-2">
                      <span className="text-xs text-gray-600 dark:text-gray-400">{position.label}</span>
                    </div>
                    
                    {rating && (
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="h-2 rounded-full transition-all duration-300"
                          style={{
                            ...getRatingBarStyle(rating),
                            width: `${(rating / 100) * 100}%`
                          }}
                        ></div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="mt-6 p-4 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-700 dark:to-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
        <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">Rating Summary</h4>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div 
              className="text-lg font-bold"
              style={getRatingStyle(Math.max(player.metadata.overall, player.metadata.defense, player.metadata.passing, player.metadata.shooting, player.metadata.goalkeeping))}
            >
              {Math.max(player.metadata.overall, player.metadata.defense, player.metadata.passing, player.metadata.shooting, player.metadata.goalkeeping)}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Highest</div>
          </div>
          <div>
            <div 
              className="text-lg font-bold"
              style={getRatingStyle(player.metadata.overall)}
            >
              {player.metadata.overall}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Overall</div>
          </div>
          <div>
            <div 
              className="text-lg font-bold"
              style={getRatingStyle(Math.min(player.metadata.overall, player.metadata.defense, player.metadata.passing, player.metadata.shooting, player.metadata.goalkeeping))}
            >
              {Math.min(player.metadata.overall, player.metadata.defense, player.metadata.passing, player.metadata.shooting, player.metadata.goalkeeping)}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Lowest</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PositionRatings;
