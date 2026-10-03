export interface RankedPositionRating<P extends string = string> {
  position: P;
  rating: number;
  isPrimary: boolean;
  // Rating minus the primary position's rating (0 for the primary itself)
  diff: number;
}

/**
 * Order a player's playable positions best rating first, each with its difference to the
 * primary position (the first one listed). On a tie the primary comes first.
 */
export function rankPositionRatings<P extends string>(
  positions: P[],
  getRating: (position: P) => number
): RankedPositionRating<P>[] {
  if (positions.length === 0) return [];

  const primaryRating = getRating(positions[0]);
  return positions
    .map((position, index) => {
      const rating = index === 0 ? primaryRating : getRating(position);
      return { position, rating, isPrimary: index === 0, diff: rating - primaryRating };
    })
    .sort((a, b) => b.rating - a.rating || Number(b.isPrimary) - Number(a.isPrimary));
}

/** How much higher the player rates at their best other position than at their primary (0 if nowhere higher). */
export function getOffPrimaryGain(ratings: RankedPositionRating[]): number {
  return Math.max(0, ...ratings.map(rating => rating.diff));
}
