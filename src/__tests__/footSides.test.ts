import type { MFLPlayer } from '../types/mflApi'
import { FORMATIONS, autoFillLineup, footBonus, sideByFoot, slotSide } from '../utils/squadLineups'
import { squadFits } from '../utils/formationPlanner'
import { cleanTeam } from '../services/matchAnalysis'

// Every attribute the same, so a player rates their overall at their primary position
const player = (id: number, positions: string[], overall: number, foot: 'LEFT' | 'RIGHT' = 'RIGHT'): MFLPlayer => {
  const keeper = positions[0] === 'GK'
  const outfield = keeper ? 0 : overall
  return {
    id,
    energy: 10000,
    metadata: {
      firstName: 'Player', lastName: `P${id}`, positions, overall, age: 25, retirementYears: 3, preferredFoot: foot,
      pace: outfield, shooting: outfield, passing: outfield, dribbling: outfield, defense: outfield, physical: outfield, goalkeeping: keeper ? overall : 0,
    },
  } as unknown as MFLPlayer
}

// 4-4-2: GK, LB, CB (left), CB (right), RB, LM, CM, CM, RM, ST, ST
const LEFT_CB = 2
const RIGHT_CB = 3
const others = [
  player(1, ['GK'], 80),
  player(2, ['LB'], 80, 'LEFT'),
  player(5, ['RB'], 80),
  player(6, ['LM'], 80, 'LEFT'),
  player(7, ['CM'], 80),
  player(8, ['CM'], 80),
  player(9, ['RM'], 80),
  player(10, ['ST'], 80),
  player(11, ['ST'], 80),
]
const centreBacksOf = (cbs: MFLPlayer[]) => {
  const { xi } = autoFillLineup('4-4-2', [...others, ...cbs])
  return [xi[LEFT_CB], xi[RIGHT_CB]]
}

describe('footedness', () => {
  it('knows which side each slot is on', () => {
    expect(FORMATIONS['4-4-2'].map((_, index) => slotSide('4-4-2', index))).toEqual([
      'centre', 'left', 'left', 'right', 'right', 'left', 'left', 'right', 'right', 'left', 'right',
    ])
  })

  it('puts a left-footed centre-back on the left and a right-footed one on the right', () => {
    expect(centreBacksOf([player(30, ['CB'], 85), player(31, ['CB'], 82, 'LEFT')])).toEqual([31, 30])
    expect(centreBacksOf([player(31, ['CB'], 82, 'LEFT'), player(30, ['CB'], 85)])).toEqual([31, 30])
  })

  it('puts the better of two right-footers on the right, and the better of two left-footers on the left', () => {
    expect(centreBacksOf([player(30, ['CB'], 90), player(31, ['CB'], 84)])).toEqual([31, 30])
    expect(centreBacksOf([player(31, ['CB'], 84), player(30, ['CB'], 90)])).toEqual([31, 30])
    expect(centreBacksOf([player(30, ['CB'], 90, 'LEFT'), player(31, ['CB'], 84, 'LEFT')])).toEqual([30, 31])
  })

  it('never plays a worse-rated player for his foot', () => {
    // Two right-footers rated 85 and 84 against a left-footer rated 83: the left-footer sits out
    const picked = centreBacksOf([player(30, ['CB'], 85), player(31, ['CB'], 84), player(32, ['CB'], 83, 'LEFT')])
    expect(picked).toEqual([31, 30])
    expect(footBonus(player(1, ['CB'], 99), '4-4-2', RIGHT_CB)).toBeLessThan(1)
  })

  it("leaves the XI's rating as it was", () => {
    const cbs = [player(30, ['CB'], 90), player(31, ['CB'], 84, 'LEFT')]
    const fit = squadFits([...others, ...cbs]).get('4-4-2')!
    expect(fit.ratingWithoutCaptain).toBeCloseTo((80 * 9 + 90 + 84) / 11)
  })

  it("re-sides players who share a position in a given XI, such as the AI's", () => {
    const left = player(30, ['CB'], 90, 'LEFT')
    const right = player(31, ['CB'], 84)
    const squad = [...others, left, right]
    const byId = new Map(squad.map(p => [p.id, p]))
    const wrongWay = [1, 2, 31, 30, 5, 6, 7, 8, 9, 10, 11]
    expect(sideByFoot('4-4-2', wrongWay, byId).slice(LEFT_CB, RIGHT_CB + 1)).toEqual([30, 31])
    const picks = FORMATIONS['4-4-2'].map(([position], index) => ({ position, playerId: wrongWay[index] }))
    expect(cleanTeam(picks, '4-4-2', squad, null, 'win').xi.slice(LEFT_CB, RIGHT_CB + 1)).toEqual([30, 31])
  })
})
