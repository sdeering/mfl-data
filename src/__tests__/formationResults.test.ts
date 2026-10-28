/**
 * @jest-environment node
 */
jest.mock('../lib/db-helpers', () => ({ executeRaw: jest.fn() }))
jest.mock('../services/agencyLoader', () => ({ MFL_BLOCK: 'mfl' }))

import { engineVersion, recordFormationResults, toFormationResult, type MatchDetails } from '../services/formationResults'
import { BUNDLED_META, MIN_OWN_GAMES, chooseFormationMeta } from '../utils/formationPlanner'
import { executeRaw } from '../lib/db-helpers'

// A starting XI at `overall`, and a bench of 70s that mustn't count
const xi = (overall: number) => ({
  positions: Array.from({ length: 18 }, (_, index) => ({ index, player: { metadata: { overall: index < 11 ? overall : 70 } } })),
})

const details = (extra: Partial<MatchDetails> = {}): MatchDetails => ({
  status: 'ENDED',
  engine: '16.0.2/10.5.5',
  startDate: 1792615500000,
  homeScore: 2,
  awayScore: 1,
  homeSquad: { id: 102813 },
  awaySquad: { id: 482 },
  homeFormation: { type: '4-1-2-1-2', ...xi(80) },
  awayFormation: { type: '4-3-3_attack', ...xi(82) },
  ...extra,
})

describe('engineVersion', () => {
  it("keeps the major and minor version of MFL's engine", () => {
    expect(engineVersion('16.0.2/10.5.5')).toBe('16.0')
    expect(engineVersion('16.0.0-beta.12/10.4.4')).toBe('16.0')
    expect(engineVersion('15.3')).toBe('15.3')
    expect(engineVersion(undefined)).toBeNull()
  })
})

describe('toFormationResult', () => {
  it("keeps both formations, the score and each starting XI's overall added up", () => {
    expect(toFormationResult(2714166, details())).toEqual({
      matchId: 2714166,
      engine: '16.0',
      startDate: 1792615500000,
      homeSquadId: 102813,
      awaySquadId: 482,
      homeFormation: '4-1-2-1-2',
      awayFormation: '4-3-3_attack',
      homeScore: 2,
      awayScore: 1,
      homeOvr: 880,
      awayOvr: 902,
    })
  })

  it("skips a match that hasn't finished or is missing a formation", () => {
    expect(toFormationResult(1, details({ status: 'LIVE' }))).toBeNull()
    expect(toFormationResult(1, details({ awayFormation: null }))).toBeNull()
  })
})

describe('recordFormationResults', () => {
  const mockExecuteRaw = executeRaw as jest.Mock
  const env = process.env.TURSO_DATABASE_URL
  afterEach(() => {
    process.env.TURSO_DATABASE_URL = env
    mockExecuteRaw.mockReset()
  })

  it('inserts every row in one statement, skipping matches kept already', async () => {
    process.env.TURSO_DATABASE_URL = 'file:test.db'
    mockExecuteRaw.mockResolvedValue({ data: [], error: null })
    await recordFormationResults([toFormationResult(1, details())!, toFormationResult(2, details())!])
    const [sql, args] = mockExecuteRaw.mock.calls[0]
    expect(sql).toContain('INSERT OR IGNORE INTO formation_results')
    expect(args).toHaveLength(22)
  })

  it('does nothing without a database', async () => {
    delete process.env.TURSO_DATABASE_URL
    await recordFormationResults([toFormationResult(1, details())!])
    expect(mockExecuteRaw).not.toHaveBeenCalled()
  })
})

describe('chooseFormationMeta', () => {
  const own = (totalGames: number) => ({ ...BUNDLED_META, source: 'mfldata', engine: '16.0', rows: [['4-4-2', '4-3-3', 1, 0, 0, 1, 0]], totalGames })

  it("uses the mfl-coach snapshot until our own meta has enough games, then ours", () => {
    expect(chooseFormationMeta(null).source).toBe(BUNDLED_META.source)
    expect(chooseFormationMeta(own(MIN_OWN_GAMES - 1)).source).toBe(BUNDLED_META.source)
    expect(chooseFormationMeta(own(MIN_OWN_GAMES)).source).toBe('mfldata')
  })
})
