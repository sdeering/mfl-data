import { ANALYSIS_SCHEMA, describeFixtures, type UpcomingFixture } from '../services/matchAnalysis';

const DAY = 24 * 3600 * 1000;
const start = Date.UTC(2026, 10, 20, 21, 45);

const fixture = (matchId: number, days: number, type: string, extra: Partial<UpcomingFixture> = {}): UpcomingFixture => ({
  matchId,
  startDate: start + days * DAY,
  competition: type === 'CUP' ? 'Elites Cup – Tier 1' : 'Silver – League 4',
  type,
  opponent: `Club ${matchId}`,
  home: matchId % 2 === 0,
  ...extra,
});

describe('upcoming fixtures for the AI analysis', () => {
  it('dates each fixture against the match analysed, in order, and marks it', () => {
    const described = describeFixtures([fixture(3, 2, 'CUP'), fixture(1, 0, 'LEAGUE'), fixture(2, 1, 'LEAGUE')], 2);
    expect(described.map(item => item.daysFromThisMatch)).toEqual([-1, 0, 1]);
    expect(described.map(item => item.kind)).toEqual(['league', 'league', 'cup']);
    expect(described[1].thisMatch).toBe(true);
    expect(described[0].thisMatch).toBeUndefined();
    expect(described[2].date).toBe('2026-11-22');
  });

  it('dates against now without a fixture, and flags competitions without fatigue', () => {
    const described = describeFixtures([fixture(4, 1, 'CUP', { noFatigue: true })], null, start);
    expect(described[0].daysFromThisMatch).toBe(1);
    expect(described[0].fatigueOff).toBe(true);
    expect(described.some(item => item.thisMatch)).toBe(false);
  });

  it('is empty without fixtures', () => {
    expect(describeFixtures(undefined, 5)).toEqual([]);
  });

  it('asks Gemini for a fixture plan', () => {
    expect(ANALYSIS_SCHEMA.required).toContain('rotation');
  });
});
