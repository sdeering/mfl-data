import type { PlayerMatchStats } from '../types/playerMatches';

// Every league starts a new competition each season, all on about the same day; a club that moves
// division mid-history still lands in a competition starting within a few days of the others
const SAME_SEASON_MS = 7 * 24 * 60 * 60 * 1000;
// A season is 6 weeks; a newest season that started longer ago than this is not the one running now
const CURRENT_SEASON_MS = 49 * 24 * 60 * 60 * 1000;

export interface PlayerSeason {
  start: number; // The season's first league match (or its league's start date, if that is earlier)
  end: number | null; // When the next season started; null for the newest one
  isCurrent: boolean;
  matches: PlayerMatchStats[];
  leagueMatches: number;
  cupMatches: number;
}

const isLeague = (match: PlayerMatchStats) => match.match?.type !== 'CUP';

/**
 * The start of every season the player played league matches in, newest first. MFL doesn't say which
 * season a match is in, so each league competition is one season, starting from its first match.
 */
export function getSeasonStarts(matches: PlayerMatchStats[]): number[] {
  const competitionStarts = new Map<number | string, number>();
  for (const stat of matches) {
    if (!isLeague(stat) || !stat.match) continue;
    const { competition, startDate } = stat.match;
    const key = competition?.id ?? competition?.name ?? '';
    const listedStart = competition?.startingDate ?? startDate;
    competitionStarts.set(key, Math.min(competitionStarts.get(key) ?? Infinity, listedStart, startDate));
  }

  const starts: number[] = [];
  for (const start of [...competitionStarts.values()].sort((a, b) => b - a)) {
    const newest = starts[starts.length - 1];
    if (newest !== undefined && newest - start < SAME_SEASON_MS) {
      starts[starts.length - 1] = start; // Same season: it began with the earliest of them
    } else {
      starts.push(start);
    }
  }
  return starts;
}

/**
 * The player's matches in their last `count` seasons, newest first, with how many were league and cup.
 * A season runs from its first league match to the start of the next, so a cup played in the break
 * between seasons counts towards the one that just ended.
 */
export function groupMatchesBySeason(matches: PlayerMatchStats[], count: number, now = Date.now()): PlayerSeason[] {
  const starts = getSeasonStarts(matches).slice(0, count);

  return starts.map((start, index) => {
    const end = index === 0 ? null : starts[index - 1];
    const seasonMatches = matches.filter(stat => stat.match.startDate >= start && (end === null || stat.match.startDate < end));
    const leagueMatches = seasonMatches.filter(isLeague).length;
    return {
      start,
      end,
      isCurrent: index === 0 && now - start < CURRENT_SEASON_MS,
      matches: seasonMatches,
      leagueMatches,
      cupMatches: seasonMatches.length - leagueMatches
    };
  });
}

/** Whether these matches (newest first) reach back past the start of the `count`th season. */
export function coversSeasons(matches: PlayerMatchStats[], count: number): boolean {
  // Seeing a league match from the season before means every match of the oldest wanted one is in
  return getSeasonStarts(matches).length > count;
}
