import type { MFLPlayer } from '../types/mflApi';
import type { MFLPosition } from '../types/positionOvr';
import { isRetiredPlayer } from './appSettings';
import { FORMATIONS, positionFit, type FitKind } from './squadLineups';

/*
 * Player fitness: MFL's energy, 0 to 10,000, shown as a percentage. A player below FIT_THRESHOLD is worth resting
 * when someone in the squad can cover their position.
 */

/** Fitness below this (%) marks a player as tired */
export const FIT_THRESHOLD = 90;
/** A cover rated this far below the tired player at their position still suits it */
export const COVER_MAX_DROP = 5;
/** Covers listed for each tired player */
const COVERS = 3;

/** A player's fitness as a whole percentage, null when MFL doesn't give it */
export const fitnessOf = (player: MFLPlayer | undefined): number | null =>
  player && typeof player.energy === 'number' && Number.isFinite(player.energy) ? Math.round(player.energy / 100) : null;

export const isTired = (player: MFLPlayer | undefined): boolean => {
  const fitness = fitnessOf(player);
  return fitness !== null && fitness < FIT_THRESHOLD;
};

export interface Cover {
  id: number;
  name: string;
  fitness: number | null;
  ratingHere: number;
  fit: FitKind;
  /** Rated within COVER_MAX_DROP of the tired player there */
  suitable: boolean;
}

export interface TiredStarter {
  position: string;
  id: number;
  name: string;
  fitness: number;
  ratingHere: number;
  /** Fit players outside the XI who play the position, best first */
  cover: Cover[];
}

/**
 * The tired players in an XI (player IDs by the formation's positions), each with the fit squad players outside
 * the XI who can play their position (natural or alternative), best rated there first.
 */
export function tiredStarters(formation: string, xi: (number | null)[], players: MFLPlayer[]): TiredStarter[] {
  const byId = new Map(players.map(player => [player.id, player]));
  const inXi = new Set(xi.filter((id): id is number => id !== null));
  const rested = players.filter(player => !inXi.has(player.id) && !isRetiredPlayer(player) && !isTired(player));
  return FORMATIONS[formation].flatMap(([position], index) => {
    const id = xi[index];
    const player = id === null || id === undefined ? undefined : byId.get(id);
    if (!player || !isTired(player)) return [];
    const ratingHere = Math.round(positionFit(player, position as MFLPosition).rating);
    const cover = rested
      .map(candidate => ({ candidate, fit: positionFit(candidate, position as MFLPosition) }))
      .filter(({ fit }) => fit.kind !== 'out')
      .sort((a, b) => b.fit.rating - a.fit.rating)
      .slice(0, COVERS)
      .map(({ candidate, fit }) => ({
        id: candidate.id,
        name: candidate.metadata.lastName,
        fitness: fitnessOf(candidate),
        ratingHere: Math.round(fit.rating),
        fit: fit.kind,
        suitable: fit.rating >= ratingHere - COVER_MAX_DROP,
      }));
    return [{ position, id: player.id, name: player.metadata.lastName, fitness: fitnessOf(player) ?? 0, ratingHere, cover }];
  });
}
