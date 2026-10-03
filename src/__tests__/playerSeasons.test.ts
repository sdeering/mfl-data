import { coversSeasons, getSeasonStarts, groupMatchesBySeason } from '../utils/playerSeasons'
import type { PlayerMatchStats } from '../types/playerMatches'

const at = (iso: string) => new Date(`${iso}T19:00:00Z`).getTime()

let nextId = 1000
const match = (iso: string, type: 'LEAGUE' | 'CUP', competitionId: number, startingDate?: string) => ({
  id: nextId--,
  match: {
    type,
    startDate: at(iso),
    competition: { id: competitionId, name: type === 'CUP' ? 'Aspirants Cup' : 'Ice – League 76', code: 'ICE', startingDate: startingDate ? at(startingDate) : undefined }
  }
}) as unknown as PlayerMatchStats

// Player 323034's last three seasons, newest first. Each season's league is a new competition, and the
// first league match can come a day before the date the competition was set to start.
const history = () => [
  match('2026-10-02', 'LEAGUE', 19276, '2026-09-24'),
  match('2026-10-01', 'CUP', 20152),
  match('2026-09-23', 'LEAGUE', 19276, '2026-09-24'), // This season's first match
  match('2026-09-19', 'CUP', 19065), // A cup in the break between seasons: part of the one that just ended
  match('2026-09-09', 'LEAGUE', 18121, '2026-08-12'),
  match('2026-08-23', 'CUP', 18609),
  match('2026-08-12', 'LEAGUE', 18121, '2026-08-12'),
  match('2026-07-06', 'LEAGUE', 16900, '2026-07-01')
]

describe('getSeasonStarts', () => {
  test('is the first league match of each season, newest first', () => {
    expect(getSeasonStarts(history())).toEqual([at('2026-09-23'), at('2026-08-12'), at('2026-07-01')])
  })

  test('counts leagues that started within days of each other as one season, from the earliest', () => {
    // A club that changed division between seasons, say
    const starts = getSeasonStarts([match('2026-09-25', 'LEAGUE', 2), match('2026-09-23', 'LEAGUE', 1)])
    expect(starts).toEqual([at('2026-09-23')])
  })
})

describe('groupMatchesBySeason', () => {
  test('splits the last two seasons, with how many league and cup matches were in each', () => {
    const [current, last, ...older] = groupMatchesBySeason(history(), 2, at('2026-10-03'))

    expect(older).toEqual([])
    expect(current).toMatchObject({ start: at('2026-09-23'), end: null, isCurrent: true, leagueMatches: 2, cupMatches: 1 })
    expect(last).toMatchObject({ start: at('2026-08-12'), end: at('2026-09-23'), isCurrent: false, leagueMatches: 2, cupMatches: 2 })
    expect(last.matches.map(stat => stat.match.startDate)).toContain(at('2026-09-19'))
  })

  test('a newest season that started more than a season ago is not the current one', () => {
    const [newest] = groupMatchesBySeason(history(), 2, at('2026-12-01'))
    expect(newest.isCurrent).toBe(false)
  })

  test('cup matches alone make no season', () => {
    expect(groupMatchesBySeason([match('2026-10-01', 'CUP', 20152)], 2)).toEqual([])
  })
})

describe('coversSeasons', () => {
  test('only once a league match from the season before the oldest wanted one is in', () => {
    expect(coversSeasons(history().slice(0, 7), 2)).toBe(false) // Last season could have earlier matches still to come
    expect(coversSeasons(history(), 2)).toBe(true)
  })
})
