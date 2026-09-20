import { processProgressionData, getCurrentAge } from '../services/playerExperienceService';
import type { PlayerExperienceEntry } from '../types/playerExperience';

const DAY = 24 * 60 * 60 * 1000;
const at = (iso: string) => new Date(iso).getTime();

const initial = (iso: string, age: number, overall = 66): PlayerExperienceEntry => ({
  date: at(iso),
  values: { age, overall, pace: 53, dribbling: 72, passing: 51, shooting: 70, defense: 27, physical: 52 },
});
const newAge = (iso: string, age: number): PlayerExperienceEntry => ({ date: at(iso), values: { age } });
const stat = (iso: string, values: PlayerExperienceEntry['values']): PlayerExperienceEntry => ({
  date: at(iso),
  values,
});

// Shape of player 218145's history: minted 9 months before its first stat change, then a
// NEW_AGE every 42 days. The last entry is a NEW_AGE, i.e. the player is 22.
const player218145 = (): PlayerExperienceEntry[] => [
  initial('2025-08-13T13:33:32Z', 19),
  stat('2026-05-22T08:05:00Z', { passing: 52 }),
  stat('2026-06-09T08:05:00Z', { overall: 69, shooting: 75 }),
  newAge('2026-06-22T16:04:04Z', 20),
  stat('2026-07-21T15:56:00Z', { overall: 71, dribbling: 76 }),
  newAge('2026-08-03T11:42:08Z', 21),
  stat('2026-08-28T18:54:00Z', { overall: 73, shooting: 79 }),
  stat('2026-09-05T08:07:00Z', { passing: 60, physical: 56 }),
  newAge('2026-09-14T10:20:28Z', 22),
];

describe('processProgressionData ages', () => {
  it('does not count the gap between the initial snapshot and the first NEW_AGE as extra years', () => {
    const data = processProgressionData(player218145());
    const ages = data.map(d => d.age as number);

    // Regression: 397 days at 1 year / 42 days used to produce ages up to ~28.5
    expect(Math.max(...ages)).toBeLessThan(22);
    expect(Math.min(...ages)).toBe(19);
  });

  it('keeps every point inside the age window set by the surrounding real ages', () => {
    const data = processProgressionData(player218145());
    const ageOn = (iso: string) => data.find(d => d.date.getTime() === at(iso))!.age as number;

    expect(ageOn('2025-08-13T13:33:32Z')).toBe(19);
    expect(ageOn('2026-05-22T08:05:00Z')).toBeGreaterThanOrEqual(19);
    expect(ageOn('2026-06-09T08:05:00Z')).toBeLessThan(20);
    expect(ageOn('2026-07-21T15:56:00Z')).toBeGreaterThan(20);
    expect(ageOn('2026-07-21T15:56:00Z')).toBeLessThan(21);
    expect(ageOn('2026-09-05T08:07:00Z')).toBeGreaterThan(21);
    expect(ageOn('2026-09-05T08:07:00Z')).toBeLessThan(22);
  });

  it('counts the long first gap back from the first NEW_AGE at 42 days per year', () => {
    const data = processProgressionData(player218145());
    const ageOn = (iso: string) => data.find(d => d.date.getTime() === at(iso))!.age as number;

    // 31 days before the age-20 birthday
    const expected = 20 - (at('2026-06-22T16:04:04Z') - at('2026-05-22T08:05:00Z')) / (42 * DAY);
    expect(ageOn('2026-05-22T08:05:00Z')).toBeCloseTo(expected, 6);
  });

  it('never goes backwards over time', () => {
    const ages = processProgressionData(player218145()).map(d => d.age as number);
    expect([...ages].sort((a, b) => a - b)).toEqual(ages);
  });

  it('is exact at the initial snapshot even when the first NEW_AGE is under a year away', () => {
    const data = processProgressionData([
      initial('2024-11-26T00:00:00Z', 18),
      newAge('2024-12-17T00:00:00Z', 19), // 21 days later, like a young mint
      stat('2024-12-30T00:00:00Z', { overall: 67 }),
    ]);

    expect(data[0].age).toBe(18);
    expect(data[1].age).toBeGreaterThan(19);
    expect(data[1].age).toBeLessThan(20);
  });

  it('counts forward from the last NEW_AGE at 42 days per year', () => {
    const data = processProgressionData([
      initial('2026-01-01T00:00:00Z', 30),
      newAge('2026-02-12T00:00:00Z', 31),
      stat('2026-03-05T00:00:00Z', { overall: 70 }), // 21 days after the birthday
    ]);

    expect(data[data.length - 1].age).toBeCloseTo(31.5, 6);
  });

  it('falls back to counting from the first entry when the history has no ages', () => {
    const data = processProgressionData([
      stat('2026-01-01T00:00:00Z', { overall: 60 }),
      stat('2026-01-22T00:00:00Z', { overall: 61 }),
    ]);

    expect(data.map(d => d.age)).toEqual([0, 0.5]);
  });

  it('still carries stats forward across dropped age-only entries', () => {
    const data = processProgressionData(player218145());
    const last = data[data.length - 1];

    expect(data).toHaveLength(6); // 9 entries, minus the three age-only NEW_AGE ones
    expect(last.overall).toBe(73);
    expect(last.passing).toBe(60);
    expect(last.shooting).toBe(79);
  });
});

describe('getCurrentAge', () => {
  it('returns the real age when the latest entry is a NEW_AGE', () => {
    expect(getCurrentAge(player218145())).toBe(22);
  });

  it('adds the time elapsed since the last NEW_AGE when a stat change follows it', () => {
    const history = [...player218145(), stat('2026-09-14T10:20:28Z', { defense: 36 })];
    expect(getCurrentAge(history)).toBe(22);

    history.push(stat('2026-10-05T10:20:28Z', { defense: 37 })); // 21 days later
    expect(getCurrentAge(history)).toBeCloseTo(22.5, 6);
  });

  it('is undefined for an empty history', () => {
    expect(getCurrentAge([])).toBeUndefined();
  });

  it('does not reorder the caller\'s array', () => {
    const history = player218145().reverse();
    const snapshot = history.map(e => e.date);

    getCurrentAge(history);

    expect(history.map(e => e.date)).toEqual(snapshot);
  });
});
