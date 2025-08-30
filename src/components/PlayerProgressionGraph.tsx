'use client';

import React, { useState, useEffect } from 'react';
import { fetchPlayerExperienceHistory, processProgressionData } from '../services/playerExperienceService';
import type { ProgressionDataPoint, StatType } from '../types/playerExperience';

interface PlayerProgressionGraphProps {
  playerId: string;
  playerName: string;
}

const STAT_COLORS = {
  overall: '#3B82F6', // blue
  pace: 'rgb(255, 163, 50)', // orange
  dribbling: 'rgb(34, 163, 140)', // teal
  passing: 'rgb(30, 255, 0)', // bright green
  shooting: 'rgb(255, 0, 61)', // pink/red
  defense: 'rgb(50, 99, 255)', // blue
  physical: 'rgb(44, 63, 129)' // dark blue
};

const STAT_LABELS = {
  overall: 'Overall',
  pace: 'Pace',
  dribbling: 'Dribbling',
  passing: 'Passing',
  shooting: 'Shooting',
  defense: 'Defense',
  physical: 'Physical'
};

export default function PlayerProgressionGraph({ playerId, playerName }: PlayerProgressionGraphProps) {
  const [progressionData, setProgressionData] = useState<ProgressionDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enabledStats, setEnabledStats] = useState<Set<StatType>>(new Set(['overall']));

  useEffect(() => {
    const loadProgressionData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const experienceHistory = await fetchPlayerExperienceHistory(playerId);
        
                       if (experienceHistory.success && experienceHistory.data.length > 0) {
                 const processedData = processProgressionData(experienceHistory.data);
                 console.log('Processed progression data:', processedData);
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
      // If all are enabled, disable all except overall
      setEnabledStats(new Set(['overall']));
    } else {
      // If not all are enabled, enable all
      setEnabledStats(new Set(availableStats));
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="w-full p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Player Progression</h3>
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="w-full p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Player Progression</h3>
        <div className="flex items-center justify-center h-48">
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
      <div className="w-full p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Player Progression</h3>
        <div className="flex items-center justify-center h-48">
          <div className="text-center text-gray-500 dark:text-gray-400">
            <p className="text-sm">No progression data available</p>
          </div>
        </div>
      </div>
    );
  }

  // Calculate chart dimensions and scales
  const chartWidth = 500;
  const chartHeight = 300;
  const padding = 50;

  // Get all available stats and their ranges
  const availableStats = Object.keys(STAT_COLORS) as StatType[];
  const statRanges: Record<StatType, { min: number; max: number; range: number }> = {} as any;

  availableStats.forEach(stat => {
    const values = progressionData
      .map(d => d[stat])
      .filter((val): val is number => val !== undefined);
    
    if (values.length > 0) {
      const min = Math.min(...values);
      const max = Math.max(...values);
      statRanges[stat] = { min, max, range: max - min };
    }
  });

  const minDate = new Date(Math.min(...progressionData.map(d => d.date.getTime())));
  const maxDate = new Date(Math.max(...progressionData.map(d => d.date.getTime())));
  const dateRange = maxDate.getTime() - minDate.getTime();

  // Helper function to convert data to chart coordinates
  const getChartX = (date: Date) => {
    const timeDiff = date.getTime() - minDate.getTime();
    return padding + (timeDiff / dateRange) * (chartWidth - 2 * padding);
  };

  const getChartY = (value: number, stat: StatType) => {
    const range = statRanges[stat];
    if (!range) return 0;
    
    const normalizedValue = (value - range.min) / range.range;
    return chartHeight - padding - normalizedValue * (chartHeight - 2 * padding);
  };

     // Generate SVG path for a specific stat
   const generatePath = (stat: StatType) => {
     const validData = progressionData
       .map(d => ({ date: d.date, value: d[stat] }))
       .filter(d => d.value !== undefined);

     if (validData.length < 2) return '';

     // For stats with no progression (same value), ensure we draw a line from start to end
     const uniqueValues = new Set(validData.map(d => d.value));
     const hasProgression = uniqueValues.size > 1;
     
     if (!hasProgression) {
       // If no progression, just draw a straight line from first to last point
       const firstPoint = validData[0];
       const lastPoint = validData[validData.length - 1];
       
       const x1 = getChartX(firstPoint.date);
       const y1 = getChartY(firstPoint.value!, stat);
       const x2 = getChartX(lastPoint.date);
       const y2 = getChartY(lastPoint.value!, stat);
       
       return `M ${x1},${y1} L ${x2},${y2}`;
     }

     // For stats with progression, include all points
     const points = validData.map(d => {
       const x = getChartX(d.date);
       const y = getChartY(d.value!, stat);
       return `${x},${y}`;
     });

     return `M ${points.join(' L ')}`;
   };

  // Generate data points for circles
  const generateDataPoints = (stat: StatType) => {
    return progressionData
      .map((d, index) => ({
        x: getChartX(d.date),
        y: getChartY(d[stat] || 0, stat),
        value: d[stat],
        date: d.date
      }))
      .filter(point => point.value !== undefined);
  };

  return (
    <div className="w-full p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Player Progression</h3>
      
             {/* Stat Toggles */}
       <div className="mb-4 flex flex-wrap gap-2">
         <button
           onClick={toggleAllStats}
           className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
             enabledStats.size === availableStats.length
               ? 'text-white border-transparent bg-gray-600'
               : 'text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600'
           }`}
         >
           {enabledStats.size === availableStats.length ? 'All Off' : 'All On'}
         </button>
         {availableStats.map(stat => (
           <button
             key={stat}
             onClick={() => toggleStat(stat)}
             className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
               enabledStats.has(stat)
                 ? 'text-white border-transparent'
                 : 'text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600'
             }`}
             style={{
               backgroundColor: enabledStats.has(stat) ? STAT_COLORS[stat] : 'transparent'
             }}
           >
             {STAT_LABELS[stat]}
           </button>
         ))}
       </div>
      
      <div className="relative">
        <svg
          width={chartWidth}
          height={chartHeight}
          className="w-full max-w-full"
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
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
          
          {/* Y-axis labels (using overall range for reference) */}
          {statRanges.overall && [statRanges.overall.min, Math.round((statRanges.overall.min + statRanges.overall.max) / 2), statRanges.overall.max].map((value) => {
            const y = getChartY(value, 'overall');
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
          })}
          
          {/* X-axis labels */}
          {[minDate, new Date((minDate.getTime() + maxDate.getTime()) / 2), maxDate].map((date) => {
            const x = getChartX(date);
            return (
              <text
                key={date.getTime()}
                x={x}
                y={chartHeight - padding + 15}
                textAnchor="middle"
                className="text-xs fill-gray-500 dark:fill-gray-400"
              >
                {date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
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
                  strokeWidth="2"
                />
                {generateDataPoints(stat).map((point, index) => (
                  <circle
                    key={`${stat}-${index}`}
                    cx={point.x}
                    cy={point.y}
                    r="3"
                    fill={STAT_COLORS[stat]}
                  />
                ))}
              </g>
            );
          })}
        </svg>
        
        {/* Legend */}
        <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center justify-between">
            <span>Data Points: {progressionData.length}</span>
            <span>Time Range: {minDate.toLocaleDateString()} - {maxDate.toLocaleDateString()}</span>
          </div>
                     {enabledStats.size > 0 && (
             <div className="mt-2 flex flex-wrap gap-4">
               {Array.from(enabledStats).map(stat => {
                 const range = statRanges[stat];
                 if (!range) return null;
                 
                 const currentValue = progressionData[progressionData.length - 1]?.[stat];
                 const firstValue = progressionData[0]?.[stat];
                 const change = currentValue !== undefined && firstValue !== undefined ? currentValue - firstValue : 0;
                 
                 return (
                   <div key={stat} className="flex items-center space-x-2">
                     <div 
                       className="w-3 h-3 rounded-full" 
                       style={{ backgroundColor: STAT_COLORS[stat] }}
                     />
                     <span className="font-medium">{STAT_LABELS[stat]}:</span>
                     <span>{currentValue !== undefined ? currentValue : 'N/A'}</span>
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
