import { playerSettingsFrom, sameTactics, stepOf, teamSettingsFrom, type ReportFormation } from '../utils/mflTactics'
import { validPlayerSettings, validSettings } from '../utils/tacticsHistory'

// DogeSports Scotland's side of the report of match 2971564 (8-0), as MFL shows it to the owner
const report: ReportFormation = {
  type: '4-4-2',
  depth: 0.85,
  compactness: 1.15,
  pressing: null,
  clearance: 0.5,
  aggressivity: null,
  width: 1.5,
  directness: 1.15,
  sideAttackLeft: 0.75,
  dribble: 1.25,
  farShot: 1.5,
  crosses: null,
  riskPass: null,
  fluidity: null,
  offensiveEngagement: 1.5,
  playersInstructions: {
    '4': { def: { pressing: 0.75 }, off: { offensiveEngagement: 0.5 } },
    '5': { def: {}, off: { fluidity: 1.5, dribble: 1.5, riskPass: 1.5 } },
    '10': { def: {}, off: { fluidity: 1.5, directness: 1.3, farShot: 2 } },
  },
}
const xi = [278579, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]

describe('MFL tactics to steps', () => {
  it('reads every team setting, null as the middle step', () => {
    const settings = teamSettingsFrom(report)
    expect(settings).toEqual({
      attackingWidth: 4,
      directness: 4,
      flankPreference: 4,
      shooting: 4,
      crossing: 3,
      dribbling: 4,
      attackTendency: 4,
      teamDepth: 2,
      compactness: 2,
      triggerPress: 3,
      aggressiveness: 3,
      clearances: 2,
    })
    expect(validSettings(settings)).toEqual(settings)
  })

  it('reads the reversed settings the right way round', () => {
    // Flank preference step 1 prioritises the left; compactness step 1 is the tight block
    expect(teamSettingsFrom({ sideAttackLeft: 1.5, compactness: 1.3 })).toMatchObject({ flankPreference: 1, compactness: 1 })
    expect(teamSettingsFrom({ sideAttackLeft: 0.5, compactness: 0.7 })).toMatchObject({ flankPreference: 5, compactness: 5 })
  })

  it('snaps expert-mode values between steps to the nearest', () => {
    expect(stepOf([0, 0.5, 1, 1.5, 2], 1.6)).toBe(4)
    expect(stepOf([0.7, 0.85, 1, 1.15, 1.3], 0.2)).toBe(1)
    expect(stepOf([0.7, 0.85, 1, 1.15, 1.3], 9)).toBe(5)
  })

  it('reads individual instructions by the player in that position', () => {
    const players = playerSettingsFrom(report, index => xi[index])
    expect(players).toEqual({
      '14': { triggerPress: 2, attackTendency: 2 },
      '15': { positionFreedom: 4, dribbling: 5, passingRisk: 4 },
      '20': { positionFreedom: 4, directness: 5, shooting: 5 },
    })
    expect(validPlayerSettings(players)).toEqual(players)
  })

  it('leaves out players it cannot place and players with nothing set', () => {
    const players = playerSettingsFrom(
      { playersInstructions: { '3': { def: {}, off: {} }, '7': { off: { dribble: 0.5 } }, '12': { off: { dribble: 0.5 } } } },
      index => (index === 7 ? undefined : xi[index]),
    )
    expect(players).toEqual({})
  })

  it('tells the same tactics from different ones', () => {
    const settings = teamSettingsFrom(report)
    const players = playerSettingsFrom(report, index => xi[index])
    const copy = JSON.parse(JSON.stringify({ settings, players }))
    expect(sameTactics({ settings, players }, copy)).toBe(true)
    expect(sameTactics({ settings, players }, { settings: { ...settings, crossing: 4 }, players })).toBe(false)
    expect(sameTactics({ settings, players }, { settings, players: { ...players, '11': { shooting: 1 } } })).toBe(false)
    expect(sameTactics({ settings, players }, { settings, players: { ...players, '14': { triggerPress: 2 } } })).toBe(false)
    expect(sameTactics({ settings, players: {} }, { settings, players: {} })).toBe(true)
  })
})
