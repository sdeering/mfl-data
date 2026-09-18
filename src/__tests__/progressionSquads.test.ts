import { ALL_SQUADS, NO_SQUAD, buildSquads, getDefaultSquad, isInSquad } from '../utils/progressionSquads'
import type { MFLPlayer } from '../types/mflApi'

// The page opens on one squad rather than every player, so which squad that is matters

const player = (id: number, age: number, club?: { id: number; name: string }) =>
  ({ id, metadata: { age }, activeContract: club ? { club } : undefined }) as unknown as MFLPlayer

const SCOTLAND = { id: 3578, name: 'DOGESPORTS SCOTLAND' }
const JAPAN = { id: 28, name: 'DogeSports Japan' }
const LOAN_CLUB = { id: 999, name: 'Genesis FC' }

const players = [
  player(1, 30, JAPAN), player(2, 34, JAPAN),
  player(3, 20, SCOTLAND), player(4, 22, SCOTLAND), player(5, 24, SCOTLAND),
  player(6, 18, LOAN_CLUB),
  player(7, 19)
]

describe('buildSquads', () => {
  test('groups players by club with their average age, biggest squad first', () => {
    expect(buildSquads(players, new Set(['28', '3578']))).toEqual([
      { id: '3578', name: 'DOGESPORTS SCOTLAND', playerCount: 3, averageAge: 22, isOwned: true },
      { id: '28', name: 'DogeSports Japan', playerCount: 2, averageAge: 32, isOwned: true },
      { id: '999', name: 'Genesis FC', playerCount: 1, averageAge: 18, isOwned: false }
    ])
  })
})

describe('getDefaultSquad', () => {
  test('opens on the owned club with the lowest average age', () => {
    expect(getDefaultSquad(buildSquads(players, new Set(['28', '3578'])))).toBe('3578')
  })

  test('a younger club the wallet does not own (a loan) is never the default', () => {
    // Genesis FC has the youngest player but is someone else's club
    expect(getDefaultSquad(buildSquads(players, new Set(['28'])))).toBe('28')
  })

  test('without ownership info, only clubs big enough to be a real squad are considered', () => {
    const bigSquad = Array.from({ length: 11 }, (_, i) => player(100 + i, 25, JAPAN))
    expect(getDefaultSquad(buildSquads([...bigSquad, player(6, 18, LOAN_CLUB)], new Set()))).toBe('28')
  })

  test('falls back to every squad when there is nothing to choose from', () => {
    expect(getDefaultSquad(buildSquads([player(7, 19)], new Set()))).toBe(ALL_SQUADS)
    expect(getDefaultSquad([])).toBe(ALL_SQUADS)
  })
})

describe('isInSquad', () => {
  test('matches by club, players without a club, or everyone', () => {
    const inSquad = (filter: string) => players.filter(p => isInSquad(p, filter)).map(p => p.id)

    expect(inSquad('3578')).toEqual([3, 4, 5])
    expect(inSquad(NO_SQUAD)).toEqual([7])
    expect(inSquad(ALL_SQUADS)).toHaveLength(7)
  })
})
