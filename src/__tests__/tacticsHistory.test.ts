import { TACTIC_SETTINGS, type MatchAnalysis } from '../services/matchAnalysis'
import {
  adviceAgreement,
  adviceFrom,
  adviceRecord,
  bandOf,
  followedAdvice,
  playerSettingEffects,
  recordOf,
  settingEffects,
  similarMatches,
  validPlayerSettings,
  validSettings,
  type ClubMatchLog,
  type TacticSettings,
} from '../utils/tacticsHistory'

const allAt = (step: number, overrides: Partial<TacticSettings> = {}): TacticSettings => ({
  ...Object.fromEntries(TACTIC_SETTINGS.map(setting => [setting.key, step])),
  ...overrides,
}) as TacticSettings

let nextId = 1
const match = (goalsFor: number, goalsAgainst: number, settings: TacticSettings | null, extra: Partial<ClubMatchLog> = {}): ClubMatchLog => ({
  matchId: nextId++, startDate: 0, type: 'LEAGUE', competition: '', opponent: { clubId: 9, name: 'Them' }, home: true,
  goalsFor, goalsAgainst, formation: '4-4-2', opponentFormation: '4-3-3', xGFor: 1, xGAgainst: 1, settings, ...extra,
})

describe('individual instructions and advice', () => {
  const team = (step: number) => Object.fromEntries(TACTIC_SETTINGS.map(setting => [setting.key, step]))

  it('accepts known player settings as whole steps, and rejects anything else', () => {
    expect(validPlayerSettings(undefined)).toEqual({})
    expect(validPlayerSettings({ 12: { dribbling: 5, passingRisk: 2 }, 13: {} })).toEqual({ 12: { dribbling: 5, passingRisk: 2 } })
    expect(validPlayerSettings({ 12: { teamDepth: 2 } })).toBeNull() // team only
    expect(validPlayerSettings({ 12: { dribbling: 6 } })).toBeNull()
    expect(validPlayerSettings({ abc: { dribbling: 2 } })).toBeNull()
    expect(validPlayerSettings([1])).toBeNull()
  })

  it('keeps an analysis as advice', () => {
    const analysis = {
      formation: { pick: '4-3-3', reason: '' },
      captain: { player: 'LW Alcantara', reason: '' },
      tactics: TACTIC_SETTINGS.map(setting => ({ key: setting.key, step: 4, reason: '' })),
      players: [{ playerId: 7, position: 'LM', name: 'Pavlović', reason: '', settings: [{ key: 'dribbling', step: 5, reason: '' }] }],
    } as unknown as MatchAnalysis
    expect(adviceFrom(analysis, 'win')).toEqual({ formation: '4-3-3', aim: 'win', captain: 'LW Alcantara', settings: team(4), players: { 7: { dribbling: 5 } } })
    expect(adviceFrom({ ...analysis, tactics: [] }, 'win').settings).toBeNull()
  })

  it('judges whether we followed the advice, and our record each way', () => {
    const advice = { formation: '4-3-3', aim: 'win', captain: null, settings: team(4), players: {}, createdAt: '' }
    const nineOfTwelve = { ...team(4), ...Object.fromEntries(TACTIC_SETTINGS.slice(0, 3).map(setting => [setting.key, 2])) }
    const followed = match(2, 0, nineOfTwelve, { advice })
    const ignored = match(0, 1, team(2), { advice })
    expect(adviceAgreement(nineOfTwelve, team(4))).toEqual({ same: 9, total: 12 })
    expect(followedAdvice(followed)).toBe(true)
    expect(followedAdvice(ignored)).toBe(false)
    expect(followedAdvice(match(1, 1, team(3)))).toBeNull()
    const record = adviceRecord([followed, ignored, match(1, 1, team(3))])!
    expect(record.followed.wins).toBe(1)
    expect(record.ignored.losses).toBe(1)
    expect(adviceRecord([match(1, 1, team(3))])).toBeNull()
  })

  it('records each individual instruction tried, by step, against the matches without it', () => {
    const matches = [
      match(3, 0, team(3), { players: { 7: { dribbling: 5 } } }),
      match(2, 1, team(3), { players: { 7: { dribbling: 5 }, 9: { shooting: 4 } } }),
      match(0, 1, team(3), { players: { 7: { dribbling: 2 } } }),
      match(1, 1, team(3)),
    ]
    const [dribbling, shooting] = playerSettingEffects(matches)
    expect(dribbling).toMatchObject({ playerId: 7, key: 'dribbling' })
    expect(dribbling.bySteps.map(item => [item.step, item.record.games, item.record.wins])).toEqual([[2, 1, 0], [5, 2, 2]])
    expect(dribbling.team.games).toBe(1)
    expect(shooting).toMatchObject({ playerId: 9, key: 'shooting' })
    expect(shooting.team.games).toBe(3)
  })
})

describe('validSettings', () => {
  it('takes every setting as a whole step from 1 to 5', () => {
    expect(validSettings(allAt(3))).toEqual(allAt(3))
  })

  it('refuses a missing setting, a step out of range or not whole, and anything else', () => {
    const { shooting: _shooting, ...missing } = allAt(3)
    expect(validSettings(missing)).toBeNull()
    expect(validSettings(allAt(3, { shooting: 6 }))).toBeNull()
    expect(validSettings(allAt(3, { shooting: 2.5 }))).toBeNull()
    expect(validSettings('3')).toBeNull()
  })
})

describe('recordOf', () => {
  it('counts results, points a game and xG difference', () => {
    const record = recordOf([match(2, 0, null, { xGFor: 2, xGAgainst: 0.5 }), match(1, 1, null), match(0, 1, null, { xGFor: null, xGAgainst: null })])
    expect(record).toMatchObject({ games: 3, wins: 1, draws: 1, losses: 1 })
    expect(record.ppg).toBeCloseTo(4 / 3)
    expect(record.xgDiff).toBeCloseTo(0.75)
  })

  it('has no averages for no games', () => {
    expect(recordOf([])).toMatchObject({ games: 0, ppg: null, xgDiff: null })
  })
})

describe('settingEffects', () => {
  it('groups steps low 1-2, middle 3, high 4-5', () => {
    expect([1, 2, 3, 4, 5].map(bandOf)).toEqual(['low', 'low', 'mid', 'high', 'high'])
  })

  it('picks the band with the most points a game, among those played twice or more', () => {
    const matches = [
      match(2, 0, allAt(3, { flankPreference: 1 })),
      match(1, 0, allAt(3, { flankPreference: 2 })),
      match(0, 1, allAt(3, { flankPreference: 5 })),
      match(1, 1, allAt(3, { flankPreference: 4 })),
      match(5, 0, allAt(3, { flankPreference: 3 })),
      match(0, 0, null),
    ]
    const flank = settingEffects(matches).find(effect => effect.key === 'flankPreference')!
    expect(flank.bands.low).toMatchObject({ games: 2, ppg: 3 })
    expect(flank.bands.high).toMatchObject({ games: 2, ppg: 0.5 })
    // One game at mid doesn't count, however well it went
    expect(flank.best).toBe('low')
    // Only one band played
    expect(settingEffects(matches).find(effect => effect.key === 'shooting')!.best).toBeNull()
  })

  it('breaks a tie on points with xG, and has no best when that ties too', () => {
    const tie = (lowXg: number) => [
      match(1, 0, allAt(3, { crossing: 1 }), { xGFor: lowXg }),
      match(1, 0, allAt(3, { crossing: 1 }), { xGFor: lowXg }),
      match(1, 0, allAt(3, { crossing: 5 })),
      match(1, 0, allAt(3, { crossing: 5 })),
    ]
    expect(settingEffects(tie(2)).find(effect => effect.key === 'crossing')!.best).toBe('low')
    expect(settingEffects(tie(1)).find(effect => effect.key === 'crossing')!.best).toBeNull()
  })
})

describe('similarMatches', () => {
  it('finds logged matches against the club and against the formation', () => {
    const sameClub = match(1, 0, allAt(3), { opponent: { clubId: 5, name: 'Five' }, opponentFormation: '5-3-2' })
    const sameShape = match(1, 0, allAt(3), { opponentFormation: '4-1-3-2' })
    const unlogged = match(1, 0, null, { opponent: { clubId: 5, name: 'Five' }, opponentFormation: '4-1-3-2' })
    expect(similarMatches([sameClub, sameShape, unlogged], 5, '4-1-3-2')).toEqual({ sameOpponent: [sameClub], sameFormation: [sameShape] })
  })
})
