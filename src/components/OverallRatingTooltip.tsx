import React from 'react';
import { getPlayerPreciseOverall, getPlayerPreciseOverallForPosition } from '@/src/utils/overallRatingCalculator';
import { MFLPosition } from '@/src/types/positionOvr';

interface OverallRatingTooltipProps {
  player: any;
  children: React.ReactNode;
  className?: string;
  position?: MFLPosition;
}

export const OverallRatingTooltip: React.FC<OverallRatingTooltipProps> = ({ 
  player, 
  children, 
  className = '',
  position
}) => {
  const preciseOverall = position 
    ? getPlayerPreciseOverallForPosition(player, position)
    : getPlayerPreciseOverall(player);

  return (
    <div className={`relative group ${className}`}>
      {children}
      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
        <div className="text-center">
          <div className="text-lg font-bold">{preciseOverall}</div>
        </div>
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
      </div>
    </div>
  );
};

export default OverallRatingTooltip;
