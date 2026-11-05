import type { MFLPlayer } from '../types/mflApi'
import { squadFits } from '../utils/formationPlanner'
import { compareSquads, findWeaknesses, xiPlayers, type XiPlayer } from '../utils/squadComparison'
import { summariseReports, type ReportPlayerStats } from '../services/matchAnalysis'

// Every outfield attribute the same unless given, so a player rates their overall at their primary position
const player = (id: number, positions: string[], overall: number, attributes: Partial<Record<string, number>> = {}): MFLPlayer => {
  const keeper = positions[0] === 'GK'
  const outfield = keeper ? 0 : overall
  return {
    id,
    metadata: {
      firstName: 'Player', lastName: `P${id}`, positions, overall, age: 25, retirementYears: 3, preferredFoot: 'RIGHT',
      pace: outfield, shooting: outfield, passing: outfield, dribbling: outfield, defense: outfield, physical: outfield, goalkeeping: keeper ? overall : 0,
      ...attributes,
    },
  } as unknown as MFLPlayer
}

// A 4-4-2 squad: the ratings by position, ids from `start`
const squad442 = (start: number, ratings: Record<string, number>, attributes: Record<string, Partial<Record<string, number>>> = {}) => {
  const positions = ['GK', 'LB', 'CB', 'CB', 'RB', 'LM', 'CM', 'CM', 'RM', 'ST', 'ST']
  return positions.map((position, index) => {
    const key = `${position}${positions.slice(0, index).filter(p => p === position).length || ''}`
    return player(start + index, [position], ratings[key] ?? ratings[position] ?? 80, attributes[key] ?? attributes[position])
  })
}

const xiOf = (players: MFLPlayer[], formation = '4-4-2') =>
  xiPlayers(formation, squadFits(players).get(formation), new Map(players.map(p => [p.id, p])))

describe('xiPlayers', () => {
  it('lists the XI by position, with each player on their side of the pitch', () => {
    const xi = xiOf(squad442(1, {}))
    expect(xi).toHaveLength(11)
    expect(xi.find(p => p.position === 'LB')).toMatchObject({ side: 'left', line: 'DEF', rating: 80, kind: 'natural' })
    expect(xi.find(p => p.position === 'RM')).toMatchObject({ side: 'right', line: 'MID' })
    expect(xi.find(p => p.position === 'GK')).toMatchObject({ side: 'centre', line: 'GK' })
  })

  it('is empty without a fit', () => {
    expect(xiPlayers('4-4-2', undefined, new Map())).toEqual([])
  })
})

describe('compareSquads', () => {
  it('compares the XIs, each line and the outfield attributes', () => {
    const ours = squad442(1, { ST: 90 })
    const theirs = squad442(100, { CB: 70 })
    const comparison = compareSquads(xiOf(ours), xiOf(theirs), ours, theirs)
    const row = (rows: { label: string; ours: number | null; theirs: number | null }[], label: string) => rows.find(r => r.label === label)!
    expect(row(comparison.lines, 'Attack')).toMatchObject({ ours: 90, theirs: 80 })
    expect(row(comparison.lines, 'Defence')).toMatchObject({ ours: 80, theirs: 75 })
    expect(row(comparison.overall, 'Starting XI').ours).toBeCloseTo((9 * 80 + 2 * 90) / 11, 1)
    expect(row(comparison.attributes, 'Pace').theirs).toBeCloseTo((8 * 80 + 2 * 70) / 10, 1)
  })

  it('leaves retired players out of the squad averages', () => {
    const ours = [...squad442(1, {}), { ...player(50, ['ST'], 40), metadata: { ...player(50, ['ST'], 40).metadata, retirementYears: 0 } } as MFLPlayer]
    const comparison = compareSquads(xiOf(ours), xiOf(ours), ours, ours)
    expect(comparison.overall.find(r => r.label === 'Whole squad')!.ours).toBe(80)
  })
})

describe('findWeaknesses', () => {
  const titles = (found: { title: string }[]) => found.map(item => item.title)

  it("sends us down the flank of their weak full-back: their left is our right", () => {
    const ours = xiOf(squad442(1, {}))
    const theirs = xiOf(squad442(100, { LB: 70 }))
    const [first] = findWeaknesses(ours, theirs, [])
    expect(first.title).toBe('Attack down your right flank')
    expect(first.detail).toContain('Their LB P101 rates 70')
    // Our right midfielder first, then our right-back
    expect(first.detail).toContain('Your RM P9 (80) and RB P5 (80) go at them')
  })

  it('points at pace in behind, and at their quicker forwards', () => {
    const ours = xiOf(squad442(1, {}, { ST: { pace: 95 }, ST1: { pace: 95 }, CB: { pace: 60 }, CB1: { pace: 60 } }))
    const theirs = xiOf(squad442(100, {}, { CB: { pace: 70 }, CB1: { pace: 70 }, ST: { pace: 90 }, ST1: { pace: 90 } }))
    const found = findWeaknesses(ours, theirs, [])
    expect(titles(found)).toEqual(expect.arrayContaining(['Play in behind', 'Their forwards are quicker']))
    expect(found.find(item => item.title === 'Their forwards are quicker')!.tone).toBe('watch')
  })

  it('reads goals let in lately', () => {
    const xi = xiOf(squad442(1, {}))
    const leaky = [3, 2, 1].map(goalsAgainst => ({ formation: '4-4-2', opponentFormation: '4-4-2', goalsFor: 1, goalsAgainst }))
    const tight = [0, 0, 1].map(goalsAgainst => ({ formation: '4-4-2', opponentFormation: '4-4-2', goalsFor: 1, goalsAgainst }))
    expect(titles(findWeaknesses(xi, xi, leaky))).toContain('Leaky lately')
    expect(findWeaknesses(xi, xi, tight).find(item => item.title === 'Hard to score against')!.detail).toContain('2 clean sheets')
  })

  it('finds nothing without their XI', () => {
    expect(findWeaknesses([] as XiPlayer[], [], [])).toEqual([])
  })
})

describe('summariseReports', () => {
  const line = (playerId: number, stats: Partial<ReportPlayerStats>): ReportPlayerStats =>
    ({ playerId, position: 'CB', time: 5400, rating: 6, goals: 0, assists: 0, shots: 0, shotsOnTarget: 0, xG: 0, chancesCreated: 0, passes: 0, passesAccurate: 0,
      crosses: 0, crossesAccurate: 0, dribblingSuccess: 0, dribbledPast: 0, defensiveDuelsWon: 0, clearances: 0, saves: 0, goalsConceded: 0, yellowCards: 0, redCards: 0, ...stats })

  it("adds up each player's matches and the team's shots and xG for and against", () => {
    const summary = summariseReports(
      [
        { matchId: 1, ours: [line(7, { dribbledPast: 3, rating: 5, shots: 2, xG: 0.4 })], opponents: [line(9, { shots: 5, xG: 1.2 })] },
        { matchId: 2, ours: [line(7, { dribbledPast: 2, rating: 7, passes: 10, passesAccurate: 8 })], opponents: [] },
      ],
      new Map([[7, player(7, ['CB'], 80)]]),
    )
    expect(summary.players[0]).toMatchObject({ name: 'Player P7', games: 2, avgMatchRating: 6, dribbledPast: 5, passAccuracy: 80 })
    expect(summary.matches[0]).toEqual({ matchId: 1, shotsFor: 2, xGFor: 0.4, shotsAgainst: 5, xGAgainst: 1.2 })
  })
})
