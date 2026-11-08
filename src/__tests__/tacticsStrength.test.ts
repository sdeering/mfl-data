import { TACTIC_SETTINGS } from '../services/matchAnalysis'
import { expectedPoints, playerFormOf, playerSettingEffects, recordOf, settingEffects, type ClubMatchLog, type PlayerLine, type TacticSettings } from '../utils/tacticsHistory'

const team = (step: number, overrides: TacticSettings = {}) => ({ ...Object.fromEntries(TACTIC_SETTINGS.map(setting => [setting.key, step])), ...overrides })
const line = (rating: number, goals = 0): PlayerLine => ({ position: 'ST', minutes: 90, rating, goals, assists: 0, xG: goals * 0.5, shots: goals * 2, chancesCreated: 0, dribbles: 0, duelsWon: 0 })
let nextId = 1
const match = (goalsFor: number, goalsAgainst: number, settings: TacticSettings, extra: Partial<ClubMatchLog> = {}): ClubMatchLog => ({
  matchId: nextId++, startDate: 0, type: 'FRIENDLY', competition: '', opponent: { clubId: 9, name: 'Them' }, home: true,
  goalsFor, goalsAgainst, formation: '4-4-2', opponentFormation: '4-3-3', xGFor: null, xGAgainst: null, settings, ...extra,
})
const vs = (gap: number) => ({ ovrGap: gap, expectedPoints: expectedPoints(gap, true) })

describe('expected points from the OVR gap', () => {
  it('follows the fitted curve', () => {
    expect(expectedPoints(0, true)).toBeCloseTo(1.53, 2)
    expect(expectedPoints(0, false)).toBeCloseTo(1.47, 2)
    expect(expectedPoints(4, false)).toBeCloseTo(2.21, 1)
    expect(expectedPoints(-8, false)).toBeCloseTo(0.32, 1)
    expect(expectedPoints(30, true)).toBeLessThanOrEqual(3)
  })

  it('scores a record against it, over the games where it is known', () => {
    const record = recordOf([match(3, 0, team(3), vs(8)), match(1, 1, team(3), vs(-8)), match(2, 0, team(3))])
    expect(record.expectedGames).toBe(2)
    // A win over a far weaker side is barely above par; a draw with a far stronger one is well above
    expect(record.vsExpected).toBeCloseTo((3 - expectedPoints(8, true) + 1 - expectedPoints(-8, true)) / 2, 5)
    expect(recordOf([match(1, 0, team(3))]).vsExpected).toBeNull()
  })

  it('ranks bands by points against expectation, not raw points', () => {
    // High pressing: two wins over far weaker sides. Low: two draws with far stronger ones
    const logged = [
      match(3, 0, team(3, { triggerPress: 5 }), vs(9)),
      match(2, 0, team(3, { triggerPress: 5 }), vs(9)),
      match(1, 1, team(3, { triggerPress: 1 }), vs(-9)),
      match(0, 0, team(3, { triggerPress: 1 }), vs(-9)),
    ]
    const press = settingEffects(logged).find(effect => effect.key === 'triggerPress')!
    expect(press.bands.high.ppg).toBe(3)
    expect(press.bands.low.ppg).toBe(1)
    expect(press.best).toBe('low')
  })

  it('falls back to points a game when some games have no expectation', () => {
    const logged = [
      match(3, 0, team(3, { triggerPress: 5 }), vs(9)),
      match(2, 0, team(3, { triggerPress: 5 })),
      match(1, 1, team(3, { triggerPress: 1 }), vs(-9)),
      match(0, 0, team(3, { triggerPress: 1 }), vs(-9)),
    ]
    expect(settingEffects(logged).find(effect => effect.key === 'triggerPress')!.best).toBe('high')
  })
})

describe("judging instructions by the player's own numbers", () => {
  const striker = 251866
  const logged = [
    match(2, 1, team(3), { players: { [striker]: { shooting: 5 } }, playerStats: { [striker]: line(6.2, 0) } }),
    match(1, 0, team(3), { players: { [striker]: { shooting: 5 } }, playerStats: { [striker]: line(6.6, 0) } }),
    match(1, 1, team(3), { players: {}, playerStats: { [striker]: line(8.1, 2) } }),
    match(0, 1, team(3), { players: {}, playerStats: {} }),
  ]

  it('averages a player over the matches they played, leaving out cameos', () => {
    expect(playerFormOf(logged, striker)).toMatchObject({ games: 3, rating: 6.97, goals: 0.67 })
    const cameo = match(1, 0, team(3), { playerStats: { [striker]: { ...line(9.9, 1), minutes: 5 } } })
    expect(playerFormOf([...logged, cameo], striker)).toMatchObject({ games: 3, rating: 6.97 })
    expect(playerFormOf(logged.slice(3), striker)).toBeNull()
  })

  it("gives the player's form with each step and on the team's step", () => {
    const [effect] = playerSettingEffects(logged)
    expect(effect).toMatchObject({ playerId: striker, key: 'shooting' })
    expect(effect.bySteps[0]).toMatchObject({ step: 5, record: { games: 2, wins: 2 }, form: { games: 2, rating: 6.4, goals: 0 } })
    expect(effect.team.games).toBe(2)
    expect(effect.teamForm).toMatchObject({ games: 1, rating: 8.1, goals: 2 })
  })
})
