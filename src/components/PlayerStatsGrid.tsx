import React, { useState, useEffect } from 'react';
import type { MFLPlayer } from '../types/mflApi';
import { OverallRatingTooltip } from './OverallRatingTooltip';
import { calculateStatImpact, formatStatImpact } from '../utils/statImpactCalculator';

interface PlayerStatsGridProps {
  player: MFLPlayer;
  onAttributesChange?: (attributes: {
    pace?: number;
    shooting?: number;
    passing?: number;
    dribbling?: number;
    defense?: number;
    physical?: number;
  }) => void;
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

export const PlayerStatsGrid: React.FC<PlayerStatsGridProps> = ({ player, onAttributesChange }) => {
  // Check if player is a goalkeeper
  const isGoalkeeper = player.metadata.positions?.includes('GK') || player.metadata.positions?.[0] === 'GK';
  
  // State to track modified attributes
  const [modifiedAttributes, setModifiedAttributes] = useState<{
    pace?: number;
    shooting?: number;
    passing?: number;
    dribbling?: number;
    defense?: number;
    physical?: number;
  }>({});
  
  // State to track net button press count for each stat (net = plus clicks - minus clicks)
  const [buttonCounts, setButtonCounts] = useState<{
    [key: string]: number;
  }>({});
  
  // Reset when player changes
  useEffect(() => {
    setModifiedAttributes({});
    setButtonCounts({});
  }, [player.id]);
  
  // Notify parent of changes
  useEffect(() => {
    if (onAttributesChange && Object.keys(modifiedAttributes).length > 0) {
      onAttributesChange(modifiedAttributes);
    } else if (onAttributesChange && Object.keys(modifiedAttributes).length === 0) {
      onAttributesChange({});
    }
  }, [modifiedAttributes, onAttributesChange]);
  
  // Helper to get current value (original or modified)
  const getCurrentValue = (label: string, originalValue: number): number => {
    const keyMap: Record<string, keyof typeof modifiedAttributes> = {
      'PAC': 'pace',
      'DRI': 'dribbling',
      'PAS': 'passing',
      'SHO': 'shooting',
      'DEF': 'defense',
      'PHY': 'physical',
    };
    const key = keyMap[label];
    return key && modifiedAttributes[key] !== undefined ? modifiedAttributes[key]! : originalValue;
  };
  
  // Helper to update attribute
  const updateAttribute = (label: string, delta: number) => {
    const keyMap: Record<string, keyof typeof modifiedAttributes> = {
      'PAC': 'pace',
      'DRI': 'dribbling',
      'PAS': 'passing',
      'SHO': 'shooting',
      'DEF': 'defense',
      'PHY': 'physical',
    };
    const key = keyMap[label];
    if (!key) return;
    
    const originalValue = player.metadata[key];
    const currentValue = getCurrentValue(label, originalValue);
    // Prevent going below original value, max at 99
    const newValue = Math.max(originalValue, Math.min(99, currentValue + delta));
    
    // Update button counts (track net: +1 for plus, -1 for minus)
    setButtonCounts(prev => {
      const current = prev[label] || 0;
      const newCount = Math.max(0, current + delta);
      return {
        ...prev,
        [label]: newCount,
      };
    });
    
    setModifiedAttributes(prev => {
      if (newValue === originalValue) {
        // Remove from modified if back to original
        const { [key]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [key]: newValue };
    });
  };
  
  // Check if any attributes are modified
  const isDirty = Object.keys(modifiedAttributes).length > 0;
  
  // Reset all modifications
  const handleReset = () => {
    setModifiedAttributes({});
    setButtonCounts({});
  };
  
  const stats = isGoalkeeper 
    ? [{ label: 'GK', value: player.metadata.overall }]
    : [
        { label: 'PAC', value: getCurrentValue('PAC', player.metadata.pace), originalValue: player.metadata.pace },
        { label: 'DRI', value: getCurrentValue('DRI', player.metadata.dribbling), originalValue: player.metadata.dribbling },
        { label: 'PAS', value: getCurrentValue('PAS', player.metadata.passing), originalValue: player.metadata.passing },
        { label: 'SHO', value: getCurrentValue('SHO', player.metadata.shooting), originalValue: player.metadata.shooting },
        { label: 'DEF', value: getCurrentValue('DEF', player.metadata.defense), originalValue: player.metadata.defense },
        { label: 'PHY', value: getCurrentValue('PHY', player.metadata.physical), originalValue: player.metadata.physical },
      ];

  return (
    <div className="relative">
      <div className={`grid grid-flow-row ${isGoalkeeper ? 'grid-cols-1' : 'grid-cols-6'} items-start justify-center`}>
        {/* Header row */}
        {stats.map((stat) => (
          <div key={`header-${stat.label}`} className="border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 border-b px-2 py-1.5 text-center text-base font-semibold tracking-wide whitespace-nowrap uppercase" style={{ paddingBottom: '2px', marginBottom: '4px' }}>
            {stat.label}
          </div>
        ))}
        
        {/* Values row */}
        {stats.map((stat) => {
          const tierColors = getTierColor(stat.value);
          const isOverallRating = stat.label === 'GK'; // GK represents overall rating for goalkeepers
          const isModified = !isOverallRating && 'originalValue' in stat && stat.value !== stat.originalValue;
          
          // Calculate OVR impact for this stat (only for outfield players)
          const primaryPosition = player.metadata.positions?.[0] || '';
          const ovrImpact = !isGoalkeeper && primaryPosition 
            ? calculateStatImpact(primaryPosition, stat.label)
            : 0;
          
          return (
            <div key={`value-${stat.label}`} className="flex flex-col items-center justify-start gap-0.5 px-1 pt-1 relative">
              <div className="relative group">
                {isOverallRating ? (
                  <OverallRatingTooltip player={player}>
                    <div className={`flex items-center justify-center rounded-lg shadow-sm px-3 py-2 text-center font-bold ${tierColors.text} ${tierColors.bg} ${tierColors.border}`} style={{ fontSize: '22px' }}>
                      {stat.value}
                    </div>
                  </OverallRatingTooltip>
                ) : (
                  <>
                    <div className={`flex items-center justify-center rounded-lg shadow-sm px-3 py-2 text-center font-bold ${tierColors.text} ${tierColors.bg} ${tierColors.border} cursor-help ${isModified ? 'ring-2 ring-blue-500' : ''}`} style={{ fontSize: '22px' }}>
                      {stat.value}
                    </div>
                    {/* Tooltip */}
                    {!isGoalkeeper && primaryPosition && (
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-gray-900 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10" style={{ fontSize: '18px', border: '1px solid grey', borderRadius: '12px', padding: '6px 10px' }}>
                        <div className="font-bold">+1 {stat.label} = {formatStatImpact(ovrImpact)} OVR</div>
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent -mt-px" style={{ borderTopColor: 'grey' }}></div>
                      </div>
                    )}
                  </>
                )}
              </div>
              {/* +/- buttons for outfield players */}
              {!isGoalkeeper && !isOverallRating && (
                <div className="flex flex-col items-center mt-1 relative">
                  <div className="flex items-center">
                    <button
                      onClick={() => updateAttribute(stat.label, -1)}
                      className="w-6 h-6 flex items-center justify-center text-gray-700 dark:text-gray-300 text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed opacity-30 hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-700"
                      style={{ border: 0, background: 'none' }}
                      disabled={stat.value <= stat.originalValue}
                    >
                      −
                    </button>
                    <button
                      onClick={() => updateAttribute(stat.label, 1)}
                      className="w-6 h-6 flex items-center justify-center text-gray-700 dark:text-gray-300 text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed opacity-30 hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-700"
                      style={{ border: 0, background: 'none' }}
                      disabled={stat.value >= 99}
                    >
                      +
                    </button>
                  </div>
                  {/* Button press counter (show net count) */}
                  {buttonCounts[stat.label] > 0 && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      <span className="text-green-600 dark:text-green-400">+{buttonCounts[stat.label]}</span>
                    </div>
                  )}
                  {/* Reset button - floating on the right */}
                  {isDirty && stat.label === 'PHY' && (
                    <button
                      onClick={handleReset}
                      className="absolute left-full ml-1 w-6 h-6 flex items-center justify-center bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors text-xs font-bold"
                      title="Reset all changes"
                    >
                      ×
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PlayerStatsGrid;
