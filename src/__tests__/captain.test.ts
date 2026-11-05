import type { MFLPlayer } from '../types/mflApi'
import { CAPTAIN_BONUS, CAPTAIN_OVR, captainOptions, describeBonus } from '../utils/captain'
import { squadFits } from '../utils/formationPlanner'
import { FORMATIONS, XI_SIZE, positionFit } from '../utils/squadLineups'

// Every attribute the same, so a player rates their overall at their primary position
const player = (id: number, positions: string[], overall: number): MFLPlayer => {
  const keeper = positions[0] === 'GK'
  const outfield = keeper ? 0 : overall
  return {
    id,
    metadata: {
      firstName: 'Player', lastName: `P${id}`, positions, overall, age: 25, retirementYears: 3,
      pace: outfield, shooting: outfield, passing: outfield, dribbling: outfield, defense: outfield, physical: outfield, goalkeeping: keeper ? overall : 0,
    },
  } as unknown as MFLPlayer
}

// 4-4-2: GK, LB, CB, CB, RB, LM, CM, CM, RM, ST, ST
const xi442 = FORMATIONS['4-4-2'].map(([position], index) => player(index + 1, [position], 80))
const byId = new Map(xi442.map(p => [p.id, p]))
const ids = xi442.map(p => p.id)

describe('captainOptions', () => {
  it("gives the captain +2 and every player the bonus for the captain's position", () => {
    const options = captainOptions('4-4-2', ids, byId)
    expect(options).toHaveLength(XI_SIZE)
    const striker = options.find(option => option.position === 'ST')!
    expect(striker.line).toBe('ATT')
    // By hand: the XI with +2 shooting and +1 pace, and +2 for the captain
    const boostedTotal = xi442.reduce((total, p, index) => {
      const position = FORMATIONS['4-4-2'][index][0]
      const metadata = { ...p.metadata, shooting: p.metadata.shooting + 2, pace: p.metadata.pace + 1 }
      return total + positionFit({ ...p, metadata } as MFLPlayer, position).rating
    }, 0)
    expect(striker.rating).toBeCloseTo((boostedTotal + CAPTAIN_OVR) / XI_SIZE)
    expect(striker.gain).toBeCloseTo(striker.rating - 80)
    expect(striker.gain).toBeGreaterThanOrEqual(CAPTAIN_OVR / XI_SIZE)
  })

  it('puts the captain who lifts the XI most first, and players on the same line level', () => {
    const options = captainOptions('4-4-2', ids, byId)
    for (let i = 1; i < options.length; i++) expect(options[i - 1].rating).toBeGreaterThanOrEqual(options[i].rating)
    const midfield = options.filter(option => option.line === 'MID')
    expect(new Set(midfield.map(option => option.rating.toFixed(6))).size).toBe(1)
  })

  it('leaves out empty positions', () => {
    expect(captainOptions('4-4-2', [...ids.slice(0, 10), null], byId)).toHaveLength(10)
  })

  it('lists each bonus as MFL does', () => {
    expect(CAPTAIN_BONUS.GK).toEqual({ defense: 2 })
    expect(describeBonus('DEF')).toBe('+2 DEF, +1 PHY')
    expect(describeBonus('MID')).toBe('+2 PAS, +1 DRI')
    expect(describeBonus('ATT')).toBe('+2 SHO, +1 PAC')
  })
})

describe('squadFits with a captain', () => {
  it("rates each formation's XI with its best captain, and keeps the rating without one", () => {
    const fit = squadFits(xi442).get('4-4-2')!
    expect(fit.ratingWithoutCaptain).toBe(80)
    expect(fit.captain).not.toBeNull()
    expect(fit.rating).toBeCloseTo(fit.captain!.rating)
    expect(fit.rating).toBeGreaterThan(fit.ratingWithoutCaptain)
  })
})
