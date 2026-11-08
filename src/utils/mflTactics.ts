import { MAX_LOGGED_PLAYERS, type PlayerSettings, type TacticSettings } from './tacticsHistory';

/*
 * MFL's own tactics, as a match report shows them to the club's owner, turned into the steps our tactics log keeps.
 * MFL keeps each setting as a value around 1 (null for the middle step); the values of its five steps are MFL's
 * own, read from the MFL app on 2026-11-09. Expert mode can set values between steps, so values snap to the nearest.
 */

/** Our setting key, MFL's key and the values of MFL's steps 1 to 5 */
const TEAM: [ours: string, mfl: string, values: number[]][] = [
  ['attackingWidth', 'width', [0, 0.5, 1, 1.5, 2]],
  ['directness', 'directness', [0.7, 0.85, 1, 1.15, 1.3]],
  // Step 1 prioritises the left flank
  ['flankPreference', 'sideAttackLeft', [1.5, 1.25, 1, 0.75, 0.5]],
  ['shooting', 'farShot', [0, 0.5, 1, 1.5, 2]],
  ['crossing', 'crosses', [0.5, 0.75, 1, 1.25, 1.5]],
  ['dribbling', 'dribble', [0.5, 0.75, 1, 1.25, 1.5]],
  ['attackTendency', 'offensiveEngagement', [0, 0.5, 1, 1.5, 2]],
  ['teamDepth', 'depth', [0.7, 0.85, 1, 1.15, 1.3]],
  // Step 1 is the tight block
  ['compactness', 'compactness', [1.3, 1.15, 1, 0.85, 0.7]],
  ['triggerPress', 'pressing', [0.5, 0.75, 1, 1.25, 1.5]],
  ['aggressiveness', 'aggressivity', [0, 0.5, 1, 1.5, 2]],
  ['clearances', 'clearance', [0, 0.5, 1, 1.5, 2]],
];

const valuesOf = (mfl: string) => TEAM.find(([, key]) => key === mfl)![2];

/** Individual instructions: our key, MFL's group and key, and its step values */
const PLAYER: [ours: string, group: 'off' | 'def', mfl: string, values: number[]][] = [
  ['directness', 'off', 'directness', valuesOf('directness')],
  ['shooting', 'off', 'farShot', valuesOf('farShot')],
  ['crossing', 'off', 'crosses', valuesOf('crosses')],
  ['dribbling', 'off', 'dribble', valuesOf('dribble')],
  ['attackTendency', 'off', 'offensiveEngagement', valuesOf('offensiveEngagement')],
  ['passingRisk', 'off', 'riskPass', [0, 0.5, 1, 1.5, 2]],
  ['positionFreedom', 'off', 'fluidity', [0, 0.5, 1, 1.5, 2]],
  ['triggerPress', 'def', 'pressing', valuesOf('pressing')],
  ['aggressiveness', 'def', 'aggressivity', valuesOf('aggressivity')],
  ['clearances', 'def', 'clearance', valuesOf('clearance')],
];

/** A side's formation in a match report, as MFL shows it to the club's owner */
export interface ReportFormation {
  type?: string;
  /** Individual instructions by the player's index in the formation, 0 to 10 the XI */
  playersInstructions?: Record<string, { off?: Record<string, number | null>; def?: Record<string, number | null> } | null>;
  [setting: string]: unknown;
}

/** The step, 1 to 5, whose value is nearest */
export function stepOf(values: number[], value: number): number {
  let best = 0;
  values.forEach((stepValue, index) => {
    if (Math.abs(stepValue - value) < Math.abs(values[best] - value)) best = index;
  });
  return best + 1;
}

const number = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

/** The team's twelve settings as steps; a setting MFL leaves null is on its middle step */
export function teamSettingsFrom(formation: ReportFormation): TacticSettings {
  return Object.fromEntries(TEAM.map(([ours, mfl, values]) => [ours, stepOf(values, number(formation[mfl]) ?? 1)]));
}

/**
 * Individual instructions as steps, by player ID: MFL keys them by the player's index in the formation, so they
 * need the match's positions. Players without any, or not found in the XI, are left out.
 */
export function playerSettingsFrom(formation: ReportFormation, playerIdAt: (index: number) => number | undefined): PlayerSettings {
  const players: PlayerSettings = {};
  for (const [index, instructions] of Object.entries(formation.playersInstructions ?? {})) {
    const playerId = playerIdAt(Number(index));
    if (!instructions || playerId === undefined || Number(index) >= MAX_LOGGED_PLAYERS) continue;
    const own: TacticSettings = {};
    for (const [ours, group, mfl, values] of PLAYER) {
      const value = number(instructions[group]?.[mfl]);
      if (value !== null) own[ours] = stepOf(values, value);
    }
    if (Object.keys(own).length) players[String(playerId)] = own;
  }
  return players;
}

const sameSteps = (a: TacticSettings, b: TacticSettings) => Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([key, step]) => b[key] === step);

/** Whether two logs of a match hold the same settings and the same individual instructions */
export function sameTactics(a: { settings: TacticSettings; players: PlayerSettings }, b: { settings: TacticSettings; players: PlayerSettings }): boolean {
  const ids = Object.keys(a.players);
  return (
    sameSteps(a.settings, b.settings) && ids.length === Object.keys(b.players).length && ids.every(id => b.players[id] !== undefined && sameSteps(a.players[id], b.players[id]))
  );
}
