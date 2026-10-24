'use client';

import React, { useState, useEffect } from 'react';
import { fetchPlayerExperienceHistory, processProgressionData, getCurrentAge } from '../services/playerExperienceService';
import type { ProgressionDataPoint, StatType } from '../types/playerExperience';
import { Panel } from './ui';

interface PlayerProgressionGraphProps {
  playerId: string;
  playerName: string;
  playerPositions?: string[];
  // Only plot the history up to this timestamp (the mint view passes the mint date)
  asOf?: number;
}

  const STAT_COLORS = {
    overall: '#f0569a', // pink
    pace: '#f97316', // orange
    dribbling: '#14b8a6', // teal
    passing: '#22c55e', // green
    shooting: '#f05a5a', // red
    defense: '#3b82f6', // blue
    physical: '#a78bfa' // violet
  };

  const pillClass = 'h-8 px-3.5 rounded-full border text-xs font-bold cursor-pointer transition-colors';
  const inactivePillClass = `${pillClass} border-line-2 bg-transparent text-fg-3 hover:border-line-hover hover:text-fg`;

  const STAT_LABELS = {
    overall: 'OVR',
    pace: 'PAC',
    dribbling: 'DRI',
    passing: 'PAS',
    shooting: 'SHO',
    defense: 'DEF',
    physical: 'PHY'
  };

export default function PlayerProgressionGraph({ playerId, playerName, playerPositions, asOf }: PlayerProgressionGraphProps) {
  const [progressionData, setProgressionData] = useState<ProgressionDataPoint[]>([]);
  const [currentAge, setCurrentAge] = useState<number | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enabledStats, setEnabledStats] = useState<Set<StatType>>(new Set(['overall']));

  // Determine which stats to show based on player positions
  const getAvailableStats = (): StatType[] => {
    if (!playerPositions || playerPositions.length === 0) {
      return ['overall', 'pace', 'dribbling', 'passing', 'shooting', 'defense', 'physical'];
    }

    // If player is a goalkeeper, only show Overall
    if (playerPositions.includes('GK')) {
      return ['overall'];
    }

    // For all other positions, show all stats
    return ['overall', 'pace', 'dribbling', 'passing', 'shooting', 'defense', 'physical'];
  };

  const availableStats = getAvailableStats();

  useEffect(() => {
    const loadProgressionData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const experienceHistory = await fetchPlayerExperienceHistory(playerId);
        const entries = asOf === undefined
          ? experienceHistory.data
          : experienceHistory.data.filter(entry => entry.date <= asOf);
        
                               if (experienceHistory.success && entries.length > 0) {
          const processedData = processProgressionData(entries);
          setProgressionData(processedData);
          setCurrentAge(getCurrentAge(entries));
        } else {
          setError(experienceHistory.error || 'No progression data available');
        }
      } catch (err) {
        setError('Failed to load progression data');
      } finally {
        setIsLoading(false);
      }
    };

    if (playerId) {
      loadProgressionData();
    }
  }, [playerId, asOf]);

  const toggleStat = (stat: StatType) => {
    const newEnabledStats = new Set(enabledStats);
    if (newEnabledStats.has(stat)) {
      newEnabledStats.delete(stat);
    } else {
      newEnabledStats.add(stat);
    }
    setEnabledStats(newEnabledStats);
  };

  const toggleAllStats = () => {
    if (enabledStats.size === availableStats.length) {
      // If all are enabled, disable all
      setEnabledStats(new Set());
    } else {
      // If not all are enabled, enable all
      setEnabledStats(new Set(availableStats));
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <Panel className="w-full p-5">
        <div className="flex items-center justify-center h-32 lg:h-48">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-accent border-t-transparent"></div>
        </div>
      </Panel>
    );
  }

  // Error state
  if (error) {
    return (
      <Panel className="w-full p-5">
        <div className="flex items-center justify-center h-32 lg:h-48">
          <div className="text-center text-muted">
            <p className="m-0 text-sm">{error}</p>
          </div>
        </div>
      </Panel>
    );
  }

  // No data state
  if (progressionData.length === 0) {
    return (
      <Panel className="w-full p-5">
        <div className="flex items-center justify-center h-32 lg:h-48">
          <div className="text-center text-muted">
            <p className="m-0 text-sm">No progression data available</p>
          </div>
        </div>
      </Panel>
    );
  }

  // Calculate chart dimensions and scales - fixed for compare page
  const chartWidth = 1200;
  const chartHeight = 500;
  const padding = 60;

  // Get all available stats and their ranges
  const allStatTypes = Object.keys(STAT_COLORS) as StatType[];
  const statRanges: Record<StatType, { min: number; max: number; range: number }> = {} as any;

  allStatTypes.forEach(stat => {
    const values = progressionData
      .map(d => d[stat])
      .filter((val): val is number => val !== undefined);
    
    if (values.length > 0) {
      const min = Math.min(...values);
      const max = Math.max(...values);
      statRanges[stat] = { min, max, range: max - min };
    }
  });

  const minAge = Math.floor(Math.min(...progressionData.map(d => d.age || 0)));
  // The right edge is the player's current age, not the next whole age. currentAge also
  // covers a birthday that happened after the last stat change (age-only history entries).
  const maxAge = Math.max(...progressionData.map(d => d.age || 0), currentAge ?? 0);
  const ageRange = maxAge - minAge;

  // Helper function to convert data to chart coordinates
  const getChartX = (age: number) => {
    if (isNaN(age) || isNaN(minAge) || isNaN(ageRange) || ageRange === 0) {
      return padding; // Return left edge as fallback
    }
    
    const ageDiff = age - minAge;
    const x = padding + (ageDiff / ageRange) * (chartWidth - 2 * padding);
    
    // Ensure x is a valid number
    return isNaN(x) ? padding : x;
  };

  const getChartY = (value: number, stat: StatType) => {
    const range = statRanges[stat];
    if (!range || isNaN(value) || isNaN(range.min) || isNaN(range.range) || range.range === 0) {
      return chartHeight / 2; // Return middle of chart as fallback
    }
    
    const normalizedValue = (value - range.min) / range.range;
    const y = chartHeight - padding - normalizedValue * (chartHeight - 2 * padding);
    
    // Ensure y is a valid number
    return isNaN(y) ? chartHeight / 2 : y;
  };

  // Generate SVG path for a specific stat
   const generatePath = (stat: StatType) => {
     const validData = progressionData
       .map(d => ({ age: d.age, value: d[stat] }))
       .filter(d => d.value !== undefined && d.value >= 0);

     if (validData.length < 2) return '';

     // For stats with no progression (same value), ensure we draw a line from start to end
     const uniqueValues = new Set(validData.map(d => d.value));
     const hasProgression = uniqueValues.size > 1;
     

     
     if (!hasProgression) {
       // If no progression, draw a straight line from the very first age to the very last age
       // Use the constant value for the Y coordinate
       const constantValue = validData[0].value!;
       const x1 = getChartX(minAge);
       const y1 = getChartY(constantValue, stat);
       const x2 = getChartX(maxAge);
       const y2 = getChartY(constantValue, stat);
       
       return `M ${x1},${y1} L ${x2},${y2}`;
     }

     // For stats with progression, include all points and extend to current age
     const points = validData.map(d => {
       const x = getChartX(d.age || 0);
       const y = getChartY(d.value!, stat);
       return `${x},${y}`;
     });

     // Add a final point at the current age (maxAge) with the last known value
     const lastValue = validData[validData.length - 1].value!;
     const finalX = getChartX(maxAge);
     const finalY = getChartY(lastValue, stat);
     points.push(`${finalX},${finalY}`);

     return `M ${points.join(' L ')}`;
   };

  // Generate data points for circles - only show dots when the stat value changes
  const generateDataPoints = (stat: StatType) => {
    const allPoints = progressionData
      .map((d, index) => ({
        x: getChartX(d.age || 0),
        y: getChartY(d[stat] || 0, stat),
        value: d[stat],
        age: d.age,
        index
      }))
      .filter(point => point.value !== undefined && point.value > 0 && !isNaN(point.x) && !isNaN(point.y));

    // Only show dots when the stat value actually changes
    return allPoints.filter((point, arrayIndex) => {
      if (arrayIndex === 0) return true; // Always show first point
      
      // Show point if the value changed from the previous point
      const prevPoint = allPoints[arrayIndex - 1];
      if (prevPoint && point.value !== prevPoint.value) return true;
      
      return false;
    });
  };

  return (
    <Panel className="w-full p-5 flex flex-col gap-4">
      <h3 className="m-0 font-display text-[22px] font-bold">Player Progression</h3>

      {/* Stat Toggles */}
      <div className="flex flex-wrap gap-1.5">
        {availableStats.length > 1 && (
          <button
            onClick={toggleAllStats}
            className={enabledStats.size === availableStats.length ? `${pillClass} border-fg bg-fg text-canvas` : inactivePillClass}
          >
            {enabledStats.size === availableStats.length ? 'None' : 'All'}
          </button>
        )}
        {availableStats.map(stat => (
          <button
            key={stat}
            onClick={() => toggleStat(stat)}
            className={enabledStats.has(stat) ? pillClass : inactivePillClass}
            style={enabledStats.has(stat) ? { backgroundColor: STAT_COLORS[stat], borderColor: STAT_COLORS[stat], color: '#0b1406' } : undefined}
          >
            {STAT_LABELS[stat]}
          </button>
        ))}
      </div>

      <div className="relative">
        <svg
          className="block w-full h-auto max-h-[500px]"
          viewBox="0 0 1200 500"
        >
          {/* Y-axis labels and gridlines - dynamic range for enabled stats */}
          {(() => {
            // Calculate the overall range for all enabled stats
            const enabledRanges = Array.from(enabledStats)
              .map(stat => statRanges[stat])
              .filter(range => range !== undefined);

            if (enabledRanges.length === 0) return null;

            const minValue = Math.min(...enabledRanges.map(r => r!.min));
            const maxValue = Math.max(...enabledRanges.map(r => r!.max));
            const midValue = Math.round((minValue + maxValue) / 2);

            return [minValue, midValue, maxValue].map((value, index) => {
              // Use the first enabled stat for Y calculation (they all use the same range now)
              const firstStat = Array.from(enabledStats)[0];
              const y = getChartY(value, firstStat);
              return (
                <g key={`y-axis-${value}-${index}`}>
                  <text
                    x={padding - 8}
                    y={y + 4}
                    textAnchor="end"
                    className="font-mono text-xs fill-muted-3"
                  >
                    {value}
                  </text>
                  <line
                    x1={padding}
                    y1={y}
                    x2={chartWidth - padding}
                    y2={y}
                    strokeWidth="1"
                    strokeDasharray="4 4"
                    className="stroke-line-2"
                  />
                </g>
              );
            });
          })()}

          {/* X-axis labels */}
          {Array.from({ length: Math.floor(maxAge) - minAge + 1 }, (_, i) => minAge + i).map((age) => {
            const x = getChartX(age);
            return (
              <text
                key={age}
                x={x}
                y={chartHeight - padding + 22}
                textAnchor="middle"
                className="font-mono text-xs fill-muted-3"
              >
                Age {age}
              </text>
            );
          })}

          {/* Progression lines for each enabled stat */}
          {availableStats.map(stat => {
            if (!enabledStats.has(stat) || !statRanges[stat]) return null;

            return (
              <g key={stat}>
                <path
                  d={generatePath(stat)}
                  fill="none"
                  stroke={STAT_COLORS[stat]}
                  strokeWidth={stat === 'overall' ? 4 : 3}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {generateDataPoints(stat).map((point, index) => (
                  <circle
                    key={`${stat}-${index}`}
                    cx={point.x}
                    cy={point.y}
                    r="5"
                    fill={STAT_COLORS[stat]}
                    strokeWidth="2"
                    className="stroke-panel"
                  />
                ))}
              </g>
            );
          })}
        </svg>

        {/* Legend */}
        {enabledStats.size > 0 && (
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
            {Array.from(enabledStats).map(stat => {
              const range = statRanges[stat];
              if (!range) return null;

              const currentValue = progressionData[progressionData.length - 1]?.[stat];
              const firstValue = progressionData[0]?.[stat];
              const change = currentValue !== undefined && firstValue !== undefined ? currentValue - firstValue : 0;

              // For the legend, we want to show the current (latest) value, not the first value
              const displayValue = currentValue !== undefined ? currentValue : 0;

              return (
                <div key={stat} className="flex items-center gap-2 text-sm font-bold text-fg">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: STAT_COLORS[stat] }}
                  />
                  <span className="font-semibold text-muted">{STAT_LABELS[stat]}:</span>
                  <span className="tabular-nums">{displayValue}</span>
                  {change !== 0 && (
                    <span className={change > 0 ? 'text-green-600 dark:text-green-400' : 'text-danger-ink'}>
                      ({change > 0 ? '+' : ''}{change})
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Panel>
  );
}
