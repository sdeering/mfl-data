import { getOffPrimaryGain, rankPositionRatings } from '../utils/positionRatingOrder'

describe('rankPositionRatings', () => {
  const ratings: Record<string, number> = { RB: 75, CB: 76, CM: 65 }

  test('a RB who rates higher at CB is listed CB first, with each difference to the primary RB', () => {
    expect(rankPositionRatings(['RB', 'CB', 'CM'], pos => ratings[pos])).toEqual([
      { position: 'CB', rating: 76, isPrimary: false, diff: 1 },
      { position: 'RB', rating: 75, isPrimary: true, diff: 0 },
      { position: 'CM', rating: 65, isPrimary: false, diff: -10 },
    ])
  })

  test('the primary position comes first when another position rates the same', () => {
    const ranked = rankPositionRatings(['CM', 'CDM'], () => 70)
    expect(ranked.map(r => r.position)).toEqual(['CM', 'CDM'])
  })

  test('a player with no positions has nothing to rank', () => {
    expect(rankPositionRatings([], () => 70)).toEqual([])
  })
})

describe('getOffPrimaryGain', () => {
  test('is how much higher the best other position rates than the primary', () => {
    expect(getOffPrimaryGain(rankPositionRatings(['RB', 'CB', 'CM'], pos => ({ RB: 75, CB: 77, CM: 76 } as Record<string, number>)[pos]))).toBe(2)
  })

  test('is 0 when no other position rates higher', () => {
    expect(getOffPrimaryGain(rankPositionRatings(['ST', 'CF'], pos => (pos === 'ST' ? 71 : 69)))).toBe(0)
    expect(getOffPrimaryGain(rankPositionRatings(['ST'], () => 71))).toBe(0)
    expect(getOffPrimaryGain([])).toBe(0)
  })
})
