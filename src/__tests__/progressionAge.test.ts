import { processProgressionData, getCurrentAge } from '../services/playerExperienceService';
import type { PlayerExperienceEntry } from '../types/playerExperience';

const day = (iso: string) => new Date(`${iso}T00:00:00Z`).getTime();
const entry = (iso: string, values: Record<string, number>) => ({ date: day(iso), values } as unknown as PlayerExperienceEntry);

describe('progression ages', () => {
  // Player 264240: minted at 21 in an off-season, so the first birthday came almost 8 months later
  const history = () => [
    entry('2025-12-16', { age: 21, overall: 79, dribbling: 73 }),
    entry('2026-07-07', { overall: 80, dribbling: 74 }),
    entry('2026-08-03', { age: 22 }),
    entry('2026-09-14', { age: 23 }),
  ];

  it('places attribute changes between the birthdays actually recorded, not by calendar time', () => {
    const data = processProgressionData(history());

    expect(data).toHaveLength(2);
    expect(data[0].age).toBe(21);
    // 1 year per 42 days of calendar time would have made this 25.8
    expect(data[1].age).toBeGreaterThan(21);
    expect(data[1].age).toBeLessThan(22);
  });

  it('never runs past the next birthday after the last recorded one', () => {
    const data = processProgressionData([
      entry('2026-01-01', { age: 30, overall: 70 }),
      entry('2026-12-01', { overall: 71 }),
    ]);

    expect(data[1].age).toBeGreaterThan(30);
    expect(data[1].age).toBeLessThan(31);
  });

  it('reports the latest recorded age', () => {
    expect(getCurrentAge(history())).toBe(23);
    expect(getCurrentAge([])).toBeUndefined();
  });
});
