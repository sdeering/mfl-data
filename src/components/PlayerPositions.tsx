import React from 'react';
import type { MFLPlayer, MFLPosition } from '@/src/types/mflApi';

interface PlayerPositionsProps {
  player: MFLPlayer;
}

export const PlayerPositions: React.FC<PlayerPositionsProps> = ({ player }) => {
  const getPositionDisplay = (position: MFLPosition): string => {
    const positionNames: Record<MFLPosition, string> = {
      'GK': 'Goalkeeper',
      'LB': 'Left Back',
      'CB': 'Centre Back',
      'RB': 'Right Back',
      'LWB': 'Left Wing Back',
      'RWB': 'Right Wing Back',
      'CDM': 'Central Defensive Midfielder',
      'CM': 'Central Midfielder',
      'CAM': 'Central Attacking Midfielder',
      'LM': 'Left Midfielder',
      'RM': 'Right Midfielder',
      'LW': 'Left Winger',
      'RW': 'Right Winger',
      'CF': 'Centre Forward',
      'ST': 'Striker'
    };
    return positionNames[position] || position;
  };

  const getPositionCategory = (position: MFLPosition): string => {
    const categories: Record<MFLPosition, string> = {
      'GK': 'goalkeeper',
      'LB': 'defender', 'CB': 'defender', 'RB': 'defender', 'LWB': 'defender', 'RWB': 'defender',
      'CDM': 'midfielder', 'CM': 'midfielder', 'CAM': 'midfielder', 'LM': 'midfielder', 'RM': 'midfielder',
      'LW': 'forward', 'RW': 'forward', 'CF': 'forward', 'ST': 'forward'
    };
    return categories[position] || 'midfielder';
  };

  const getCategoryColor = (category: string): string => {
    const colors = {
      goalkeeper: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      defender: 'bg-blue-100 text-blue-800 border-blue-300',
      midfielder: 'bg-green-100 text-green-800 border-green-300',
      forward: 'bg-red-100 text-red-800 border-red-300'
    };
    return colors[category as keyof typeof colors] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Playing Positions</h3>
      
      {/* Primary Position */}
      {player.metadata.positions && player.metadata.positions.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Primary Position</h4>
          <div className="flex items-center space-x-3">
            <span 
              className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium border ${
                getCategoryColor(getPositionCategory(player.metadata.positions[0]))
              }`}
            >
              {player.metadata.positions[0]}
            </span>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {getPositionDisplay(player.metadata.positions[0])}
            </span>
          </div>
        </div>
      )}

      {/* Secondary Positions */}
      {player.metadata.positions && player.metadata.positions.length > 1 && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Secondary Positions</h4>
          <div className="flex flex-wrap gap-2">
            {player.metadata.positions.slice(1).map((position, index) => (
              <div key={index} className="flex items-center space-x-2">
                <span 
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${
                    getCategoryColor(getPositionCategory(position))
                  }`}
                >
                  {position}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">
                  {getPositionDisplay(position)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Position Categories Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="text-center p-3 bg-yellow-50 rounded-lg border border-yellow-200">
          <div className="text-xs font-medium text-yellow-800 mb-1">Goalkeeper</div>
          <div className="text-lg font-bold text-yellow-900">
            {player.metadata.goalkeeping || '--'}
          </div>
        </div>
        
        <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="text-xs font-medium text-blue-800 mb-1">Defense</div>
          <div className="text-lg font-bold text-blue-900">
            {player.metadata.defense || '--'}
          </div>
        </div>
        
        <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
          <div className="text-xs font-medium text-green-800 mb-1">Midfield</div>
          <div className="text-lg font-bold text-green-900">
            {player.metadata.passing || '--'}
          </div>
        </div>
        
        <div className="text-center p-3 bg-red-50 rounded-lg border border-red-200">
          <div className="text-xs font-medium text-red-800 mb-1">Attack</div>
          <div className="text-lg font-bold text-red-900">
            {player.metadata.shooting || '--'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerPositions;