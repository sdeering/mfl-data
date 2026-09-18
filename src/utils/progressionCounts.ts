import type { PlayerExperienceEntry } from '../types/playerExperience';

// Attribute stats a player can progress in. Overall is tracked separately: it moves as a
// consequence of these, so adding it to a total would double count.
export const ATTRIBUTE_STATS = ['pace', 'shooting', 'passing', 'dribbling', 'defense', 'physical', 'goalkeeping'] as const;
export type AttributeStat = typeof ATTRIBUTE_STATS[number];
export type ProgressionStat = AttributeStat | 'overall';

export const PROGRESSION_STATS: ProgressionStat[] = ['overall', ...ATTRIBUTE_STATS];

export const STAT_LABELS: Record<ProgressionStat, string> = {
  overall: 'OVR',
  pace: 'PAC',
  shooting: 'SHO',
  passing: 'PAS',
  dribbling: 'DRI',
  defense: 'DEF',
  physical: 'PHY',
  goalkeeping: 'GK'
};

export const STAT_NAMES: Record<ProgressionStat, string> = {
  overall: 'Overall',
  pace: 'Pace',
  shooting: 'Shooting',
  passing: 'Passing',
  dribbling: 'Dribbling',
  defense: 'Defense',
  physical: 'Physical',
  goalkeeping: 'Goalkeeping'
};

// Same hue per stat as the single-player progression chart (orange pace, teal dribbling, ...),
// stepped so every colour holds up on both the light and dark card surfaces.
export const STAT_COLORS: Record<ProgressionStat, { light: string; dark: string }> = {
  overall: { light: '#e87ba4', dark: '#d55181' },
  pace: { light: '#eb6834', dark: '#d95926' },
  dribbling: { light: '#1baf7a', dark: '#199e70' },
  goalkeeping: { light: '#eda100', dark: '#c98500' },
  defense: { light: '#2a78d6', dark: '#3987e5' },
  passing: { light: '#008300', dark: '#008300' },
  physical: { light: '#4a3aa7', dark: '#9085e9' },
  shooting: { light: '#e34948', dark: '#e66767' }
};

// Bottom-to-top order of the stacked chart. Chosen so neighbouring colours stay distinguishable
// for colour-blind readers in both themes - don't reorder without re-checking that.
export const STACK_ORDER: AttributeStat[] = ['pace', 'dribbling', 'goalkeeping', 'defense', 'passing', 'physical', 'shooting'];

export type ProgressionTotals = Partial<Record<ProgressionStat, number>>;

export interface ProgressionEvent {
  date: number; // Unix timestamp (ms)
  stat: ProgressionStat;
  points: number; // Stat points gained
}

/**
 * Turn an experience history into progression events. Each history entry only lists the stats that
 * changed, with their new value, so a progression is the gain over the last known value.
 */
export function getProgressionEvents(entries: PlayerExperienceEntry[]): ProgressionEvent[] {
  const sorted = [...entries].sort((a, b) => a.date - b.date);
  const lastKnown: Partial<Record<ProgressionStat, number>> = {};
  const events: ProgressionEvent[] = [];

  for (const entry of sorted) {
    for (const stat of PROGRESSION_STATS) {
      const value = entry.values[stat];
      if (typeof value !== 'number') continue;

      const previous = lastKnown[stat];
      if (previous !== undefined && value > previous) {
        events.push({ date: entry.date, stat, points: value - previous });
      }
      lastKnown[stat] = value;
    }
  }

  return events;
}

export function sumEvents(events: ProgressionEvent[]): ProgressionTotals {
  const totals: ProgressionTotals = {};
  for (const event of events) {
    totals[event.stat] = (totals[event.stat] ?? 0) + event.points;
  }
  return totals;
}

/** Stat points gained across every attribute (overall excluded). */
export function attributeTotal(totals: ProgressionTotals): number {
  return ATTRIBUTE_STATS.reduce((sum, stat) => sum + (totals[stat] ?? 0), 0);
}

/** Midnight at the start of the timestamp's day, in the viewer's own timezone. */
export function getDayStart(timestamp: number): number {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export type DailyProgression = { dayStart: number; total: number } & Record<ProgressionStat, number>;

/**
 * Bucket events into the last `days` calendar days, ending with the day containing `now`. Days
 * with no progressions are kept (as zeros) so the time axis stays evenly spaced.
 */
export function buildDailySeries(events: ProgressionEvent[], days: number, now: number = Date.now()): DailyProgression[] {
  const today = new Date(getDayStart(now));
  const series: DailyProgression[] = [];
  const byDayStart = new Map<number, DailyProgression>();

  // Step by calendar day rather than by 24 hours, so daylight-saving changes don't skew a day
  for (let offset = days - 1; offset >= 0; offset--) {
    const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset).getTime();
    const day = { dayStart, total: 0 } as DailyProgression;
    for (const stat of PROGRESSION_STATS) day[stat] = 0;
    series.push(day);
    byDayStart.set(dayStart, day);
  }

  for (const event of events) {
    const day = byDayStart.get(getDayStart(event.date));
    if (!day) continue;

    day[event.stat] += event.points;
    if (event.stat !== 'overall') day.total += event.points;
  }

  return series;
}
