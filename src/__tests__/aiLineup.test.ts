import type { MFLPlayer } from '../types/mflApi'
import { aimCaptain, bonusLift, lineupFit, squadFits } from '../utils/formationPlanner'
import { FIT_THRESHOLD, fitnessOf, isTired, tiredStarters } from '../utils/fitness'
import { FORMATIONS } from '../utils/squadLineups'
import { cleanTeam } from '../services/matchAnalysis'
import { notesKey } from '../services/clubNotes'

// Every attribute the same, so a player rates their overall at their primary position
const player = (id: number, positions: string[], overall: number, energy = 10000, retirementYears = 3): MFLPlayer => {
  const keeper = positions[0] === 'GK'
  const outfield = keeper ? 0 : overall
  return {
    id,
    energy,
    metadata: {
      firstName: 'Player', lastName: `P${id}`, positions, overall, age: 25, retirementYears,
      pace: outfield, shooting: outfield, passing: outfield, dribbling: outfield, defense: outfield, physical: outfield, goalkeeping: keeper ? overall : 0,
    },
  } as unknown as MFLPlayer
}

// 4-4-2: GK, LB, CB, CB, RB, LM, CM, CM, RM, ST, ST
const POSITIONS = FORMATIONS['4-4-2'].map(([position]) => position)
const xi442 = POSITIONS.map((position, index) => player(index + 1, [position], 80))
const byId = (players: MFLPlayer[]) => new Map(players.map(p => [p.id, p]))

describe('fitness', () => {
  it('reads MFL energy as a percentage and marks players under the threshold tired', () => {
    expect(fitnessOf(player(1, ['CB'], 80, 8771))).toBe(88)
    expect(fitnessOf(undefined)).toBeNull()
    expect(isTired(player(1, ['CB'], 80, (FIT_THRESHOLD - 1) * 100))).toBe(true)
    expect(isTired(player(1, ['CB'], 80, FIT_THRESHOLD * 100))).toBe(false)
  })

  it('lists tired starters with fit cover who play their position, best first, and whether it suits', () => {
    const tiredCb = player(3, ['CB'], 80, 8500)
    const squad = [
      ...xi442.map(p => (p.id === 3 ? tiredCb : p)),
      player(20, ['CB'], 78),
      player(21, ['CB'], 70),
      player(22, ['CB'], 85, 8000), // tired too: not cover
      player(23, ['ST'], 90), // doesn't play CB
    ]
    const [tired, ...others] = tiredStarters('4-4-2', xi442.map(p => p.id), squad)
    expect(others).toHaveLength(0)
    expect(tired).toMatchObject({ position: 'CB', id: 3, fitness: 85, ratingHere: 80 })
    expect(tired.cover.map(cover => cover.id)).toEqual([20, 21])
    expect(tired.cover.map(cover => cover.suitable)).toEqual([true, false])
  })
})

describe('aimCaptain', () => {
  const fit = squadFits(xi442).get('4-4-2')!
  const ids = byId(xi442)

  it('captains a forward to smash them and a defender or keeper not to lose', () => {
    expect(aimCaptain(fit, ids, 'smash')!.line).toBe('ATT')
    expect(['DEF', 'GK']).toContain(aimCaptain(fit, ids, 'notLose')!.line)
    expect(aimCaptain(fit, ids, 'win')).toBe(fit.captain)
  })

  it("doesn't give the armband to a line whose bonus is wasted on attributes already at 99", () => {
    const maxed = POSITIONS.map((position, index) => player(index + 1, [position], 99))
    const maxedFit = squadFits(maxed).get('4-4-2')!
    for (const aim of ['smash', 'notLose'] as const) {
      const captain = aimCaptain(maxedFit, byId(maxed), aim)!
      expect(bonusLift(captain)).toBeLessThan(0.04)
      expect(captain.playerId).toBe(maxedFit.captain!.playerId)
    }
  })
})

describe('lineupFit', () => {
  it('rates a given XI and keeps the captain asked for when they play', () => {
    const ids = xi442.map(p => p.id)
    const fit = lineupFit('4-4-2', ids, byId(xi442), 10)
    expect(fit.slots.map(slot => slot.playerId)).toEqual(ids)
    expect(fit.captain!.playerId).toBe(10)
    expect(fit.ratingWithoutCaptain).toBe(80)
    // Not in the XI: the best captain instead
    expect(lineupFit('4-4-2', ids, byId(xi442), 999).captain!.playerId).toBe(squadFits(xi442).get('4-4-2')!.captain!.playerId)
  })
})

describe('cleanTeam', () => {
  const bench = [player(20, ['CB'], 78), player(21, ['ST'], 79), player(22, ['CM'], 90, 10000, 0)]
  const squad = [...xi442, ...bench]

  it("keeps the model's XI by position, with its captain", () => {
    const picks = POSITIONS.map((position, index) => ({ position, playerId: index === 2 ? 20 : index + 1 }))
    const team = cleanTeam(picks, '4-4-2', squad, 21 - 11, 'win')
    expect(team.formation).toBe('4-4-2')
    expect(team.xi[2]).toBe(20)
    expect(team.xi).toHaveLength(11)
    expect(team.captainId).toBe(10)
  })

  it('places entries by position whatever their order, and fills gaps, repeats, unknowns and retired players', () => {
    const picks = [
      { position: 'ST', playerId: 21 },
      { position: 'GK', playerId: 1 },
      { position: 'CB', playerId: 1 }, // used already
      { position: 'CM', playerId: 999 }, // not ours
      { position: 'CM', playerId: 22 }, // retired
    ]
    const team = cleanTeam(picks, '4-4-2', squad, null, 'smash')
    expect(team.xi[0]).toBe(1)
    expect(team.xi[9]).toBe(21)
    expect(team.xi).not.toContain(22)
    expect(team.xi.every(id => id !== null)).toBe(true)
    expect(new Set(team.xi).size).toBe(11)
    // No captain from the model: a forward, as the aim is to smash them
    const striker = POSITIONS.findIndex((position, index) => position === 'ST' && team.xi[index] === team.captainId)
    expect(striker).toBeGreaterThanOrEqual(0)
  })

  it('builds the best XI when the model gives none', () => {
    const team = cleanTeam(undefined, '4-4-2', xi442, undefined, 'win')
    expect(new Set(team.xi)).toEqual(new Set(xi442.map(p => p.id)))
  })
})

describe('notesKey', () => {
  it('changes with the notes and is 0 for none', () => {
    expect(notesKey('')).toBe('0')
    expect(notesKey('Rest Torres')).toBe(notesKey('Rest Torres'))
    expect(notesKey('Rest Torres')).not.toBe(notesKey('Rest Bader'))
  })
})
