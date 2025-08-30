'use client';

import React, { useState, useEffect } from 'react';
import { fetchPlayerExperienceHistory, processProgressionData } from '../services/playerExperienceService';
import type { ProgressionDataPoint } from '../types/playerExperience';

interface PlayerProgressionGraphProps {
  playerId: string;
  playerName: string;
}

export default function PlayerProgressionGraph({ playerId, playerName }: PlayerProgressionGraphProps) {
  const [progressionData, setProgressionData] = useState<ProgressionDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // Loading state
  if (isLoading) {
    return (
      <div className="w-full p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Overall Progression</h3>
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
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Overall Progression</h3>
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
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Overall Progression</h3>
        <div className="flex items-center justify-center h-48">
          <div className="text-center text-gray-500 dark:text-gray-400">
            <p className="text-sm">No progression data available</p>
          </div>
        </div>
      </div>
    );
  }

  // Calculate chart dimensions and scales
  const chartWidth = 300;
  const chartHeight = 200;
  const padding = 40;

  const minOverall = Math.min(...progressionData.map(d => d.overall));
  const maxOverall = Math.max(...progressionData.map(d => d.overall));
  const overallRange = maxOverall - minOverall;

  const minDate = new Date(Math.min(...progressionData.map(d => d.date.getTime())));
  const maxDate = new Date(Math.max(...progressionData.map(d => d.date.getTime())));
  const dateRange = maxDate.getTime() - minDate.getTime();

  // Helper function to convert data to chart coordinates
  const getChartX = (date: Date) => {
    const timeDiff = date.getTime() - minDate.getTime();
    return padding + (timeDiff / dateRange) * (chartWidth - 2 * padding);
  };

  const getChartY = (overall: number) => {
    const normalizedOverall = (overall - minOverall) / overallRange;
    return chartHeight - padding - normalizedOverall * (chartHeight - 2 * padding);
  };

  // Generate SVG path for the line
  const generatePath = () => {
    if (progressionData.length < 2) return '';

    const points = progressionData.map(d => {
      const x = getChartX(d.date);
      const y = getChartY(d.overall);
      return `${x},${y}`;
    });

    return `M ${points.join(' L ')}`;
  };

  // Generate data points for circles
  const dataPoints = progressionData.map((d, index) => ({
    x: getChartX(d.date),
    y: getChartY(d.overall),
    overall: d.overall,
    date: d.date,
    age: d.age
  }));

  return (
    <div className="w-full p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Overall Progression</h3>
      
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
          
          {/* Y-axis labels */}
          {[minOverall, Math.round((minOverall + maxOverall) / 2), maxOverall].map((value) => {
            const y = getChartY(value);
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
          
          {/* Progression line */}
          <path
            d={generatePath()}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-blue-600 dark:text-blue-400"
          />
          
          {/* Data points */}
          {dataPoints.map((point, index) => (
            <circle
              key={index}
              cx={point.x}
              cy={point.y}
              r="3"
              fill="currentColor"
              className="text-blue-600 dark:text-blue-400"
            />
          ))}
        </svg>
        
        {/* Legend */}
        <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center justify-between">
            <span>Overall Rating: {minOverall} - {maxOverall}</span>
            <span>{progressionData.length} data points</span>
          </div>
          {progressionData.length > 0 && (
            <div className="mt-1">
              <span>Current: {progressionData[progressionData.length - 1].overall}</span>
              {progressionData[0].overall !== progressionData[progressionData.length - 1].overall && (
                <span className="ml-4">
                  Change: {progressionData[progressionData.length - 1].overall - progressionData[0].overall > 0 ? '+' : ''}
                  {progressionData[progressionData.length - 1].overall - progressionData[0].overall}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
