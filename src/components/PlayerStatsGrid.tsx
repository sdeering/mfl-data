import React, { useState, useEffect } from 'react';
import type { MFLPlayer } from '../types/mflApi';
import { OverallRatingTooltip } from './OverallRatingTooltip';
import { getTierColors } from '../utils/tierColors';
import { calculateStatImpact, formatStatImpact } from '../utils/statImpactCalculator';

const stepButtonClass =
  'w-[22px] h-[22px] grid place-items-center rounded-md border border-line-2 bg-panel text-muted text-[13px] font-bold leading-none cursor-pointer transition-colors hover:text-fg hover:border-line-hover disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-muted disabled:hover:border-line-2';

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
    <div className="flex flex-wrap justify-center gap-2">
      {stats.map((stat) => {
        const tierColors = getTierColors(stat.value);
        const isOverallRating = stat.label === 'GK'; // GK represents overall rating for goalkeepers
        const isModified = !isOverallRating && 'originalValue' in stat && stat.value !== stat.originalValue;

        // Calculate OVR impact for this stat (only for outfield players)
        const primaryPosition = player.metadata.positions?.[0] || '';
        const ovrImpact = !isGoalkeeper && primaryPosition 
          ? calculateStatImpact(primaryPosition, stat.label)
          : 0;

        const box = (
          <div
            className={`grid place-items-center w-[50px] h-[46px] rounded-xl font-display text-xl font-extrabold tabular-nums ${isModified ? 'outline-2 outline-offset-2 outline-accent' : ''}`}
            style={{ background: tierColors.bg, color: tierColors.fg }}
          >
            {stat.value}
          </div>
        );

        return (
          <div key={stat.label} className="flex flex-col items-center gap-1.5">
            <span className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted">{stat.label}</span>
            {isOverallRating ? (
              <OverallRatingTooltip player={player}>{box}</OverallRatingTooltip>
            ) : (
              <div className="relative group cursor-help">
                {box}
                {/* Tooltip */}
                {!isGoalkeeper && primaryPosition && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 rounded-xl border border-line-2 bg-panel text-fg text-[13px] shadow-[0_12px_30px_rgba(0,0,0,.4)] opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                    <div className="font-bold">+1 {stat.label} = {formatStatImpact(ovrImpact)} OVR</div>
                  </div>
                )}
              </div>
            )}
            {/* +/- buttons for outfield players */}
            {!isGoalkeeper && !isOverallRating && (
              <>
                <div className="relative flex gap-1">
                  <button
                    onClick={() => updateAttribute(stat.label, -1)}
                    className={stepButtonClass}
                    disabled={'originalValue' in stat && stat.value <= stat.originalValue}
                  >
                    −
                  </button>
                  <button
                    onClick={() => updateAttribute(stat.label, 1)}
                    className={stepButtonClass}
                    disabled={stat.value >= 99}
                  >
                    +
                  </button>
                  {/* Reset button - floating on the right */}
                  {isDirty && stat.label === 'PHY' && (
                    <button
                      onClick={handleReset}
                      className="absolute left-full ml-1 w-[22px] h-[22px] grid place-items-center rounded-full border border-red-500/45 bg-red-500/12 text-danger-ink text-xs font-bold leading-none cursor-pointer transition-colors hover:bg-red-500/20"
                      title="Reset all changes"
                    >
                      ×
                    </button>
                  )}
                </div>
                {/* Button press counter (show net count) */}
                {buttonCounts[stat.label] > 0 && (
                  <div className="text-xs font-semibold">
                    <span className="text-green-600 dark:text-green-400">+{buttonCounts[stat.label]}</span>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default PlayerStatsGrid;
