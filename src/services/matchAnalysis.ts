import type { MFLPlayer } from '../types/mflApi';
import { squadFits, type PlayedMatch } from '../utils/formationPlanner';
import { compareSquads, describeFormation, findWeaknesses, xiPlayers, type XiPlayer } from '../utils/squadComparison';
import { FORMATIONS, FORMATION_NAMES, formationLabel } from '../utils/squadLineups';
import type { ScoutMatch, ScoutReport } from './scoutService';

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
}

export interface MatchAnalysisRequest {
  ourClubId: number;
  theirClubId: number;
  ourFormation: string;
  theirFormation: string;
  counters?: RankedCounter[];
}

export interface MatchAnalysis {
  summary: string;
  formation: { pick: string; reason: string };
  attack: { title: string; detail: string }[];
  defend: { title: string; detail: string }[];
  matchups: { ours: string; theirs: string; edge: 'ours' | 'theirs' | 'even'; note: string }[];
  lineup: { position: string; change: string; reason: string }[];
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
  },
  required: ['summary', 'formation', 'attack', 'defend', 'matchups', 'lineup'],
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

const describeXi = (xi: XiPlayer[]) =>
  xi.map(player => ({
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
  'Only recommend formations, who plays where and swaps from the listed squads. Do not invent other team instructions or settings.',
];

export interface AnalysisInput {
  ours: ScoutReport;
  theirs: ScoutReport;
  ourFormation: string;
  theirFormation: string;
  counters: RankedCounter[];
  theirReports: SideReport[];
}

/** The prompt for one analysis: the guide, both squads and XIs, their form, the planner's numbers and our weak-spot finds */
export function buildAnalysisPrompt({ ours, theirs, ourFormation, theirFormation, counters, theirReports }: AnalysisInput): string {
  const ourById = new Map(ours.players.map(player => [player.id, player]));
  const theirById = new Map(theirs.players.map(player => [player.id, player]));
  const ourXi = xiPlayers(ourFormation, squadFits(ours.players).get(ourFormation), ourById);
  const theirXi = xiPlayers(theirFormation, squadFits(theirs.players).get(theirFormation), theirById);
  const played: PlayedMatch[] = theirs.matches;

  const data = {
    tacticsGuide: MFL_TACTICS_GUIDE,
    formations: Object.keys(FORMATIONS).map(formation => ({ key: formation, positions: describeFormation(formation) })),
    us: {
      club: ours.club.name,
      plannedFormation: formationLabel(ourFormation),
      startingXi: describeXi(ourXi),
      bestOfTheRest: describeBench(ours.players, ourXi),
      recentResults: describeMatches(ours.matches.slice(0, 10)),
    },
    them: {
      club: theirs.club.name,
      expectedFormation: formationLabel(theirFormation),
      likelyXi: describeXi(theirXi),
      bestOfTheRest: describeBench(theirs.players, theirXi),
      recentResults: describeMatches(theirs.matches),
      recentMatchStats: summariseReports(theirReports, theirById),
    },
    plannerCounters: counters.map(counter => ({ ...counter, formation: formationLabel(counter.formation), key: counter.formation })),
    squadComparison: compareSquads(ourXi, theirXi, ours.players, theirs.players),
    weakSpotsFound: findWeaknesses(ourXi, theirXi, played),
  };

  return [
    `You are an analyst for an MFL (Metaverse Football League) club, ${ours.club.name}, preparing to play ${theirs.club.name}.`,
    `Study the data below: both squads, the XI each side is expected to field (their XI is the best their squad makes in their expected formation, so it may differ on the day), their recent results with formations, per-player stats from their last ${theirReports.length} matches, the planner's ranked counter formations from the formation meta, and the weak spots our rules found.`,
    'Find concrete edges: flanks to attack, individual duels we win, their tendencies by formation, and anything in their match stats (who gets dribbled past, who creates, xG against).',
    'Be specific and cite numbers and player names from the data. Keep each detail to one or two sentences. Name formations by their label, e.g. "4-3-3 (att)", except formation.pick, which must be a key.',
    '',
    JSON.stringify(data),
  ].join('\n');
}
