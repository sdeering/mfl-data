import type { MFLPlayer } from '../types/mflApi';
import { squadFits, type Outcome, type PlayedMatch } from '../utils/formationPlanner';
import { compareSquads, describeFormation, findWeaknesses, xiPlayers, type XiPlayer } from '../utils/squadComparison';
import { CAPTAIN_OVR, captainOptions, describeBonus } from '../utils/captain';
import { FORMATIONS, FORMATION_NAMES, formationLabel } from '../utils/squadLineups';
import type { ScoutMatch, ScoutReport } from './scoutService';
import {
  adviceAgreement,
  adviceRecord,
  playerSettingEffects,
  recordOf,
  settingEffects,
  similarMatches,
  type PlayerSettings,
  type TacticsHistory,
} from '../utils/tacticsHistory';

/*
 * The AI match analysis on the Matches page: what the page asks for, what comes back, and the prompt the server
 * builds from both clubs' scout reports and their recent match stats.
 */

/** One of our counters as the planner ranked it, sent along so the AI sees the meta's numbers */
export interface RankedCounter {
  formation: string;
  win: number;
  draw: number;
  loss: number;
  points: number;
  /** Goals expected for and against, missing from requests made before aims */
  goalsFor?: number;
  goalsAgainst?: number;
}

export interface MatchAnalysisRequest {
  ourClubId: number;
  theirClubId: number;
  ourFormation: string;
  theirFormation: string;
  counters?: RankedCounter[];
  /** What we want from the match, 'win' when missing */
  aim?: Outcome;
  /** The fixture it's for, and the connected wallet: when that owns our club, the advice is kept for the match */
  matchId?: number;
  walletAddress?: string;
}

/** What each aim asks of the analysis */
export const AIM_BRIEFS: Record<Outcome, string> = {
  win: 'Our aim is to win: pick what gives us the most expected points.',
  smash: 'Our aim is to smash them: score as many goals as we can, accepting more risk at the back. Favour the formation, captain and playing style that create the most chances, and say what we risk.',
  notLose: 'Our aim is not to lose: a draw is a good result. Pick what gives us the lowest chance of losing, even at the cost of goals and winning chances: a solid shape, a captain who strengthens the defence and a playing style that keeps us compact and denies their strengths. Say how we can still nick a goal.',
};

/** Steps on each playing style setting, as MFL's Steps view shows them; the middle one is MFL's default */
export const TACTIC_STEPS = 5;

export interface TacticSetting {
  key: string;
  label: string;
  group: 'in' | 'out';
  /** What step 1 and the last step mean, as MFL labels the ends of the slider */
  low: string;
  high: string;
}

/** MFL's playing style settings: how the team attacks (in possession) and defends (out of possession) */
export const TACTIC_SETTINGS: TacticSetting[] = [
  { key: 'attackingWidth', label: 'Attacking Width', group: 'in', low: 'Very narrow', high: 'Very wide' },
  { key: 'directness', label: 'Directness', group: 'in', low: 'Controlled', high: 'Direct' },
  { key: 'flankPreference', label: 'Flank Preference', group: 'in', low: 'Prioritise left flank', high: 'Prioritise right flank' },
  { key: 'shooting', label: 'Shooting', group: 'in', low: 'Shoot less often', high: 'Shoot more often' },
  { key: 'crossing', label: 'Crossing', group: 'in', low: 'Cross less often', high: 'Cross more often' },
  { key: 'dribbling', label: 'Dribbling', group: 'in', low: 'Dribble less often', high: 'Dribble more often' },
  { key: 'attackTendency', label: 'Attack Tendency', group: 'in', low: 'More defensive', high: 'More offensive' },
  { key: 'teamDepth', label: 'Team Depth', group: 'out', low: 'Low', high: 'High' },
  { key: 'compactness', label: 'Compactness', group: 'out', low: 'Tight block', high: 'Spread out' },
  { key: 'triggerPress', label: 'Trigger Press', group: 'out', low: 'Less often', high: 'More often' },
  { key: 'aggressiveness', label: 'Aggressiveness', group: 'out', low: 'Less aggressive', high: 'More aggressive' },
  { key: 'clearances', label: 'Clearances', group: 'out', low: 'Play out of defence', high: 'Clear the ball often' },
];

const teamSetting = (key: string) => TACTIC_SETTINGS.find(setting => setting.key === key)!;

/**
 * MFL's Individual Instructions: per player, each overrides the team's step (or follows it, "TEAM"). Passing Risk
 * and Position Freedom exist only per player.
 */
export const PLAYER_SETTINGS: TacticSetting[] = [
  teamSetting('directness'),
  teamSetting('shooting'),
  teamSetting('crossing'),
  teamSetting('dribbling'),
  teamSetting('attackTendency'),
  { key: 'passingRisk', label: 'Passing Risk', group: 'in', low: 'Conservative', high: 'Risky' },
  { key: 'positionFreedom', label: 'Position Freedom', group: 'in', low: 'Low', high: 'High' },
  teamSetting('triggerPress'),
  teamSetting('aggressiveness'),
  teamSetting('clearances'),
];

/** Player settings with no team step to follow, which start in the middle */
export const PLAYER_ONLY_SETTINGS = new Set(['passingRisk', 'positionFreedom']);

/** Most key players the analysis gives instructions for */
export const MAX_PLAYER_INSTRUCTIONS = 4;

export interface PlayerInstruction {
  playerId: number;
  /** Their position in our XI, e.g. LM */
  position: string;
  name: string;
  /** Their role in the plan */
  reason: string;
  /** Only the settings to change from the team's step; the rest stay on TEAM */
  settings: TacticPick[];
}

export interface TacticPick {
  key: string;
  /** 1 to TACTIC_STEPS */
  step: number;
  reason: string;
}

export interface MatchAnalysis {
  summary: string;
  formation: { pick: string; reason: string };
  /** Who to captain, missing from analyses made before captains were weighed */
  captain?: { player: string; reason: string };
  attack: { title: string; detail: string }[];
  defend: { title: string; detail: string }[];
  matchups: { ours: string; theirs: string; edge: 'ours' | 'theirs' | 'even'; note: string }[];
  lineup: { position: string; change: string; reason: string }[];
  /** One sentence on the playing style, and a step for each setting; missing from analyses made before settings existed */
  styleSummary?: string;
  tactics?: TacticPick[];
  /** What our logged matches say, empty when none are logged */
  historyNotes?: { title: string; detail: string }[];
  /** Individual instructions for our key players; missing from analyses made before them */
  players?: PlayerInstruction[];
}

/** Gemini's response schema for a MatchAnalysis */
export const ANALYSIS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    summary: { type: 'STRING', description: 'Two or three sentences: how the match is likely to go and the main edge' },
    formation: {
      type: 'OBJECT',
      properties: {
        pick: { type: 'STRING', enum: FORMATION_NAMES, description: 'The formation to play, by its key' },
        reason: { type: 'STRING' },
      },
      required: ['pick', 'reason'],
    },
    captain: {
      type: 'OBJECT',
      description: 'Who to captain in our XI, from us.captainOptions',
      properties: {
        player: { type: 'STRING', description: 'Our player as "POS Name"' },
        reason: { type: 'STRING', description: 'Why, weighing the XI rating gain against the team bonus this matchup needs' },
      },
      required: ['player', 'reason'],
    },
    attack: {
      type: 'ARRAY',
      description: 'Where and how to attack them, most important first, 2 to 4 items',
      items: { type: 'OBJECT', properties: { title: { type: 'STRING' }, detail: { type: 'STRING' } }, required: ['title', 'detail'] },
    },
    defend: {
      type: 'ARRAY',
      description: 'Their threats and how to blunt them, 1 to 3 items',
      items: { type: 'OBJECT', properties: { title: { type: 'STRING' }, detail: { type: 'STRING' } }, required: ['title', 'detail'] },
    },
    matchups: {
      type: 'ARRAY',
      description: 'The 3 to 5 individual duels that decide the match',
      items: {
        type: 'OBJECT',
        properties: {
          ours: { type: 'STRING', description: 'Our player as "POS Name (rating)"' },
          theirs: { type: 'STRING', description: 'Their player as "POS Name (rating)"' },
          edge: { type: 'STRING', enum: ['ours', 'theirs', 'even'] },
          note: { type: 'STRING' },
        },
        required: ['ours', 'theirs', 'edge', 'note'],
      },
    },
    lineup: {
      type: 'ARRAY',
      description: 'Changes to our XI worth making, using only players listed in our squad; empty if none',
      items: {
        type: 'OBJECT',
        properties: { position: { type: 'STRING' }, change: { type: 'STRING' }, reason: { type: 'STRING' } },
        required: ['position', 'change', 'reason'],
      },
    },
    styleSummary: { type: 'STRING', description: 'One sentence on the playing style these settings add up to' },
    tactics: {
      type: 'ARRAY',
      description: `A step from 1 to ${TACTIC_STEPS} for every playing style setting, each key once`,
      items: {
        type: 'OBJECT',
        properties: {
          key: { type: 'STRING', enum: TACTIC_SETTINGS.map(setting => setting.key) },
          step: { type: 'INTEGER', description: `1 is the low end of the setting, ${TACTIC_STEPS} the high end` },
          reason: { type: 'STRING', description: 'One short sentence tied to the data' },
        },
        required: ['key', 'step', 'reason'],
      },
    },
    players: {
      type: 'ARRAY',
      description: `Individual instructions for 2 to ${MAX_PLAYER_INSTRUCTIONS} of our key players in the XI, most important first`,
      items: {
        type: 'OBJECT',
        properties: {
          playerId: { type: 'INTEGER', description: 'The id of our player, from us.startingXi' },
          position: { type: 'STRING', description: 'Their position in our XI, e.g. "LM"' },
          name: { type: 'STRING', description: 'Their name as in us.startingXi' },
          reason: { type: 'STRING', description: 'One or two sentences: their job in this match and who they face, citing attributes' },
          settings: {
            type: 'ARRAY',
            description: "Only the settings to set differently from the team's step for this player, 1 to 5 of them; the rest stay on TEAM",
            items: {
              type: 'OBJECT',
              properties: {
                key: { type: 'STRING', enum: PLAYER_SETTINGS.map(setting => setting.key) },
                step: { type: 'INTEGER', description: `1 is the low end of the setting, ${TACTIC_STEPS} the high end` },
                reason: { type: 'STRING', description: 'One short sentence tied to the data' },
              },
              required: ['key', 'step', 'reason'],
            },
          },
        },
        required: ['playerId', 'position', 'name', 'reason', 'settings'],
      },
    },
    historyNotes: {
      type: 'ARRAY',
      description: 'What our logged matches (ourTacticsLog) say about the settings to use here, citing results and xG; empty if none are logged',
      items: { type: 'OBJECT', properties: { title: { type: 'STRING' }, detail: { type: 'STRING' } }, required: ['title', 'detail'] },
    },
  },
  required: ['summary', 'formation', 'captain', 'attack', 'defend', 'matchups', 'lineup', 'styleSummary', 'tactics', 'players', 'historyNotes'],
} as const;

/** A player's line in a match report from MFL's /matches/{id}/report */
export interface ReportPlayerStats {
  playerId: number;
  position: string;
  time: number;
  rating: number;
  goals: number;
  assists: number;
  shots: number;
  shotsOnTarget: number;
  xG: number;
  chancesCreated: number;
  passes: number;
  passesAccurate: number;
  crosses: number;
  crossesAccurate: number;
  dribblingSuccess: number;
  dribbledPast: number;
  defensiveDuelsWon: number;
  clearances: number;
  saves: number;
  goalsConceded: number;
  yellowCards: number;
  redCards: number;
}

export interface MatchReport {
  home: { playersStats: ReportPlayerStats[] };
  away: { playersStats: ReportPlayerStats[] };
}

/** A club's side of one match report, with whether the club was at home */
export interface SideReport {
  matchId: number;
  ours: ReportPlayerStats[];
  opponents: ReportPlayerStats[];
}

/** Per-player averages over the matches given, and the team's shots and xG for and against each match */
export function summariseReports(reports: SideReport[], playersById: Map<number, MFLPlayer>) {
  const players = new Map<number, ReportPlayerStats[]>();
  for (const report of reports) {
    for (const line of report.ours) players.set(line.playerId, [...(players.get(line.playerId) ?? []), line]);
  }
  const sum = (lines: ReportPlayerStats[], key: keyof ReportPlayerStats) => lines.reduce((total, line) => total + (Number(line[key]) || 0), 0);
  const round = (value: number, places = 1) => Math.round(value * 10 ** places) / 10 ** places;
  return {
    players: [...players.entries()]
      .map(([id, lines]) => {
        const player = playersById.get(id);
        return {
          name: player ? `${player.metadata.firstName} ${player.metadata.lastName}` : `Player ${id}`,
          positions: [...new Set(lines.map(line => line.position))].join('/'),
          games: lines.length,
          avgMatchRating: round(sum(lines, 'rating') / lines.length, 2),
          goals: sum(lines, 'goals'),
          assists: sum(lines, 'assists'),
          xG: round(sum(lines, 'xG'), 2),
          shots: sum(lines, 'shots'),
          chancesCreated: sum(lines, 'chancesCreated'),
          passAccuracy: sum(lines, 'passes') ? Math.round((sum(lines, 'passesAccurate') / sum(lines, 'passes')) * 100) : null,
          dribblesWon: sum(lines, 'dribblingSuccess'),
          dribbledPast: sum(lines, 'dribbledPast'),
          defensiveDuelsWon: sum(lines, 'defensiveDuelsWon'),
          saves: sum(lines, 'saves'),
          cards: sum(lines, 'yellowCards') + sum(lines, 'redCards'),
        };
      })
      .sort((a, b) => b.games - a.games || b.avgMatchRating - a.avgMatchRating),
    matches: reports.map(report => ({
      matchId: report.matchId,
      shotsFor: sum(report.ours, 'shots'),
      xGFor: round(sum(report.ours, 'xG'), 2),
      shotsAgainst: sum(report.opponents, 'shots'),
      xGAgainst: round(sum(report.opponents, 'xG'), 2),
    })),
  };
}

const describeXi = (xi: XiPlayer[], withIds = false) =>
  xi.map(player => ({
    ...(withIds ? { id: player.id } : {}),
    position: player.position,
    name: player.name,
    ratingHere: player.rating,
    overall: player.overall,
    fit: player.kind,
    side: player.side,
    foot: player.foot,
    age: player.age,
    ...player.attributes,
  }));

const describeMatches = (matches: ScoutMatch[]) =>
  matches.map(match => ({
    result: `${match.goalsFor}-${match.goalsAgainst}`,
    formation: match.formation ? formationLabel(match.formation) : 'unknown',
    opponentFormation: match.opponentFormation ? formationLabel(match.opponentFormation) : 'unknown',
    opponent: match.opponent.name,
    competition: match.competition,
  }));

/** The best players not in the XI, for the AI to suggest swaps from */
const describeBench = (players: MFLPlayer[], xi: XiPlayer[]) => {
  const inXi = new Set(xi.map(player => player.id));
  return players
    .filter(player => !inXi.has(player.id) && player.metadata.retirementYears !== 0)
    .sort((a, b) => b.metadata.overall - a.metadata.overall)
    .slice(0, 9)
    .map(player => ({ name: player.metadata.lastName, positions: player.metadata.positions.join('/'), overall: player.metadata.overall, age: player.metadata.age }));
};

/**
 * What a manager sets before an MFL match, as far as this data shows it. Formation variants differ only in the
 * positions they field, so each is described by its positions.
 */
export const MFL_TACTICS_GUIDE = [
  'In MFL the manager picks a formation and fills its 11 positions, plus a bench, before the match; the match engine then simulates it.',
  'Formation variants change which positions are fielded: "(att)" puts a CAM in the middle of midfield, "(def)" a CDM, "(false 9)" plays a CF who drops deeper instead of an ST, "B" variants swap wide or central players for holding ones, "(diamond)" and "(narrow)" pack the centre, "(flat)" keeps a flat midfield line.',
  "A player's rating at a position is their overall less a familiarity penalty: none at a primary position, -5 fairly familiar, -8 somewhat familiar, -20 unfamiliar. Fit 'natural', 'alt' and 'out' mark these.",
  'Attributes run 0-100: pace, shooting, passing, dribbling, defense, physical (goalkeeping for keepers). Wide players beat full-backs with pace and dribbling; centre-backs stop strikers with defense and physical.',
  "Positions with side 'left' or 'right' are from that team's own point of view: their left-back faces our right winger.",
  `Besides the formation and XI, the manager sets a playing style: ${TACTIC_SETTINGS.length} settings, each on ${TACTIC_STEPS} steps from 1 (the low end) to ${TACTIC_STEPS} (the high end), listed under playingStyleSettings with what each end means. Step 3 is the middle and MFL's default. Flank Preference low favours attacking down our left, high our right.`,
  'Pick a step for every setting to suit this matchup: flank preference, width, crossing and dribbling to aim at their weak flank and use our best wide players; directness and team depth to use or deny pace in behind; pressing, aggressiveness and compactness against their midfield and creators; shooting by our shooters and their keeper; clearances by how good our defenders are on the ball.',
  'ourTacticsLog, when present, holds the settings we actually used in our own logged matches (league, cup and friendly) with the result and xG, how we did with each setting low (steps 1-2), mid (3) and high (4-5), and the logged matches against this opponent and this formation. Weigh it by sample size: a few friendlies are weak evidence, and say so. Let it shape the settings you pick and explain the link in historyNotes.',
  "ourTacticsLog also holds the individual instructions we used (playerInstructions, by player name) and our record with each one tried (playerInstructionResults, by step, against the logged matches without it), and, where you advised us before a match, that advice and how closely we followed it (adviceFollowed: team settings set as advised) with our record when we followed it and when we didn't (followingAdvice). Learn from it: keep what worked, change advice that we followed and lost with, and test instructions we haven't tried enough, saying so in historyNotes.",
  `The captain plays at +${CAPTAIN_OVR} OVR, and the whole XI gets a bonus by the captain's position: goalkeeper +2 DEF; defender +2 DEF, +1 PHY; midfielder +2 PAS, +1 DRI; forward +2 SHO, +1 PAC. us.captainOptions lists our best choices with how much each lifts the XI's average rating; them.likelyCaptain is theirs. Pick ours weighing that lift against what the matchup needs, e.g. a defender's DEF bonus against a dangerous attack, or a forward's SHO bonus against a weak keeper.`,
  `Each player can also take individual instructions (playerSettings) that override the team's step for them alone, or follow it ("TEAM"). Passing Risk and Position Freedom exist only per player and start at step 3. In players, pick 2 to ${MAX_PLAYER_INSTRUCTIONS} key players from us.startingXi (those in the key matchups, our playmaker and our best attacker, a defender facing their danger man) and give each only the settings that should differ from your team step, e.g. a winger who beats his full-back on pace and dribbling dribbles more, a creative midfielder with high passing takes more passing risk, a slow centre-back clears more and presses less.`,
  'Only recommend formations, who plays where, swaps from the listed squads, the captain, the listed playing style settings and individual instructions. Do not invent other instructions.',
];

export interface AnalysisInput {
  ours: ScoutReport;
  theirs: ScoutReport;
  ourFormation: string;
  theirFormation: string;
  counters: RankedCounter[];
  aim?: Outcome;
  theirReports: SideReport[];
  /** Our tactics log, when any matches are logged */
  history?: TacticsHistory | null;
}

/** The prompt for one analysis: the guide, both squads and XIs, their form, the planner's numbers and our weak-spot finds */
/** Our logged matches, for the prompt: each with its settings, and the record by setting band */
function describeHistory(history: TacticsHistory | null | undefined, theirClubId: number, theirFormation: string, ourById: Map<number, MFLPlayer>) {
  const logged = (history?.matches ?? []).filter(match => match.settings).slice(0, 30);
  if (!logged.length) return null;
  const nameOf = (id: number | string) => ourById.get(Number(id))?.metadata.lastName ?? `Player ${id} (left the squad)`;
  const named = (players: PlayerSettings | null | undefined) =>
    Object.entries(players ?? {}).map(([id, settings]) => ({ player: nameOf(id), settings }));
  const describe = (match: (typeof logged)[number]) => ({
    date: new Date(match.startDate).toISOString().slice(0, 10),
    type: match.type,
    opponent: match.opponent.name,
    result: `${match.goalsFor}-${match.goalsAgainst}`,
    formation: match.formation ? formationLabel(match.formation) : 'unknown',
    opponentFormation: match.opponentFormation ? formationLabel(match.opponentFormation) : 'unknown',
    xGFor: match.xGFor,
    xGAgainst: match.xGAgainst,
    settings: match.settings,
    playerInstructions: named(match.players),
    ...(match.advice
      ? {
          advised: {
            formation: formationLabel(match.advice.formation),
            aim: match.advice.aim,
            settings: match.advice.settings,
            playerInstructions: named(match.advice.players),
            ...(match.advice.settings && match.settings ? { adviceFollowed: adviceAgreement(match.settings, match.advice.settings) } : {}),
          },
        }
      : {}),
  });
  const similar = similarMatches(logged, theirClubId, theirFormation);
  return {
    overall: recordOf(logged),
    followingAdvice: adviceRecord(logged),
    playerInstructionResults: playerSettingEffects(logged).map(effect => ({
      player: nameOf(effect.playerId),
      setting: effect.key,
      bySteps: effect.bySteps,
      withoutIt: effect.team,
    })),
    bySetting: settingEffects(logged).map(effect => ({ setting: effect.key, ...effect.bands, bestBand: effect.best })),
    againstThisOpponent: similar.sameOpponent.map(describe),
    againstThisFormation: similar.sameFormation.map(describe),
    matches: logged.map(describe),
  };
}

export function buildAnalysisPrompt({ ours, theirs, ourFormation, theirFormation, counters, aim = 'win', theirReports, history }: AnalysisInput): string {
  const ourById = new Map(ours.players.map(player => [player.id, player]));
  const theirById = new Map(theirs.players.map(player => [player.id, player]));
  const ourFit = squadFits(ours.players).get(ourFormation);
  const theirFit = squadFits(theirs.players).get(theirFormation);
  const ourXi = xiPlayers(ourFormation, ourFit, ourById);
  const theirXi = xiPlayers(theirFormation, theirFit, theirById);
  const nameOf = (byId: Map<number, MFLPlayer>, id: number) => byId.get(id)?.metadata.lastName ?? `Player ${id}`;
  const captainOptionsOf = (fit: typeof ourFit, byId: Map<number, MFLPlayer>) =>
    fit
      ? captainOptions(fit.formation, fit.slots.map(slot => slot.playerId), byId)
          .slice(0, 5)
          .map(option => ({
            player: `${option.position} ${nameOf(byId, option.playerId)}`,
            teamBonus: describeBonus(option.line),
            xiRatingWithThem: Math.round(option.rating * 10) / 10,
            gain: Math.round(option.gain * 100) / 100,
          }))
      : [];
  const played: PlayedMatch[] = theirs.matches;

  const data = {
    tacticsGuide: MFL_TACTICS_GUIDE,
    playingStyleSettings: TACTIC_SETTINGS.map(({ key, label, group, low, high }) => ({
      key,
      label,
      phase: group === 'in' ? 'in possession (how we attack)' : 'out of possession (how we defend)',
      lowEnd: low,
      highEnd: high,
    })),
    playerSettings: PLAYER_SETTINGS.map(({ key, label, group, low, high }) => ({
      key,
      label,
      phase: group === 'in' ? 'in possession' : 'out of possession',
      lowEnd: low,
      highEnd: high,
      ...(PLAYER_ONLY_SETTINGS.has(key) ? { playerOnly: true } : {}),
    })),
    formations: Object.keys(FORMATIONS).map(formation => ({ key: formation, positions: describeFormation(formation) })),
    us: {
      club: ours.club.name,
      aim,
      plannedFormation: formationLabel(ourFormation),
      startingXi: describeXi(ourXi, true),
      captainOptions: captainOptionsOf(ourFit, ourById),
      bestOfTheRest: describeBench(ours.players, ourXi),
      recentResults: describeMatches(ours.matches.slice(0, 10)),
      ourTacticsLog: describeHistory(history, theirs.club.id, theirFormation, ourById),
    },
    them: {
      club: theirs.club.name,
      expectedFormation: formationLabel(theirFormation),
      likelyXi: describeXi(theirXi),
      likelyCaptain: captainOptionsOf(theirFit, theirById)[0] ?? null,
      bestOfTheRest: describeBench(theirs.players, theirXi),
      recentResults: describeMatches(theirs.matches),
      recentMatchStats: summariseReports(theirReports, theirById),
    },
    plannerCounters: counters.map(counter => ({ ...counter, formation: formationLabel(counter.formation), key: counter.formation })),
    squadComparison: compareSquads(ourXi, theirXi, ours.players, theirs.players, { ours: ourFit?.rating ?? null, theirs: theirFit?.rating ?? null }),
    weakSpotsFound: findWeaknesses(ourXi, theirXi, played),
  };

  return [
    `You are an analyst for an MFL (Metaverse Football League) club, ${ours.club.name}, preparing to play ${theirs.club.name}.`,
    `Study the data below: both squads, the XI each side is expected to field (their XI is the best their squad makes in their expected formation, so it may differ on the day), their recent results with formations, per-player stats from their last ${theirReports.length} matches, the planner's ranked counter formations from the formation meta, and the weak spots our rules found.`,
    `${AIM_BRIEFS[aim]} plannerCounters are ranked for this aim. Every recommendation (formation, captain, lineup changes, playing style) must serve it.`,
    'Find concrete edges: flanks to attack, individual duels we win, their tendencies by formation, and anything in their match stats (who gets dribbled past, who creates, xG against).',
    'Be specific and cite numbers and player names from the data. Keep each detail to one or two sentences. Name formations by their label, e.g. "4-3-3 (att)", except formation.pick, which must be a key.',
    '',
    JSON.stringify(data),
  ].join('\n');
}

/** The model's settings cut to the known ones, each once, its step a whole number from 1 to TACTIC_STEPS, in MFL's order */
export function cleanTactics(value: unknown, settings: TacticSetting[] = TACTIC_SETTINGS): TacticPick[] {
  if (!Array.isArray(value)) return [];
  const byKey = new Map<string, TacticPick>();
  for (const item of value) {
    if (!item || typeof item.key !== 'string' || byKey.has(item.key) || !settings.some(setting => setting.key === item.key)) continue;
    const step = Math.round(Number(item.step));
    if (!Number.isFinite(step)) continue;
    byKey.set(item.key, { key: item.key, step: Math.min(TACTIC_STEPS, Math.max(1, step)), reason: String(item.reason ?? '') });
  }
  return settings.flatMap(setting => byKey.get(setting.key) ?? []);
}

/** The model's player instructions cut to players in `xiIds`, each once, with known settings only */
export function cleanPlayerInstructions(value: unknown, xiIds: Set<number>): PlayerInstruction[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<number>();
  const instructions: PlayerInstruction[] = [];
  for (const item of value) {
    const playerId = Number(item?.playerId);
    if (!xiIds.has(playerId) || seen.has(playerId)) continue;
    const settings = cleanTactics(item.settings, PLAYER_SETTINGS);
    if (!settings.length) continue;
    seen.add(playerId);
    instructions.push({ playerId, position: String(item.position ?? ''), name: String(item.name ?? ''), reason: String(item.reason ?? ''), settings });
  }
  return instructions.slice(0, MAX_PLAYER_INSTRUCTIONS);
}
