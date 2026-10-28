import { SPOT_GAP, TAG_GAP, placeSpots, type PitchSpot, type PlacedSpot } from '../utils/pitchSpots';
import { FORMATIONS } from '../utils/squadLineups';

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const rectsOf = (spot: PitchSpot, place: PlacedSpot): Rect[] => {
  const offset = spot.ring / 2 + TAG_GAP + spot.tagHeight / 2;
  return [
    { x: place.x, y: place.y, width: spot.ring, height: spot.ring },
    { x: place.x, y: place.tagAbove ? place.y - offset : place.y + offset, width: spot.tagWidth, height: spot.tagHeight },
  ];
};

/** Rings and tags of different players closer than SPOT_GAP */
const crowdedPairs = (spots: PitchSpot[], placed: PlacedSpot[]) => {
  const rects = spots.map((spot, index) => rectsOf(spot, placed[index]));
  let crowded = 0;
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      for (const a of rects[i]) {
        for (const b of rects[j]) {
          const apart = Math.max(Math.abs(a.x - b.x) - (a.width + b.width) / 2, Math.abs(a.y - b.y) - (a.height + b.height) / 2);
          if (apart < SPOT_GAP - 0.01) crowded++;
        }
      }
    }
  }
  return crowded;
};

/** Both teams on the matchup pitch, as it lays them out before making room */
const matchup = (theirs: string, ours: string, width: number, ring: number, tagWidth: number, tagHeight: number) => {
  const height = width * 0.64;
  const spotsOf = (formation: string, us: boolean) =>
    FORMATIONS[formation].map(([, across, down]) => {
      const left = 4 + (100 - down) * 0.46;
      const top = 6 + across * 0.88;
      return { x: ((us ? left : 100 - left) / 100) * width, y: ((us ? top : 100 - top) / 100) * height, ring, tagWidth, tagHeight };
    });
  return { spots: [...spotsOf(theirs, false), ...spotsOf(ours, true)], width, height };
};

describe('placeSpots', () => {
  it('leaves players with room where they stand, tags below', () => {
    const spots = [
      { x: 100, y: 100, ring: 28, tagWidth: 52, tagHeight: 14 },
      { x: 200, y: 100, ring: 28, tagWidth: 52, tagHeight: 14 },
    ];
    expect(placeSpots(spots, 430, 275)).toEqual([
      { x: 100, y: 100, tagAbove: false },
      { x: 200, y: 100, tagAbove: false },
    ]);
  });

  it("clears the keeper's name from the centre-back right in front of him in a back three", () => {
    const { spots, width, height } = matchup('4-4-2', '3-4-3', 415, 28, 52, 14);
    const before = crowdedPairs(
      spots,
      spots.map(spot => ({ x: spot.x, y: spot.y, tagAbove: false })),
    );
    expect(before).toBeGreaterThan(0);
    const placed = placeSpots(spots, width, height);
    expect(crowdedPairs(spots, placed)).toBe(0);
    // The keeper, placed first, stays on his line
    expect(placed[11]).toEqual({ x: spots[11].x, y: spots[11].y, tagAbove: false });
  });

  it('keeps every ring and tag inside the pitch', () => {
    const spots = [{ x: 4, y: 270, ring: 28, tagWidth: 52, tagHeight: 14 }];
    const [place] = placeSpots(spots, 430, 275);
    for (const rect of rectsOf(spots[0], place)) {
      expect(rect.x - rect.width / 2).toBeGreaterThanOrEqual(0);
      expect(rect.y + rect.height / 2).toBeLessThanOrEqual(275);
    }
  });

  it('clears nearly every formation against a back three, four and five on a desktop pitch, and every one on a phone', () => {
    const names = Object.keys(FORMATIONS);
    const opponents = ['3-4-3', '4-3-3_attack', '4-1-2-1-2', '5-4-1'];
    let desktop = 0;
    let phone = 0;
    for (const theirs of opponents) {
      for (const ours of names) {
        const wide = matchup(theirs, ours, 415, 28, 52, 14);
        if (crowdedPairs(wide.spots, placeSpots(wide.spots, wide.width, wide.height)) > 0) desktop++;
        const narrow = matchup(theirs, ours, 297, 20, 18, 13);
        if (crowdedPairs(narrow.spots, placeSpots(narrow.spots, narrow.width, narrow.height)) > 0) phone++;
      }
    }
    expect(desktop / (opponents.length * names.length)).toBeLessThan(0.05);
    expect(phone).toBe(0);
  });
});
