import type { MFLPlayer } from '../types/mflApi'
import {
  FORMATIONS,
  Lineup,
  assignPlayer,
  autoFillLineup,
  bestFreeSlot,
  changeFormation,
  emptyBench,
  emptyXi,
  fromSavedSquad,
  positionFit,
  savedSquadPlayerIds,
  toSavedSquad,
} from '../utils/squadLineups'
import { currentSeason } from '../utils/playerSeasons'

// Every attribute the same, so a player rates their overall at their primary position, less MFL's familiarity penalty elsewhere
const player = (id: number, positions: string[], overall: number, extra: Partial<MFLPlayer['metadata']> = {}): MFLPlayer => {
  const keeper = positions[0] === 'GK'
  const outfield = keeper ? 0 : overall
  return {
    id,
    metadata: {
      firstName: 'Player', lastName: String(id), positions, overall, age: 25,
      pace: outfield, shooting: outfield, passing: outfield, dribbling: outfield, defense: outfield, physical: outfield, goalkeeping: keeper ? overall : 0,
      ...extra,
    },
  } as unknown as MFLPlayer
}

const keeperA = player(1, ['GK'], 80)
const keeperB = player(2, ['GK'], 70)
const cbA = player(3, ['CB'], 85)
const cbB = player(4, ['CB'], 84)
const cbC = player(5, ['CB'], 83)
const lb = player(6, ['LB'], 82)
const rb = player(7, ['RB'], 81)
const cdm = player(8, ['CDM'], 80)
const cmA = player(9, ['CM'], 79)
const cmB = player(10, ['CM'], 78)
const lw = player(11, ['LW'], 77)
const rw = player(12, ['RW'], 76)
const stA = player(13, ['ST'], 75)
const stB = player(14, ['ST'], 74)
const squad = [keeperA, keeperB, cbA, cbB, cbC, lb, rb, cdm, cmA, cmB, lw, rw, stA, stB]
const byId = new Map(squad.map(p => [p.id, p]))

const ids = (players: (MFLPlayer | null)[]) => players.map(p => (p ? p.id : null))

describe('positionFit', () => {
  it('rates a player by how familiar MFL says they are with the position', () => {
    expect(positionFit(cmA, 'CM')).toEqual({ rating: 79, kind: 'natural' })
    expect(positionFit(cmA, 'CDM')).toEqual({ rating: 74, kind: 'alt' }) // Fairly familiar, -5
    expect(positionFit(cmA, 'LM')).toEqual({ rating: 71, kind: 'alt' }) // Somewhat familiar, -8
    expect(positionFit(cmA, 'ST')).toEqual({ rating: 59, kind: 'out' }) // Unfamiliar, -20
    expect(positionFit(player(20, ['RW', 'CAM'], 80), 'CAM')).toEqual({ rating: 79, kind: 'natural' }) // Secondary, -1
  })
})

describe('autoFillLineup', () => {
  it('puts the best player still free in each position, and the next best on the bench with a keeper first', () => {
    const { xi, bench } = autoFillLineup('4-3-3', squad)
    // 4-3-3: GK, LB, CB, CB, RB, CM, CDM, CM, LW, ST, RW
    expect(xi).toEqual(ids([keeperA, lb, cbA, cbB, rb, cmA, cdm, cmB, lw, stA, rw]))
    expect(bench).toEqual([...ids([keeperB, cbC, stB]), null, null, null, null])
  })

  it('can leave out players retiring at the end of this season', () => {
    const retiring = player(31, ['ST'], 99, { retirementYears: 1 })
    expect(autoFillLineup('4-3-3', [...squad, retiring]).xi).toContain(31)
    const { xi, bench } = autoFillLineup('4-3-3', [...squad, retiring], { skipRetiring: true })
    expect([...xi, ...bench]).not.toContain(31)
    expect(xi[9]).toBe(stA.id)
  })

  it('leaves out retired players', () => {
    const retired = player(30, ['ST'], 99, { retirementYears: 0 })
    const { xi, bench } = autoFillLineup('4-3-3', [...squad, retired])
    expect([...xi, ...bench]).not.toContain(30)
  })
})

describe('placing players', () => {
  const lineup: Lineup = { id: 1, name: 'Lineup A', formation: '4-3-3', ...autoFillLineup('4-3-3', squad) }

  it('swaps a player in the lineup with whoever has the slot they move to', () => {
    const moved = assignPlayer(lineup, stB.id, { type: 'xi', index: 9 })
    expect(moved.xi[9]).toBe(stB.id)
    expect(moved.bench[2]).toBe(stA.id)
  })

  it('replaces the player in the slot when one comes from outside the lineup', () => {
    const newcomer = player(40, ['ST'], 90)
    const placed = assignPlayer(lineup, newcomer.id, { type: 'xi', index: 9 })
    expect(placed.xi[9]).toBe(40)
    expect([...placed.xi, ...placed.bench]).not.toContain(stA.id)
  })

  it('clicks a player into the empty position they suit best, then onto the bench', () => {
    const gaps: Lineup = { ...lineup, xi: lineup.xi.map((id, i) => (i === 2 || i === 9 ? null : id)) }
    expect(bestFreeSlot(gaps, stB)).toEqual({ type: 'xi', index: 9 })
    expect(bestFreeSlot(gaps, cbC)).toEqual({ type: 'xi', index: 2 })
    expect(bestFreeSlot(lineup, player(41, ['ST'], 90))).toEqual({ type: 'bench', index: 3 })
  })

  it('keeps the same starters when the formation changes, each in the position they suit best', () => {
    const switched = changeFormation(lineup, '4-4-2', byId)
    expect(new Set(switched.xi)).toEqual(new Set(lineup.xi))
    const at = (position: string) => FORMATIONS['4-4-2'].map(([p], i) => (p === position ? switched.xi[i] : undefined)).filter(Boolean)
    expect(at('GK')).toEqual([keeperA.id])
    expect(at('CB')).toEqual([cbA.id, cbB.id])
    expect(switched.bench).toEqual(lineup.bench)
  })
})

describe('saving squads', () => {
  it('saves every lineup by player ID, with the players as they are now', () => {
    const lineups: Lineup[] = [
      { id: 1, name: 'Lineup A', formation: '4-4-2', xi: [1, ...Array(10).fill(null)], bench: [2, ...Array(6).fill(null)] },
      { id: 2, name: 'Lineup B', formation: '3-5-2', xi: emptyXi(), bench: emptyBench() },
    ]
    const saved = toSavedSquad(lineups, byId)
    expect(saved.formationId).toBe('4-4-2')
    expect(saved.players.lineups).toEqual([
      { name: 'Lineup A', formation: '4-4-2', xi: lineups[0].xi, bench: lineups[0].bench },
      { name: 'Lineup B', formation: '3-5-2', xi: lineups[1].xi, bench: lineups[1].bench },
    ])
    expect(Object.keys(saved.players.players)).toEqual(['1', '2'])

    const loaded = fromSavedSquad({ formation_id: saved.formationId, players: saved.players })
    expect(loaded.lineups.map(({ name, formation, xi, bench }) => ({ name, formation, xi, bench }))).toEqual(saved.players.lineups)
    expect(loaded.players.map(p => p.id)).toEqual([1, 2])
  })

  it('turns a squad saved before lineups into one lineup, with its extra players on the bench', () => {
    const entry = (p: MFLPlayer, position: string) => ({ player: p, position })
    const legacy = {
      formation_id: '4-4-2',
      players: {
        GK: entry(keeperA, 'GK'),
        CB2: entry(cbB, 'CB2'),
        CB1: entry(cbA, 'CB1'),
        ST1: entry(stA, 'ST1'),
        CDM: entry(cdm, 'CDM'), // 4-4-2 has no CDM, so he takes an empty position
        EXTRA2: entry(stB, 'EXTRA2'),
        EXTRA1: entry(keeperB, 'EXTRA1'),
      },
    }
    const { lineups, players, dropped } = fromSavedSquad(legacy)
    expect(lineups).toHaveLength(1)
    const [lineup] = lineups
    expect(lineup.formation).toBe('4-4-2')
    // 4-4-2: GK, LB, CB, CB, RB, LM, CM, CM, RM, ST, ST
    expect(lineup.xi[0]).toBe(keeperA.id)
    expect([lineup.xi[2], lineup.xi[3]]).toEqual([cbB.id, cbA.id])
    expect(lineup.xi[9]).toBe(stA.id)
    expect(lineup.xi[1]).toBe(cdm.id)
    expect(lineup.bench).toEqual([keeperB.id, stB.id, null, null, null, null, null])
    expect(players).toHaveLength(7)
    expect(dropped).toBe(0)
    expect(savedSquadPlayerIds(legacy)).toEqual(new Set([1, 4, 3, 13, 8, 14, 2]))
  })

  it('counts the extra players of an old squad that do not fit on the bench', () => {
    const extras = Object.fromEntries(squad.slice(0, 9).map((p, i) => [`EXTRA${i + 1}`, { player: p, position: `EXTRA${i + 1}` }]))
    const { lineups, dropped } = fromSavedSquad({ formation_id: '4-3-3', players: extras })
    expect(lineups[0].bench).toEqual(squad.slice(0, 7).map(p => p.id))
    expect(dropped).toBe(2)
  })
})

describe('currentSeason', () => {
  it('is the latest season an agency contract started in', () => {
    const contracted = (id: number, startSeason: number) => ({ ...player(id, ['ST'], 70), activeContract: { startSeason } }) as unknown as MFLPlayer
    expect(currentSeason([contracted(1, 26), contracted(2, 27), player(3, ['CB'], 70)])).toBe(27)
    expect(currentSeason([player(3, ['CB'], 70)])).toBeNull()
  })
})
