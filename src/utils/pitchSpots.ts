/** A player on a pitch drawing: where their ring is centred, its size and their name tag's size, in pixels */
export interface PitchSpot {
  x: number;
  y: number;
  ring: number;
  /** 0 for no tag */
  tagWidth: number;
  tagHeight: number;
}

/** Where a player ends up: their ring's centre, and whether their name tag goes above it rather than below */
export interface PlacedSpot {
  x: number;
  y: number;
  tagAbove: boolean;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Least room left between any two rings or name tags */
export const SPOT_GAP = 4;
/** Between a ring and its own name tag */
export const TAG_GAP = 2;
/** How far a ring may move to find room, in what steps, and how much further a tag above counts as */
const REACH = 48;
const STEP = 2;
const TAG_ABOVE_COST = 8;

/** Every move within reach, the shortest first */
const MOVES: [number, number][] = (() => {
  const moves: [number, number][] = [];
  for (let dx = -REACH; dx <= REACH; dx += STEP) {
    for (let dy = -REACH; dy <= REACH; dy += STEP) {
      if (dx * dx + dy * dy <= REACH * REACH) moves.push([dx, dy]);
    }
  }
  return moves.sort((a, b) => a[0] * a[0] + a[1] * a[1] - (b[0] * b[0] + b[1] * b[1]));
})();

/** How badly two rects crowd each other, 0 when at least SPOT_GAP apart */
const crowding = (a: Rect, b: Rect) =>
  Math.max(0, (a.width + b.width) / 2 + SPOT_GAP - Math.abs(a.x - b.x)) * Math.max(0, (a.height + b.height) / 2 + SPOT_GAP - Math.abs(a.y - b.y));

function rectsOf(spot: PitchSpot, x: number, y: number, tagAbove: boolean): Rect[] {
  const ring = { x, y, width: spot.ring, height: spot.ring };
  if (!spot.tagWidth) return [ring];
  const offset = spot.ring / 2 + TAG_GAP + spot.tagHeight / 2;
  return [ring, { x, y: tagAbove ? y - offset : y + offset, width: spot.tagWidth, height: spot.tagHeight }];
}

/**
 * Lays players out so no two rings or name tags come closer than SPOT_GAP, inside the pitch. One at a time, those
 * nearest the goal lines first (keepers and defenders stay put, the crowded middle makes room), each goes where it
 * stands with its tag below when that's clear, otherwise to the nearest clear place within reach, its tag above
 * when that's nearer. With no clear place in reach, it takes the least crowded one.
 */
export function placeSpots(spots: PitchSpot[], width: number, height: number): PlacedSpot[] {
  const taken: Rect[] = [];
  const placed: PlacedSpot[] = spots.map(spot => ({ x: spot.x, y: spot.y, tagAbove: false }));
  const inside = (rect: Rect) =>
    rect.x - rect.width / 2 >= 0 && rect.x + rect.width / 2 <= width && rect.y - rect.height / 2 >= 0 && rect.y + rect.height / 2 <= height;
  const order = spots.map((_, index) => index).sort((a, b) => Math.abs(spots[b].x - width / 2) - Math.abs(spots[a].x - width / 2));

  for (const index of order) {
    const spot = spots[index];
    let best: { place: PlacedSpot; rects: Rect[]; cost: number; crowding: number } | null = null;
    for (const tagAbove of [false, true]) {
      const extra = tagAbove ? TAG_ABOVE_COST : 0;
      for (const [dx, dy] of MOVES) {
        const cost = Math.hypot(dx, dy) + extra;
        // The moves come shortest first, so once one is clear, the rest on this side only cost more
        if (best && best.crowding === 0 && cost >= best.cost) break;
        const rects = rectsOf(spot, spot.x + dx, spot.y + dy, tagAbove);
        if (!rects.every(inside)) continue;
        const crowded = rects.reduce((total, rect) => total + taken.reduce((sum, other) => sum + crowding(rect, other), 0), 0);
        if (!best || crowded < best.crowding || (crowded === best.crowding && cost < best.cost)) {
          best = { place: { x: spot.x + dx, y: spot.y + dy, tagAbove }, rects, cost, crowding: crowded };
        }
      }
    }
    if (best) {
      placed[index] = best.place;
      taken.push(...best.rects);
    } else {
      taken.push(...rectsOf(spot, spot.x, spot.y, false));
    }
  }
  return placed;
}
