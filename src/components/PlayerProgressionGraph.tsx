'use client';

import React, { useState, useEffect } from 'react';
import { fetchPlayerExperienceHistory, processProgressionData } from '../services/playerExperienceService';
import type { ProgressionDataPoint, StatType } from '../types/playerExperience';

interface PlayerProgressionGraphProps {
  playerId: string;
  playerName: string;
  playerPositions?: string[];
}

  const STAT_COLORS = {
    overall: 'black', // black
    pace: 'rgb(255, 163, 50)', // orange
    dribbling: 'rgb(34, 163, 140)', // teal
    passing: 'rgb(30, 255, 0)', // bright green
    shooting: 'rgb(255, 0, 61)', // pink/red
    defense: 'rgb(50, 99, 255)', // blue
    physical: 'purple' // purple
  };

  const STAT_LABELS = {
    overall: 'OVR',
    pace: 'PAC',
    dribbling: 'DRI',
    passing: 'PAS',
    shooting: 'SHO',
    defense: 'DEF',
    physical: 'PHY'
  };

export default function PlayerProgressionGraph({ playerId, playerName, playerPositions }: PlayerProgressionGraphProps) {
  const [progressionData, setProgressionData] = useState<ProgressionDataPoint[]>([]);
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
        
                               if (experienceHistory.success && experienceHistory.data.length > 0) {
          const processedData = processProgressionData(experienceHistory.data);
          setProgressionData(processedData);
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
  }, [playerId]);

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
      <div className="w-full p-2 lg:p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-center h-32 lg:h-48">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="w-full p-2 lg:p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-center h-32 lg:h-48">
          <div className="text-center text-gray-500 dark:text-gray-400">
            <p className="text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // No data state
  if (progressionData.length === 0) {
    return (
      <div className="w-full p-2 lg:p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-center h-32 lg:h-48">
          <div className="text-center text-gray-500 dark:text-gray-400">
            <p className="text-sm">No progression data available</p>
          </div>
        </div>
      </div>
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
  const maxAge = Math.ceil(Math.max(...progressionData.map(d => d.age || 0)));
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

  // Helper function to get color for the overall line based on rating
  const getOverallLineColor = (rating: number) => {
    if (rating >= 95) {
      return '#87f6f8'; // Ultimate teal
    } else if (rating >= 85) {
      return '#fa53ff'; // Legendary purple
    } else if (rating >= 75) {
      return '#0047ff'; // Rare blue
    } else if (rating >= 65) {
      return '#71ff30'; // Uncommon green
    } else if (rating >= 55) {
      return '#ecd17f'; // Limited yellow
    } else {
      return '#9f9f9f'; // Common grey
    }
  };

  // Helper function to get darker color for dots
  const getDarkerColor = (color: string) => {
    // Convert hex to RGB and darken
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Darken by 20%
    const darkenFactor = 0.8;
    const darkerR = Math.round(r * darkenFactor);
    const darkerG = Math.round(g * darkenFactor);
    const darkerB = Math.round(b * darkenFactor);
    
    return `rgb(${darkerR}, ${darkerG}, ${darkerB})`;
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

  // Generate multi-colored path segments for overall stat
  const generateOverallPathSegments = () => {
    const validData = progressionData
      .map(d => ({ age: d.age, value: d.overall }))
      .filter(d => d.value !== undefined && d.value >= 0);

    if (validData.length < 2) return [];

    // For stats with no progression (same value), return single segment
    const uniqueValues = new Set(validData.map(d => d.value));
    const hasProgression = uniqueValues.size > 1;
    
    if (!hasProgression) {
      const constantValue = validData[0].value!;
      const x1 = getChartX(minAge);
      const y1 = getChartY(constantValue, 'overall');
      const x2 = getChartX(maxAge);
      const y2 = getChartY(constantValue, 'overall');
      
      return [{
        path: `M ${x1},${y1} L ${x2},${y2}`,
        color: getOverallLineColor(constantValue)
      }];
    }

    // Create path segments with color changes
    const segments: Array<{ path: string; color: string }> = [];
    
    for (let i = 0; i < validData.length - 1; i++) {
      const currentPoint = validData[i];
      const nextPoint = validData[i + 1];
      
      if (currentPoint.value !== undefined && nextPoint.value !== undefined) {
        const x1 = getChartX(currentPoint.age || 0);
        const y1 = getChartY(currentPoint.value, 'overall');
        const x2 = getChartX(nextPoint.age || 0);
        const y2 = getChartY(nextPoint.value, 'overall');
        
        // Use the color based on the current point's rating
        const color = getOverallLineColor(currentPoint.value);
        
        segments.push({
          path: `M ${x1},${y1} L ${x2},${y2}`,
          color
        });
      }
    }

    // Add final segment to current age if needed
    if (validData.length > 0) {
      const lastPoint = validData[validData.length - 1];
      const lastValue = lastPoint.value!;
      const lastAge = lastPoint.age || 0;
      
      if (lastAge < maxAge) {
        const x1 = getChartX(lastAge);
        const y1 = getChartY(lastValue, 'overall');
        const x2 = getChartX(maxAge);
        const y2 = getChartY(lastValue, 'overall');
        
        segments.push({
          path: `M ${x1},${y1} L ${x2},${y2}`,
          color: getOverallLineColor(lastValue)
        });
      }
    }

    return segments;
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
    <div className="w-full p-2 lg:p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 lg:mb-4">Player Progression</h3>
      
             {/* Stat Toggles */}
                    <div className="mb-4 flex flex-wrap gap-1">
               {availableStats.length > 1 && (
                 <button
                   onClick={toggleAllStats}
                   className={`px-3 py-1 text-sm font-bold rounded-full border transition-colors ${
                     enabledStats.size === availableStats.length
                       ? 'text-white border-transparent bg-gray-600'
                       : 'text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600'
                   }`}
                 >
                   {enabledStats.size === availableStats.length ? 'None' : 'All'}
                 </button>
               )}
               {availableStats.map(stat => (
                 <button
                   key={stat}
                   onClick={() => toggleStat(stat)}
                   className={`px-3 py-1 text-sm font-bold rounded-full border transition-colors ${
                     enabledStats.has(stat)
                       ? 'text-white border-transparent'
                       : 'text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600'
                   }`}
                   style={{
                     backgroundColor: enabledStats.has(stat) ? (stat === 'overall' ? getOverallLineColor(progressionData[progressionData.length - 1]?.overall || 0) : STAT_COLORS[stat]) : 'transparent'
                   }}
                 >
                   {STAT_LABELS[stat]}
                 </button>
               ))}
             </div>
      
      <div className="relative">
        <svg
          width="100%"
          height="auto"
          className="w-full max-w-full"
          viewBox="0 0 1200 500"
        >
          {/* Grid lines */}
          <defs>
            <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
              <path
                d="M 50 0 L 0 0 0 50"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.5"
                className="text-gray-200 dark:text-gray-700"
              />
            </pattern>
          </defs>
          
          <rect width="100%" height="100%" fill="url(#grid)" />
          
          {/* Y-axis labels - dynamic range for enabled stats */}
          {(() => {
            // Calculate the overall range for all enabled stats
            const enabledRanges = Array.from(enabledStats)
              .map(stat => statRanges[stat])
              .filter(range => range !== undefined);
            
            if (enabledRanges.length === 0) return null;
            
            const minValue = Math.min(...enabledRanges.map(r => r!.min));
            const maxValue = Math.max(...enabledRanges.map(r => r!.max));
            const midValue = Math.round((minValue + maxValue) / 2);
            
            return [minValue, midValue, maxValue].map((value) => {
              // Use the first enabled stat for Y calculation (they all use the same range now)
              const firstStat = Array.from(enabledStats)[0];
              const y = getChartY(value, firstStat);
              return (
                <g key={value}>
                  <text
                    x={padding - 5}
                    y={y + 4}
                    textAnchor="end"
                    className="text-xs fill-gray-500 dark:fill-gray-400"
                  >
                    {value}
                  </text>
                  <line
                    x1={padding}
                    y1={y}
                    x2={chartWidth - padding}
                    y2={y}
                    stroke="currentColor"
                    strokeWidth="0.5"
                    className="text-gray-300 dark:text-gray-600"
                  />
                </g>
              );
            });
          })()}
          
          {/* X-axis labels */}
          {Array.from({ length: maxAge - minAge + 1 }, (_, i) => minAge + i).map((age) => {
            const x = getChartX(age);
            return (
              <text
                key={age}
                x={x}
                y={chartHeight - padding + 15}
                textAnchor="middle"
                className="text-xs fill-gray-500 dark:fill-gray-400"
              >
                Age {age}
              </text>
            );
          })}
          
          {/* Progression lines for each enabled stat */}
          {availableStats.map(stat => {
            if (!enabledStats.has(stat) || !statRanges[stat]) return null;
            
            if (stat === 'overall') {
              return (
                <g key={stat}>
                  {generateOverallPathSegments().map((segment, index) => (
                    <path
                      key={`${stat}-segment-${index}`}
                      d={segment.path}
                      fill="none"
                      stroke={segment.color}
                      strokeWidth="4"
                    />
                  ))}
                  {generateDataPoints(stat).map((point, index) => (
                    <circle
                      key={`${stat}-${index}`}
                      cx={point.x}
                      cy={point.y}
                      r="4"
                      fill={getDarkerColor(getOverallLineColor(point.value || 0))}
                    />
                  ))}
                </g>
              );
            }

            return (
              <g key={stat}>
                <path
                  d={generatePath(stat)}
                  fill="none"
                  stroke={STAT_COLORS[stat]}
                  strokeWidth="3"
                />
                {generateDataPoints(stat).map((point, index) => (
                  <circle
                    key={`${stat}-${index}`}
                    cx={point.x}
                    cy={point.y}
                    r="4"
                    fill={STAT_COLORS[stat]}
                  />
                ))}
              </g>
            );
          })}
        </svg>
        
        {/* Legend */}
        <div className="mt-2 lg:mt-4 text-sm text-gray-500 dark:text-gray-400">
                     {enabledStats.size > 0 && (
                           <div className="mt-2 flex flex-wrap gap-2">
               {Array.from(enabledStats).map(stat => {
                 const range = statRanges[stat];
                 if (!range) return null;
                 
                 const currentValue = progressionData[progressionData.length - 1]?.[stat];
                 const firstValue = progressionData[0]?.[stat];
                 const change = currentValue !== undefined && firstValue !== undefined ? currentValue - firstValue : 0;
                 
                 // For the legend, we want to show the current (latest) value, not the first value
                 const displayValue = currentValue !== undefined ? currentValue : 0;
                 
         
                 
                 return (
                   <div key={stat} className="flex items-center space-x-2 text-base font-semibold text-gray-700">
                     <div 
                       className="w-3 h-3 rounded-full" 
                       style={{ backgroundColor: stat === 'overall' ? getOverallLineColor(displayValue) : STAT_COLORS[stat] }}
                     />
                     <span className="font-medium">{STAT_LABELS[stat]}:</span>
                     <span>{displayValue}</span>
                     {change !== 0 && (
                       <span className={change > 0 ? 'text-green-600' : 'text-red-600'}>
                         ({change > 0 ? '+' : ''}{change})
                       </span>
                     )}
                   </div>
                 );
               })}
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
