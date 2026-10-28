import type { MFLPlayer } from '../types/mflApi'
import {
  buildFormationMeta,
  matchResult,
  metaPpg,
  metaShare,
  predictFormations,
  rankFormations,
  seasonField,
  splitByMatchDay,
  squadFits,
  type FormationFit,
  type PlayedMatch,
} from '../utils/formationPlanner'
import { FORMATION_NAMES } from '../utils/squadLineups'
import { parseClubId } from '../services/scoutService'
import { clubsService } from '../services/clubsService'

// Every attribute the same, so a player rates their overall at their primary position, less MFL's familiarity penalty elsewhere
const player = (id: number, positions: string[], overall: number): MFLPlayer => {
  const keeper = positions[0] === 'GK'
  const outfield = keeper ? 0 : overall
  return {
    id,
    metadata: {
      firstName: 'Player', lastName: String(id), positions, overall, age: 25, retirementYears: 3,
      pace: outfield, shooting: outfield, passing: outfield, dribbling: outfield, defense: outfield, physical: outfield, goalkeeping: keeper ? overall : 0,
    },
  } as unknown as MFLPlayer
}

// A small meta: 4-4-2 beats 4-3-3 and loses to 5-3-2; 4-3-3 beats 5-3-2
const snapshot = {
  source: 'test', engine: '1.0', maxOvrDifference: 22, fetchedAt: '2026-10-28',
  rows: [
    ['4-4-2', '4-3-3', 600, 200, 200, 0, 0],
    ['4-3-3', '4-4-2', 200, 200, 600, 0, 0],
    ['4-4-2', '5-3-2', 200, 200, 600, 0, 0],
    ['5-3-2', '4-4-2', 600, 200, 200, 0, 0],
    ['4-3-3', '5-3-2', 600, 200, 200, 0, 0],
    ['5-3-2', '4-3-3', 200, 200, 600, 0, 0],
    ['4-4-2', '4-4-2', 100, 100, 100, 0, 0],
    ['4-3-3', '4-3-3', 100, 100, 100, 0, 0],
    ['5-3-2', '5-3-2', 100, 100, 100, 0, 0],
  ],
}
const meta = buildFormationMeta(snapshot)

const played = (formation: string | null, opponentFormation: string | null, goalsFor: number, goalsAgainst: number): PlayedMatch =>
  ({ formation, opponentFormation, goalsFor, goalsAgainst })

describe('formation meta', () => {
  it('reads the bundled mfl-coach snapshot: every MFL formation against every other', () => {
    const bundled = buildFormationMeta()
    expect(bundled.cells.size).toBe(FORMATION_NAMES.length ** 2)
    expect([...bundled.overall.keys()].sort()).toEqual([...FORMATION_NAMES].sort())
    expect(bundled.averagePpg).toBeGreaterThan(1.2)
    expect(bundled.averagePpg).toBeLessThan(1.6)
  })

  it('expects more points from a formation that beats the other, and pulls a thin pairing toward the overall records', () => {
    expect(metaPpg(meta, '4-4-2', '4-3-3')).toBeGreaterThan(1.9)
    expect(metaPpg(meta, '4-3-3', '4-4-2')).toBeLessThan(1.1)
    // Never played: the two formations' overall records decide, so it lands near the average
    expect(Math.abs(metaPpg(meta, '4-1-4-1', '3-5-2') - meta.averagePpg)).toBeLessThan(0.01)
  })

  it('shares out play by how often a formation appears', () => {
    expect(metaShare(meta, '4-4-2') + metaShare(meta, '4-3-3') + metaShare(meta, '5-3-2')).toBeCloseTo(1)
    expect(metaShare(meta, '3-4-3')).toBe(0)
  })
})

describe('squadFits', () => {
  // A narrow diamond: back four, CDM, two CMs, CAM and two strikers, and no one wide at all
  const noWingers = [
    player(1, ['GK'], 80), player(2, ['CB'], 80), player(3, ['CB'], 80), player(4, ['LB'], 80), player(5, ['RB'], 80),
    player(6, ['CDM'], 80), player(7, ['CM'], 80), player(8, ['CM'], 80), player(9, ['CAM'], 80),
    player(10, ['ST'], 80), player(11, ['ST'], 80), player(12, ['CB'], 80),
  ]

  it('marks down formations the squad has to fill out of position, and names the positions', () => {
    const fits = squadFits(noWingers)
    expect(fits.get('4-1-2-1-2_narrow')!.gap).toBe(0)
    expect(fits.get('4-1-2-1-2_narrow')!.outOfPosition).toEqual([])
    expect(fits.get('4-3-3')!.gap).toBeGreaterThan(1)
    expect(fits.get('4-3-3')!.outOfPosition.some(position => position === 'LW' || position === 'RW')).toBe(true)
  })

  it('is empty without players', () => {
    expect(squadFits([]).size).toBe(0)
  })
})

describe('predictFormations', () => {
  const fits = (gaps: Record<string, number>) =>
    new Map<string, FormationFit>(FORMATION_NAMES.map(formation => [formation, { formation, rating: 80, gap: gaps[formation] ?? 3, outOfPosition: [] }]))

  it('expects what a club has been playing, the latest counting most', () => {
    const matches = [played('4-4-2', '4-3-3', 1, 0), played('4-4-2', '4-3-3', 1, 0), played('4-3-3', '4-3-3', 1, 0), played('4-3-3', '4-3-3', 1, 0)]
    const guesses = predictFormations(matches, fits({ '4-4-2': 0, '4-3-3': 0 }), meta)
    expect(guesses[0].formation).toBe('4-4-2')
    expect(guesses[0].timesPlayed).toBe(2)
    expect(guesses[1].formation).toBe('4-3-3')
    expect(guesses.reduce((total, guess) => total + guess.probability, 0)).toBeCloseTo(1)
  })

  it('doubts a formation the squad can no longer line up in', () => {
    const matches = [played('4-3-3', '4-4-2', 1, 0), played('4-3-3', '4-4-2', 1, 0), played('4-3-3', '4-4-2', 1, 0)]
    const canStillPlay = predictFormations(matches, fits({ '4-3-3': 0, '4-4-2': 0 }), meta)
    const lostWingers = predictFormations(matches, fits({ '4-3-3': 6, '4-4-2': 0 }), meta)
    const share = (guesses: typeof canStillPlay) => guesses.find(guess => guess.formation === '4-3-3')!.probability
    expect(share(lostWingers)).toBeLessThan(share(canStillPlay) / 2)
  })

  it('falls back on popular formations the squad suits, with no history', () => {
    const guesses = predictFormations([], fits({ '4-4-2': 0, '4-3-3': 0, '5-3-2': 0 }), meta)
    expect(['4-4-2', '4-3-3', '5-3-2']).toContain(guesses[0].formation)
    expect(guesses[0].timesPlayed).toBe(0)
  })
})

describe('rankFormations', () => {
  const evenFits = new Map<string, FormationFit>()

  it('counters the likely formation with the one the meta says beats it', () => {
    const picks = rankFormations([{ formation: '4-3-3', probability: 1, timesPlayed: 5 }], evenFits, [], [], meta)
    expect(picks[0].formation).toBe('4-4-2')
    expect(picks[0].score).toBeCloseTo(picks[0].meta)
  })

  it('takes off points for a formation our squad lines up badly in', () => {
    const fits = new Map<string, FormationFit>([['4-4-2', { formation: '4-4-2', rating: 70, gap: 5, outOfPosition: ['LM', 'RM'] }]])
    const picks = rankFormations([{ formation: '4-3-3', probability: 1, timesPlayed: 5 }], fits, [], [], meta)
    const pick = picks.find(p => p.formation === '4-4-2')!
    expect(pick.fit).toBeCloseTo(-0.5)
    expect(pick.outOfPosition).toEqual(['LM', 'RM'])
  })

  it('nudges a formation by our results with it and by how teams playing it did against the opponent', () => {
    const opposition = [{ formation: '5-3-2', probability: 1, timesPlayed: 5 }]
    // We won with 4-1-4-1 and lost with 4-2-2-2
    const ourMatches = [played('4-1-4-1', '5-3-2', 3, 0), played('4-1-4-1', '5-3-2', 2, 0), played('4-2-2-2', '5-3-2', 0, 1), played('4-2-2-2', '5-3-2', 0, 2)]
    // The opponent lost to 4-2-3-1 twice and beat 3-5-2 twice
    const theirMatches = [played('5-3-2', '4-2-3-1', 0, 2), played('5-3-2', '4-2-3-1', 1, 3), played('5-3-2', '3-5-2', 2, 0), played('5-3-2', '3-5-2', 1, 0)]
    const picks = rankFormations(opposition, evenFits, ourMatches, theirMatches, meta)
    const pick = (formation: string) => picks.find(p => p.formation === formation)!
    expect(pick('4-1-4-1').ourGames).toBe(2)
    expect(pick('4-1-4-1').ourForm).toBeGreaterThan(0)
    expect(pick('4-1-4-1').ourForm).toBeLessThan(1) // two games only nudge it
    expect(pick('4-2-2-2').ourForm).toBeLessThan(0)
    expect(pick('4-2-3-1').theirGames).toBe(2)
    expect(pick('4-2-3-1').theirRecord).toBeGreaterThan(0)
    expect(pick('3-5-2').theirRecord).toBeLessThan(0)
  })

  it("doesn't credit a formation with a strong team's wins when it's all the team plays", () => {
    const opposition = [{ formation: '5-3-2', probability: 1, timesPlayed: 5 }]
    const alwaysWinning = Array.from({ length: 10 }, () => played('4-1-4-1', '5-3-2', 4, 0))
    const pick = rankFormations(opposition, evenFits, alwaysWinning, [], meta).find(p => p.formation === '4-1-4-1')!
    expect(pick.ourGames).toBe(10)
    expect(pick.ourForm).toBeCloseTo(0)
  })
})

describe('seasonField', () => {
  it('blends the formations faced lately with the whole game', () => {
    const faced = Array.from({ length: 10 }, () => played('4-4-2', '3-4-3', 1, 1))
    const field = seasonField(faced, meta)
    const share = (formation: string) => field.find(guess => guess.formation === formation)!.probability
    expect(share('3-4-3')).toBeCloseTo(0.5) // half from what was faced, nothing from the meta
    expect(field.reduce((total, guess) => total + guess.probability, 0)).toBeCloseTo(1)
  })
})

describe('matchResult', () => {
  it('reads a match from the side it is given', () => {
    expect(matchResult({ goalsFor: 2, goalsAgainst: 1 })).toBe('W')
    expect(matchResult({ goalsFor: 1, goalsAgainst: 1 })).toBe('D')
    expect(matchResult({ goalsFor: 0, goalsAgainst: 1 })).toBe('L')
  })
})

describe('parseClubId', () => {
  it('reads a club ID or a link to the club', () => {
    expect(parseClubId(' 4655 ')).toBe(4655)
    expect(parseClubId('https://app.playmfl.com/clubs/4655')).toBe(4655)
    expect(parseClubId('https://app.playmfl.com/clubs/4655/squad')).toBe(4655)
    expect(parseClubId('Guangzhou')).toBeNull()
  })
})

describe('clubsService.getDivisionName', () => {
  it("uses MFL's division names", () => {
    expect(clubsService.getDivisionName(1)).toBe('Diamond')
    expect(clubsService.getDivisionName(4)).toBe('Silver')
    expect(clubsService.getDivisionName(10)).toBe('Flint')
    expect(clubsService.getDivisionName(null)).toBe('No division')
  })
})

describe('splitByMatchDay', () => {
  const at = (day: number, hour: number) => ({ startDate: new Date(2026, 10, day, hour).getTime() })

  it("shows the next day's league and cup match together, and keeps the rest for later", () => {
    const league = at(2, 9)
    const cup = at(2, 18)
    const nextLeague = at(4, 9)
    expect(splitByMatchDay([league, cup, nextLeague])).toEqual({ next: [league, cup], later: [nextLeague] })
  })

  it('has nothing for no fixtures', () => {
    expect(splitByMatchDay([])).toEqual({ next: [], later: [] })
  })
})
