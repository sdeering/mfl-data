import { DEFAULT_SCOUT_FILTERS, buildListingsQuery, filtersEqual, loadScoutSettings, parseScoutFilters, saveScoutSettings } from '../utils/scoutFilters'

describe('buildListingsQuery', () => {
  test('the default filters are the newest listings of young free agents with room to grow', () => {
    expect(buildListingsQuery(DEFAULT_SCOUT_FILTERS).toString()).toBe(
      'limit=20&type=PLAYER&sorts=listing.createdDateTime&sortsOrders=DESC&status=AVAILABLE' +
      '&ageMax=23&overallMin=70&overallMax=82&paceMin=50&passingMin=50&isFreeAgent=true&view=full'
    )
  })

  test('a filter that is switched off is left out of the search', () => {
    const query = buildListingsQuery({ ...DEFAULT_SCOUT_FILTERS, ageMax: null, paceMin: null, defenseMin: 65, players: 'all' })

    expect(query.has('ageMax')).toBe(false)
    expect(query.has('paceMin')).toBe(false)
    expect(query.has('isFreeAgent')).toBe(false)
    expect(query.get('defenseMin')).toBe('65')
  })

  test('searches for free agents, only players under contract, or every player', () => {
    // MFL's one flag: true is players without a club, false is only those under contract, off is everyone
    expect(buildListingsQuery({ ...DEFAULT_SCOUT_FILTERS, players: 'freeAgents' }).get('isFreeAgent')).toBe('true')
    expect(buildListingsQuery({ ...DEFAULT_SCOUT_FILTERS, players: 'underContract' }).get('isFreeAgent')).toBe('false')
    expect(buildListingsQuery({ ...DEFAULT_SCOUT_FILTERS, players: 'all' }).has('isFreeAgent')).toBe(false)
  })

  test('never sends MFL a filter it does not have', () => {
    // MFL rejects any parameter it does not know with a 400, so "activeContract" (the MFL site's own
    // name for the under contract option) must not be passed on
    for (const players of ['freeAgents', 'underContract', 'all'] as const) {
      expect(buildListingsQuery({ ...DEFAULT_SCOUT_FILTERS, players }).has('activeContract')).toBe(false)
    }
  })

  test('searches for one position or a whole group of them', () => {
    expect(buildListingsQuery(DEFAULT_SCOUT_FILTERS).has('positions')).toBe(false)
    expect(buildListingsQuery({ ...DEFAULT_SCOUT_FILTERS, position: 'CAM' }).get('positions')).toBe('CAM')
    expect(buildListingsQuery({ ...DEFAULT_SCOUT_FILTERS, position: '__GROUP_MIDFIELDERS' }).get('positions')).toBe('CM,CDM,LM,RM')
  })

  test('keeps values to whole numbers MFL can use and the listing count to one it is paced for', () => {
    const query = buildListingsQuery({ ...DEFAULT_SCOUT_FILTERS, overallMin: -5, overallMax: 250, paceMin: 61.6, shootingMin: NaN, limit: 5000 })

    expect(query.get('overallMin')).toBe('0')
    expect(query.get('overallMax')).toBe('99')
    expect(query.get('paceMin')).toBe('62')
    expect(query.has('shootingMin')).toBe(false)
    expect(query.get('limit')).toBe('20')
  })
})

describe('filtersEqual', () => {
  test('compares every filter', () => {
    expect(filtersEqual(DEFAULT_SCOUT_FILTERS, { ...DEFAULT_SCOUT_FILTERS })).toBe(true)
    expect(filtersEqual(DEFAULT_SCOUT_FILTERS, { ...DEFAULT_SCOUT_FILTERS, physicalMin: 60 })).toBe(false)
    expect(filtersEqual(DEFAULT_SCOUT_FILTERS, { ...DEFAULT_SCOUT_FILTERS, players: 'all' })).toBe(false)
    expect(filtersEqual(DEFAULT_SCOUT_FILTERS, { ...DEFAULT_SCOUT_FILTERS, players: 'underContract' })).toBe(false)
    expect(filtersEqual(DEFAULT_SCOUT_FILTERS, { ...DEFAULT_SCOUT_FILTERS, limit: 50 })).toBe(false)
    expect(filtersEqual(DEFAULT_SCOUT_FILTERS, { ...DEFAULT_SCOUT_FILTERS, position: 'ST' })).toBe(false)
  })
})

describe('parseScoutFilters', () => {
  test('keeps saved filters, including ones that were switched off', () => {
    for (const players of ['freeAgents', 'underContract', 'all'] as const) {
      const saved = { ...DEFAULT_SCOUT_FILTERS, position: '__GROUP_DEFENDERS', ageMax: null, defenseMin: 65, players, limit: 50 }
      expect(parseScoutFilters(JSON.parse(JSON.stringify(saved)))).toEqual(saved)
    }
  })

  test('falls back to the default for anything missing, mistyped or no longer in its dropdown', () => {
    expect(parseScoutFilters({ position: 'toString', ageMax: '21', overallMin: 12, paceMin: 52, players: 'nobody', isFreeAgent: 'yes', limit: 25, physicalMin: 60 }))
      .toEqual({ ...DEFAULT_SCOUT_FILTERS, physicalMin: 60 })
  })

  test('keeps the meaning of settings saved when this was a free agents on/off box', () => {
    expect(parseScoutFilters({ isFreeAgent: true }).players).toBe('freeAgents')
    // Off was every player, so it must not become "under contract", which is what isFreeAgent=false asks MFL for
    expect(parseScoutFilters({ isFreeAgent: false }).players).toBe('all')
    expect(parseScoutFilters({ players: 'underContract', isFreeAgent: true }).players).toBe('underContract')
  })

  test('is the defaults when what was saved is not an object at all', () => {
    for (const saved of [null, undefined, 'filters', 7, []]) expect(parseScoutFilters(saved)).toEqual(DEFAULT_SCOUT_FILTERS)
  })
})

describe('saved scout settings', () => {
  beforeEach(() => window.localStorage.clear())

  test('come back as they were saved', () => {
    const settings = { filters: { ...DEFAULT_SCOUT_FILTERS, position: 'CB', ageMax: 19 }, sort: { field: 'price', direction: 'asc' as const } }
    saveScoutSettings(settings)
    expect(loadScoutSettings()).toEqual(settings)
  })

  test('are null when nothing has been saved, or it cannot be read', () => {
    expect(loadScoutSettings()).toBeNull()
    window.localStorage.setItem('mfl-data-scout-settings', '{not json')
    expect(loadScoutSettings()).toBeNull()
  })

  test('drop a sort that is not a field and a direction', () => {
    window.localStorage.setItem('mfl-data-scout-settings', JSON.stringify({ filters: {}, sort: { field: 'price', direction: 'sideways' } }))
    expect(loadScoutSettings()).toEqual({ filters: DEFAULT_SCOUT_FILTERS, sort: null })
  })

  test('never throw when the browser blocks storage', () => {
    const blocked = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError') })
    expect(() => saveScoutSettings({ filters: DEFAULT_SCOUT_FILTERS, sort: null })).not.toThrow()
    blocked.mockRestore()
  })
})
