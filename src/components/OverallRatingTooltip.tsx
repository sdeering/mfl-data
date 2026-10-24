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
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 rounded-xl border border-line-2 bg-panel text-fg shadow-[0_12px_30px_rgba(0,0,0,.4)] opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
        <div className="text-center">
          <div className="font-display text-lg font-bold tabular-nums">{preciseOverall}</div>
        </div>
      </div>
    </div>
  );
};

export default OverallRatingTooltip;
