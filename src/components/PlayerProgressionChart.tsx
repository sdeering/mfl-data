'use client';

import React, { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  STACK_ORDER,
  STAT_LABELS,
  STAT_NAMES,
  type ChartSeries,
  type DailyProgression
} from '../utils/progressionCounts';
import { tableClass, thClass } from './ui';

// 'attributes' stacks every attribute stat (overall excluded); otherwise a single series is charted
export type ProgressionChartMode = 'attributes' | ChartSeries;

// One colour per stat, the same in both themes. Both measures of overall share one: they are never charted together.
export const SERIES_COLORS: Record<ChartSeries, string> = {
  pace: '#f97316',
  dribbling: '#14b8a6',
  goalkeeping: '#eab308',
  defense: '#3b82f6',
  passing: '#22c55e',
  physical: '#a78bfa',
  shooting: '#f05a5a',
  overall: '#f0569a',
  overallPoints: '#f0569a'
};

interface PlayerProgressionChartProps {
  days: DailyProgression[];
  mode: ProgressionChartMode;
}

// "16 Jun" on the axis ("16 Jun 25" when the period crosses a new year); "Tue 16 Jun 2026" in full
const formatDay = (dayStart: number, style: 'short' | 'withYear' | 'full' = 'short') =>
  new Date(dayStart).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(style === 'withYear' ? { year: '2-digit' } : {}),
    ...(style === 'full' ? { weekday: 'short', year: 'numeric' } : {})
  });

/** Clean axis ticks for decimal values (0, 0.5, 1, ...) - left alone, the chart picks steps like 0.65. */
function getDecimalTicks(max: number): number[] {
  const steps = [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100];
  const step = steps.find(candidate => max / candidate <= 4) ?? steps[steps.length - 1];
  const count = Math.max(1, Math.ceil(max / step));
  return Array.from({ length: count + 1 }, (_, i) => Math.round(i * step * 100) / 100);
}

const MIN_BAR_WIDTH_FOR_GAPS = 8; // Narrower than this, spacing and gaps between stacked segments would swallow the bar
const Y_AXIS_WIDTH = 36;
const CHART_MARGIN_RIGHT = 8;

export const getChartStats = (mode: ProgressionChartMode): ChartSeries[] =>
  mode === 'attributes' ? STACK_ORDER : [mode];

// Overall points are decimals ("+0.23"); everything else counts whole stat points
const formatValue = (value: number, series: ChartSeries) => (series === 'overallPoints' ? `+${value.toFixed(2)}` : String(value));

function DayTooltip({ active, payload, mode }: any) {
  const day: DailyProgression | undefined = payload?.[0]?.payload;
  if (!active || !day) return null;

  const stats = getChartStats(mode).filter(stat => day[stat] > 0);

  return (
    <div className="rounded-2xl border border-line-2 bg-panel px-3.5 py-2.5 shadow-[0_20px_50px_rgba(0,0,0,.45)] text-sm">
      <p className="mt-0 mb-1.5 text-xs font-semibold text-muted">{formatDay(day.dayStart, 'full')}</p>
      {stats.length === 0 ? (
        <p className="m-0 text-fg-3">No progressions</p>
      ) : (
        <>
          {[...stats].reverse().map(stat => (
            <div key={stat} className="flex items-center gap-2">
              <span className="w-[9px] h-[9px] rounded-[3px]" style={{ backgroundColor: SERIES_COLORS[stat] }} />
              <span className="font-display font-bold text-fg tabular-nums">{formatValue(day[stat], stat)}</span>
              <span className="text-fg-3">{STAT_NAMES[stat]}</span>
            </div>
          ))}
          {mode === 'attributes' && stats.length > 1 && (
            <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-line">
              <span className="w-[9px]" />
              <span className="font-display font-bold text-fg tabular-nums">{day.total}</span>
              <span className="text-fg-3">Total</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function PlayerProgressionChart({ days, mode }: PlayerProgressionChartProps) {
  const [chartWidth, setChartWidth] = useState(0);
  const stats = getChartStats(mode);

  const barSlotWidth = days.length > 0 ? Math.max(0, chartWidth - Y_AXIS_WIDTH - CHART_MARGIN_RIGHT) / days.length : 0;
  const showRoomyBars = barSlotWidth >= MIN_BAR_WIDTH_FOR_GAPS;
  const showSegmentGaps = stats.length > 1 && showRoomyBars;
  const isEmpty = days.every(day => stats.every(stat => day[stat] === 0));
  const decimalTicks = mode === 'overallPoints' && !isEmpty ? getDecimalTicks(Math.max(...days.map(day => day.overallPoints))) : undefined;
  const crossesNewYear = days.length > 0 && new Date(days[0].dayStart).getFullYear() !== new Date(days[days.length - 1].dayStart).getFullYear();

  return (
    <div className="flex flex-col gap-4">
      <div className="relative h-[340px] w-full">
        {isEmpty && (
          <p className="absolute inset-0 m-0 flex items-center justify-center text-sm font-medium text-muted pointer-events-none">
            {mode === 'overallPoints'
              ? 'No overall points gained in this period'
              : `No ${mode === 'attributes' ? '' : `${STAT_NAMES[mode].toLowerCase()} `}progressions in this period`}
          </p>
        )}
        <ResponsiveContainer width="100%" height="100%" onResize={width => setChartWidth(width)}>
          <BarChart data={days} margin={{ top: 8, right: CHART_MARGIN_RIGHT, left: 0, bottom: 0 }} barCategoryGap={showRoomyBars ? '20%' : 0}>
            <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="4 4" />
            <XAxis
              dataKey="dayStart"
              tickFormatter={(dayStart: number) => formatDay(dayStart, crossesNewYear ? 'withYear' : 'short')}
              tick={{ fill: 'var(--muted3)', fontSize: 11, fontWeight: 500 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--line)' }}
              minTickGap={40}
            />
            <YAxis
              allowDecimals={mode === 'overallPoints'}
              ticks={decimalTicks}
              domain={decimalTicks ? [0, decimalTicks[decimalTicks.length - 1]] : undefined}
              tick={{ fill: 'var(--muted3)', fontSize: 11, fontWeight: 500, className: 'font-mono' }}
              tickLine={false}
              axisLine={false}
              width={Y_AXIS_WIDTH}
            />
            <Tooltip
              content={<DayTooltip mode={mode} />}
              cursor={{ fill: 'rgba(var(--glass-rgb), 0.05)' }}
              isAnimationActive={false}
            />
            {stats.map(stat => (
              <Bar
                key={stat}
                dataKey={stat}
                name={STAT_NAMES[stat]}
                stackId="progressions"
                fill={SERIES_COLORS[stat]}
                // A sliver of panel colour separates stacked segments instead of an outline
                stroke="var(--panel)"
                strokeWidth={showSegmentGaps ? 1 : 0}
                radius={showRoomyBars ? 3 : 0}
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
        <ul className="m-0 p-0 list-none flex flex-wrap justify-center gap-x-[18px] gap-y-1.5">
          {stats.map(stat => (
            <li key={stat} className="flex items-center gap-1.5 text-xs font-bold text-fg-2">
              <span className="w-[9px] h-[9px] rounded-[3px]" style={{ backgroundColor: SERIES_COLORS[stat] }} />
              {STAT_LABELS[stat]} <span className="font-medium text-muted-3">{STAT_NAMES[stat]}</span>
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
    <div className="max-h-[340px] overflow-auto rounded-2xl border border-line">
      <table className={tableClass}>
        <thead className="sticky top-0">
          <tr className="bg-thead border-b border-line">
            <th className={thClass}>Day</th>
            {stats.map(stat => (
              <th key={stat} className={`${thClass} text-right`}>
                {STAT_LABELS[stat]}
              </th>
            ))}
            {showTotal && <th className={`${thClass} text-right`}>Total</th>}
          </tr>
        </thead>
        <tbody>
          {[...days].reverse().map(day => (
            <tr key={day.dayStart} className="border-b border-divider last:border-b-0 hover:bg-row-hover transition-colors text-sm">
              <td className="px-3 py-2 whitespace-nowrap font-medium text-fg">{formatDay(day.dayStart, 'full')}</td>
              {stats.map(stat => (
                <td key={stat} className="px-3 py-2 text-right tabular-nums text-fg-2">
                  {day[stat] ? formatValue(day[stat], stat) : <span className="text-faint-2">–</span>}
                </td>
              ))}
              {showTotal && (
                <td className="px-3 py-2 text-right tabular-nums font-display font-bold text-fg">{day.total || <span className="text-faint-2">–</span>}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
