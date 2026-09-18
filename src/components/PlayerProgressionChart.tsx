'use client';

import React, { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  STACK_ORDER,
  STAT_COLORS,
  STAT_LABELS,
  STAT_NAMES,
  type ProgressionStat,
  type DailyProgression
} from '../utils/progressionCounts';

// 'attributes' stacks every attribute stat (overall excluded); otherwise a single stat is charted
export type ProgressionChartMode = 'attributes' | ProgressionStat;

interface PlayerProgressionChartProps {
  days: DailyProgression[];
  mode: ProgressionChartMode;
  isDark: boolean;
  surface: string; // Background the chart sits on, used as the gap between stacked segments
}

// "16 Jun" on the axis ("16 Jun 25" when the period crosses a new year); "Tue 16 Jun 2026" in full
const formatDay = (dayStart: number, style: 'short' | 'withYear' | 'full' = 'short') =>
  new Date(dayStart).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(style === 'withYear' ? { year: '2-digit' } : {}),
    ...(style === 'full' ? { weekday: 'short', year: 'numeric' } : {})
  });

const MIN_BAR_WIDTH_FOR_GAPS = 8; // Narrower than this, spacing and gaps between stacked segments would swallow the bar
const Y_AXIS_WIDTH = 36;
const CHART_MARGIN_RIGHT = 8;

export const getChartStats = (mode: ProgressionChartMode): ProgressionStat[] =>
  mode === 'attributes' ? STACK_ORDER : [mode];

function DayTooltip({ active, payload, mode, isDark }: any) {
  const day: DailyProgression | undefined = payload?.[0]?.payload;
  if (!active || !day) return null;

  const stats = getChartStats(mode).filter(stat => day[stat] > 0);

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 shadow-lg text-sm">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{formatDay(day.dayStart, 'full')}</p>
      {stats.length === 0 ? (
        <p className="text-gray-600 dark:text-gray-300">No progressions</p>
      ) : (
        <>
          {[...stats].reverse().map(stat => (
            <div key={stat} className="flex items-center gap-2">
              <span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: STAT_COLORS[stat][isDark ? 'dark' : 'light'] }} />
              <span className="font-semibold text-gray-900 dark:text-white tabular-nums">{day[stat]}</span>
              <span className="text-gray-600 dark:text-gray-300">{STAT_NAMES[stat]}</span>
            </div>
          ))}
          {mode === 'attributes' && stats.length > 1 && (
            <div className="flex items-center gap-2 mt-1 pt-1 border-t border-gray-200 dark:border-gray-700">
              <span className="w-3" />
              <span className="font-semibold text-gray-900 dark:text-white tabular-nums">{day.total}</span>
              <span className="text-gray-600 dark:text-gray-300">Total</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function PlayerProgressionChart({ days, mode, isDark, surface }: PlayerProgressionChartProps) {
  const [chartWidth, setChartWidth] = useState(0);
  const stats = getChartStats(mode);
  const theme = isDark ? 'dark' : 'light';

  const barSlotWidth = days.length > 0 ? Math.max(0, chartWidth - Y_AXIS_WIDTH - CHART_MARGIN_RIGHT) / days.length : 0;
  const showRoomyBars = barSlotWidth >= MIN_BAR_WIDTH_FOR_GAPS;
  const showSegmentGaps = stats.length > 1 && showRoomyBars;
  const isEmpty = days.every(day => stats.every(stat => day[stat] === 0));
  const crossesNewYear = days.length > 0 && new Date(days[0].dayStart).getFullYear() !== new Date(days[days.length - 1].dayStart).getFullYear();
  const gridColor = isDark ? '#374151' : '#e5e7eb';
  const axisTextColor = isDark ? '#9ca3af' : '#6b7280';

  return (
    <div>
      <div className="relative h-[340px] w-full">
        {isEmpty && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400 pointer-events-none">
            No {mode === 'attributes' ? '' : `${STAT_NAMES[mode].toLowerCase()} `}progressions in this period
          </p>
        )}
        <ResponsiveContainer width="100%" height="100%" onResize={width => setChartWidth(width)}>
          <BarChart data={days} margin={{ top: 8, right: CHART_MARGIN_RIGHT, left: 0, bottom: 0 }} barCategoryGap={showRoomyBars ? '20%' : 0}>
            <CartesianGrid vertical={false} stroke={gridColor} />
            <XAxis
              dataKey="dayStart"
              tickFormatter={(dayStart: number) => formatDay(dayStart, crossesNewYear ? 'withYear' : 'short')}
              tick={{ fill: axisTextColor, fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: gridColor }}
              minTickGap={40}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: axisTextColor, fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={Y_AXIS_WIDTH}
            />
            <Tooltip
              content={<DayTooltip mode={mode} isDark={isDark} />}
              cursor={{ fill: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }}
              isAnimationActive={false}
            />
            {stats.map(stat => (
              <Bar
                key={stat}
                dataKey={stat}
                name={STAT_NAMES[stat]}
                stackId="progressions"
                fill={STAT_COLORS[stat][theme]}
                // A sliver of card surface separates stacked segments instead of an outline
                stroke={surface}
                strokeWidth={showSegmentGaps ? 1 : 0}
                radius={stats.length > 1 || !showRoomyBars ? 0 : [4, 4, 0, 0]}
                // Dense periods leave each day only a few pixels. Left to itself the chart rounds those
                // down to 1px hairlines, so give the bar most of its slot explicitly.
                barSize={showRoomyBars || barSlotWidth === 0 ? undefined : Math.max(1, barSlotWidth * 0.8)}
                maxBarSize={24}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {stats.length > 1 && (
        <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-3">
          {stats.map(stat => (
            <li key={stat} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: STAT_COLORS[stat][theme] }} />
              {STAT_LABELS[stat]} <span className="text-gray-400 dark:text-gray-500">{STAT_NAMES[stat]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PlayerProgressionDayTable({ days, mode }: { days: DailyProgression[]; mode: ProgressionChartMode }) {
  const stats = getChartStats(mode);
  const showTotal = stats.length > 1;

  return (
    <div className="max-h-[340px] overflow-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
        <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Day</th>
            {stats.map(stat => (
              <th key={stat} className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                {STAT_LABELS[stat]}
              </th>
            ))}
            {showTotal && (
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Total</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {[...days].reverse().map(day => (
            <tr key={day.dayStart}>
              <td className="px-3 py-1.5 whitespace-nowrap text-gray-900 dark:text-white">{formatDay(day.dayStart, 'full')}</td>
              {stats.map(stat => (
                <td key={stat} className="px-3 py-1.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{day[stat] || '–'}</td>
              ))}
              {showTotal && (
                <td className="px-3 py-1.5 text-right tabular-nums font-semibold text-gray-900 dark:text-white">{day.total || '–'}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
