import type { MFLPlayer } from '../types/mflApi';

type PositionGroup = 'gk' | 'defense' | 'midfield' | 'attack';

const POSITION_TO_GROUP: Record<string, PositionGroup> = {
  GK: 'gk',
  CB: 'defense', LB: 'defense', RB: 'defense', LWB: 'defense', RWB: 'defense',
  CDM: 'midfield', CM: 'midfield', CAM: 'midfield', LM: 'midfield', RM: 'midfield',
  LW: 'attack', RW: 'attack', ST: 'attack', CF: 'attack'
};

// Weights, in priority order: same squad, same position, similar age, same position group, similar overall
const SAME_CLUB = 40;
const SAME_PRIMARY_POSITION = 35;
const SHARED_POSITION = 25;
const MAX_AGE_SCORE = 20; // loses 4 per year of age difference
const SAME_POSITION_GROUP = 15;
const MAX_OVERALL_SCORE = 10; // loses 1 per point of overall difference

const getGroups = (player: MFLPlayer): PositionGroup[] =>
  (player.metadata.positions || []).map(pos => POSITION_TO_GROUP[pos]).filter(Boolean);

/**
 * How closely a candidate matches the reference player (higher = closer)
 */
export function getSimilarityScore(reference: MFLPlayer, candidate: MFLPlayer): number {
  let score = 0;

  const referenceClubId = reference.activeContract?.club?.id;
  if (referenceClubId && referenceClubId === candidate.activeContract?.club?.id) {
    score += SAME_CLUB;
  }

  const referencePositions = reference.metadata.positions || [];
  const candidatePositions = candidate.metadata.positions || [];
  if (referencePositions[0] && referencePositions[0] === candidatePositions[0]) {
    score += SAME_PRIMARY_POSITION;
  } else if (referencePositions.some(pos => candidatePositions.includes(pos))) {
    score += SHARED_POSITION;
  }

  const referenceGroups = getGroups(reference);
  if (getGroups(candidate).some(group => referenceGroups.includes(group))) {
    score += SAME_POSITION_GROUP;
  }

  score += Math.max(0, MAX_AGE_SCORE - 4 * Math.abs(reference.metadata.age - candidate.metadata.age));
  score += Math.max(0, MAX_OVERALL_SCORE - Math.abs(reference.metadata.overall - candidate.metadata.overall));

  return score;
}

/**
 * Order players by closest match to the reference player. The reference itself is excluded.
 * Without a reference, players are ordered by overall rating.
 */
export function rankSimilarPlayers(reference: MFLPlayer | null, candidates: MFLPlayer[]): MFLPlayer[] {
  const byOverall = (a: MFLPlayer, b: MFLPlayer) => b.metadata.overall - a.metadata.overall;
  if (!reference) return [...candidates].sort(byOverall);

  return candidates
    .filter(candidate => candidate.id !== reference.id)
    .map(candidate => ({ candidate, score: getSimilarityScore(reference, candidate) }))
    .sort((a, b) => b.score - a.score || byOverall(a.candidate, b.candidate))
    .map(({ candidate }) => candidate);
}
