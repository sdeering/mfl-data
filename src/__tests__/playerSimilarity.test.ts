import { rankSimilarPlayers } from '../utils/playerSimilarity';
import type { MFLPlayer } from '../types/mflApi';

const makePlayer = (id: number, positions: string[], age: number, overall: number, clubId?: number) => ({
  id,
  metadata: { firstName: 'Player', lastName: String(id), positions, age, overall },
  activeContract: clubId ? { club: { id: clubId } } : undefined,
} as unknown as MFLPlayer);

describe('rankSimilarPlayers', () => {
  const reference = makePlayer(1, ['ST', 'CF'], 24, 80, 100);

  it('orders by same squad, then position, then age, then position group', () => {
    const sameClubSamePosition = makePlayer(2, ['ST'], 24, 80, 100);
    const samePositionOtherClub = makePlayer(3, ['ST'], 24, 80, 200);
    const samePositionOlder = makePlayer(4, ['ST'], 31, 80, 200);
    const sameGroupOnly = makePlayer(5, ['LW'], 24, 80, 200);
    const defender = makePlayer(6, ['CB'], 24, 80, 200);

    const ranked = rankSimilarPlayers(reference, [defender, sameGroupOnly, samePositionOlder, samePositionOtherClub, sameClubSamePosition]);

    expect(ranked.map(p => p.id)).toEqual([2, 3, 4, 5, 6]);
  });

  it('ranks a shared secondary position above a player from the same group only', () => {
    const sharesSecondary = makePlayer(7, ['CAM', 'CF'], 24, 80);
    const sameGroupOnly = makePlayer(8, ['RW'], 24, 80);

    expect(rankSimilarPlayers(reference, [sameGroupOnly, sharesSecondary]).map(p => p.id)).toEqual([7, 8]);
  });

  it('excludes the reference player', () => {
    const other = makePlayer(9, ['ST'], 24, 80);

    expect(rankSimilarPlayers(reference, [reference, other]).map(p => p.id)).toEqual([9]);
  });

  it('orders by overall when there is no reference player', () => {
    const players = [makePlayer(10, ['CB'], 20, 60), makePlayer(11, ['ST'], 30, 90), makePlayer(12, ['GK'], 25, 75)];

    expect(rankSimilarPlayers(null, players).map(p => p.id)).toEqual([11, 12, 10]);
  });
});
