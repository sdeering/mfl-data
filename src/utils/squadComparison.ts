import type { MFLPlayer } from '../types/mflApi';
import { isRetiredPlayer } from './appSettings';
import type { FormationFit, PlayedMatch } from './formationPlanner';
import { FORMATIONS, formationLabel, type FitKind } from './squadLineups';

/*
 * The Match Prep Tool's squad comparison: our XI against theirs line by line and attribute by attribute, and the
 * weak spots in their XI to aim at. Pure, so the page and the AI analysis route read the same numbers.
 */

export type Line = 'GK' | 'DEF' | 'MID' | 'ATT';
/** Which side of the pitch a player stands on, from their own team's point of view */
export type Side = 'left' | 'centre' | 'right';

export const ATTRIBUTES = ['pace', 'shooting', 'passing', 'dribbling', 'defense', 'physical'] as const;
export type Attribute = (typeof ATTRIBUTES)[number];

const LINES: Record<string, Line> = {
  GK: 'GK',
  LB: 'DEF', CB: 'DEF', RB: 'DEF', LWB: 'DEF', RWB: 'DEF',
  CDM: 'MID', CM: 'MID', CAM: 'MID', LM: 'MID', RM: 'MID',
  LW: 'ATT', RW: 'ATT', CF: 'ATT', ST: 'ATT',
};
export const lineOf = (position: string): Line => LINES[position] ?? 'MID';

/** A player in a starting XI, at their position in the formation */
export interface XiPlayer {
  id: number;
  position: string;
  name: string;
  /** Their rating at this position */
  rating: number;
  overall: number;
  kind: FitKind;
  line: Line;
  side: Side;
  age: number;
  foot: 'LEFT' | 'RIGHT';
  attributes: Record<Attribute, number>;
}

/** The XI a fit puts out, position by position. Empty positions are left out. */
export function xiPlayers(formation: string, fit: FormationFit | undefined, playersById: Map<number, MFLPlayer>): XiPlayer[] {
  if (!fit) return [];
  return FORMATIONS[formation].flatMap(([position, across], index) => {
    const slot = fit.slots[index];
    const player = slot?.playerId ? playersById.get(slot.playerId) : undefined;
    if (!player) return [];
    const m = player.metadata;
    return [
      {
        id: player.id,
        position,
        name: m.lastName || m.firstName,
        rating: Math.round(slot.rating),
        overall: m.overall,
        kind: slot.kind,
        line: lineOf(position),
        side: across < 35 ? 'left' : across > 65 ? 'right' : 'centre',
        age: m.age,
        foot: m.preferredFoot,
        attributes: Object.fromEntries(ATTRIBUTES.map(attribute => [attribute, m[attribute] ?? 0])) as Record<Attribute, number>,
      },
    ];
  });
}

const average = (values: number[]) => (values.length ? values.reduce((total, value) => total + value, 0) / values.length : null);
const round1 = (value: number | null) => (value === null ? null : Math.round(value * 10) / 10);

/** The best 18 players by overall, the most a club takes to a match */
export const MATCHDAY_SQUAD = 18;

/** Overalls of the players able to play, best first */
const overalls = (players: MFLPlayer[]) =>
  players
    .filter(player => !isRetiredPlayer(player))
    .map(player => player.metadata.overall)
    .sort((a, b) => b - a);

export interface ComparisonRow {
  label: string;
  ours: number | null;
  theirs: number | null;
  /** What the numbers are, for a tooltip */
  hint?: string;
}

export interface SquadComparison {
  overall: ComparisonRow[];
  lines: ComparisonRow[];
  attributes: ComparisonRow[];
}

const LINE_LABELS: Record<Line, string> = { GK: 'Goalkeeper', DEF: 'Defence', MID: 'Midfield', ATT: 'Attack' };

/** Our XI and squad against theirs: overall strength, each line of the XI, and the outfield XI's attributes. */
export function compareSquads(ourXi: XiPlayer[], theirXi: XiPlayer[], ourPlayers: MFLPlayer[], theirPlayers: MFLPlayer[]): SquadComparison {
  const ourOveralls = overalls(ourPlayers);
  const theirOveralls = overalls(theirPlayers);
  const xiIds = (xi: XiPlayer[]) => new Set(xi.map(player => player.id));
  // The bench: the best 7 players left out of the XI
  const bench = (players: MFLPlayer[], xi: XiPlayer[]) => {
    const inXi = xiIds(xi);
    return overalls(players.filter(player => !inXi.has(player.id))).slice(0, MATCHDAY_SQUAD - 11);
  };
  const lineAverage = (xi: XiPlayer[], line: Line) => round1(average(xi.filter(player => player.line === line).map(player => player.rating)));
  const outfield = (xi: XiPlayer[]) => xi.filter(player => player.line !== 'GK');

  return {
    overall: [
      { label: 'Starting XI', ours: round1(average(ourXi.map(p => p.rating))), theirs: round1(average(theirXi.map(p => p.rating))), hint: 'Average rating at their positions' },
      {
        label: 'Matchday 18',
        ours: round1(average(ourOveralls.slice(0, MATCHDAY_SQUAD))),
        theirs: round1(average(theirOveralls.slice(0, MATCHDAY_SQUAD))),
        hint: 'Average overall of the best 18 players',
      },
      { label: 'Bench', ours: round1(average(bench(ourPlayers, ourXi))), theirs: round1(average(bench(theirPlayers, theirXi))), hint: 'Average overall of the best 7 left out of the XI' },
      { label: 'Whole squad', ours: round1(average(ourOveralls)), theirs: round1(average(theirOveralls)), hint: `Average overall of every player able to play` },
      { label: 'XI age', ours: round1(average(ourXi.map(p => p.age))), theirs: round1(average(theirXi.map(p => p.age))), hint: 'Average age of the starting XI' },
    ],
    lines: (['GK', 'DEF', 'MID', 'ATT'] as const).map(line => ({ label: LINE_LABELS[line], ours: lineAverage(ourXi, line), theirs: lineAverage(theirXi, line) })),
    attributes: ATTRIBUTES.map(attribute => ({
      label: attribute[0].toUpperCase() + attribute.slice(1),
      ours: round1(average(outfield(ourXi).map(p => p.attributes[attribute]))),
      theirs: round1(average(outfield(theirXi).map(p => p.attributes[attribute]))),
      hint: 'Outfield XI average',
    })),
  };
}

export interface Weakness {
  /** 'target' for a weak spot to attack, 'watch' for a threat of theirs */
  tone: 'target' | 'watch';
  title: string;
  detail: string;
}

/** Rating below their XI's average that makes a player a weak spot */
const WEAK_BY = 3;
/** Pace or rating edge between lines worth pointing out */
const EDGE = 5;

/** Their side, as we look at it: their left flank is our right */
const OUR_FLANK: Record<Side, string> = { left: 'right', right: 'left', centre: 'centre' };
const FLANK_ATTACKERS = ['RW', 'RM', 'RB', 'RWB', 'LW', 'LM', 'LB', 'LWB'];
const FORWARDNESS: Record<Line, number> = { GK: 0, DEF: 1, MID: 2, ATT: 3 };
const who = (player: XiPlayer) => `${player.position} ${player.name} (${player.rating})`;

/**
 * Weak spots in their XI to aim at, and threats to watch: their lowest rated defenders and midfielders, mapped to
 * the flank we'd attack, players out of position, pace and line gaps, and how many goals they've let in lately.
 */
export function findWeaknesses(ourXi: XiPlayer[], theirXi: XiPlayer[], theirMatches: PlayedMatch[]): Weakness[] {
  if (theirXi.length === 0) return [];
  const found: Weakness[] = [];
  const theirAverage = average(theirXi.map(p => p.rating))!;
  const lineOfXi = (xi: XiPlayer[], line: Line) => xi.filter(player => player.line === line);
  const lineAttr = (xi: XiPlayer[], line: Line, attribute: Attribute) => average(lineOfXi(xi, line).map(p => p.attributes[attribute]));
  const lineRating = (xi: XiPlayer[], line: Line) => average(lineOfXi(xi, line).map(p => p.rating));

  // Their weakest defenders and midfielders, and the keeper, with who of ours goes at them
  const weak = theirXi
    .filter(player => player.line !== 'ATT' && (player.rating <= theirAverage - WEAK_BY || player.kind !== 'natural'))
    .sort((a, b) => a.rating - b.rating)
    .slice(0, 3);
  for (const player of weak) {
    const below = Math.round(theirAverage - player.rating);
    const placing = player.kind === 'out' ? ', out of position' : player.kind === 'alt' ? ', at an alternative position' : '';
    const gap = below > 0 ? `, ${below} below their XI average of ${theirAverage.toFixed(1)}` : '';
    if (player.line === 'GK') {
      found.push({ tone: 'target', title: 'Test their keeper', detail: `Their GK ${player.name} rates ${player.rating}${placing}${gap}. Get shots away.` });
      continue;
    }
    const flank = OUR_FLANK[player.side];
    // Who of ours plays there, the most advanced first
    const facing = (
      flank === 'centre'
        ? ourXi.filter(p => p.line === 'ATT' && p.side === 'centre')
        : ourXi.filter(p => FLANK_ATTACKERS.includes(p.position) && p.side === flank)
    )
      .sort((a, b) => FORWARDNESS[b.line] - FORWARDNESS[a.line] || b.rating - a.rating)
      .slice(0, 2);
    const title = flank === 'centre' ? (player.line === 'DEF' ? 'Go through the middle' : 'Win the centre of midfield') : `Attack down your ${flank} flank`;
    found.push({
      tone: 'target',
      title,
      detail: `Their ${player.position} ${player.name} rates ${player.rating}${placing}${gap}.${
        facing.length ? ` Your ${facing.map(who).join(' and ')} ${facing.length > 1 ? 'go' : 'goes'} at them.` : ''
      }`,
    });
  }

  // Pace in behind, and pace at our own back line
  const ourForwardPace = lineAttr(ourXi, 'ATT', 'pace');
  const theirDefencePace = lineAttr(theirXi, 'DEF', 'pace');
  if (ourForwardPace !== null && theirDefencePace !== null && ourForwardPace - theirDefencePace >= EDGE) {
    found.push({
      tone: 'target',
      title: 'Play in behind',
      detail: `Your forwards average ${Math.round(ourForwardPace)} pace against their defenders' ${Math.round(theirDefencePace)}.`,
    });
  }
  const theirForwardPace = lineAttr(theirXi, 'ATT', 'pace');
  const ourDefencePace = lineAttr(ourXi, 'DEF', 'pace');
  if (theirForwardPace !== null && ourDefencePace !== null && theirForwardPace - ourDefencePace >= EDGE) {
    found.push({
      tone: 'watch',
      title: 'Their forwards are quicker',
      detail: `They average ${Math.round(theirForwardPace)} pace up front against your defenders' ${Math.round(ourDefencePace)}.`,
    });
  }

  // Midfield control
  const ourMid = lineRating(ourXi, 'MID');
  const theirMid = lineRating(theirXi, 'MID');
  if (ourMid !== null && theirMid !== null && Math.abs(ourMid - theirMid) >= EDGE) {
    found.push(
      ourMid > theirMid
        ? { tone: 'target', title: 'Control midfield', detail: `Your midfield rates ${ourMid.toFixed(1)} against their ${theirMid.toFixed(1)}.` }
        : { tone: 'watch', title: 'They are stronger in midfield', detail: `Their midfield rates ${theirMid.toFixed(1)} against your ${ourMid.toFixed(1)}.` },
    );
  }

  // Goals let in lately
  if (theirMatches.length >= 3) {
    const conceded = theirMatches.reduce((total, match) => total + match.goalsAgainst, 0);
    const perGame = conceded / theirMatches.length;
    const cleanSheets = theirMatches.filter(match => match.goalsAgainst === 0).length;
    if (perGame >= 1.5) {
      found.push({ tone: 'target', title: 'Leaky lately', detail: `They let in ${conceded} in their last ${theirMatches.length} games (${perGame.toFixed(1)} a game).` });
    } else if (perGame < 0.8) {
      found.push({
        tone: 'watch',
        title: 'Hard to score against',
        detail: `They let in ${conceded} in their last ${theirMatches.length} games, with ${cleanSheets} clean sheet${cleanSheets === 1 ? '' : 's'}.`,
      });
    }
  }

  // Their best attackers and creators
  const threats = theirXi
    .filter(player => player.line === 'ATT' || player.position === 'CAM')
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 2)
    .filter(player => player.rating >= theirAverage);
  if (threats.length) {
    found.push({ tone: 'watch', title: 'Danger men', detail: `Their ${threats.map(who).join(' and ')}.` });
  }
  return found;
}

/** "4-3-3 (att): GK, LB, CB, CB, RB, CM, CAM, CM, LW, ST, RW" */
export const describeFormation = (formation: string) => `${formationLabel(formation)}: ${FORMATIONS[formation].map(([position]) => position).join(', ')}`;
