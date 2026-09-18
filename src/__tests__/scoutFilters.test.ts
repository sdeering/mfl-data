import { DEFAULT_SCOUT_FILTERS, buildListingsQuery, filtersEqual } from '../utils/scoutFilters'

describe('buildListingsQuery', () => {
  test('the default filters are the newest listings of young free agents with room to grow', () => {
    expect(buildListingsQuery(DEFAULT_SCOUT_FILTERS).toString()).toBe(
      'limit=20&type=PLAYER&sorts=listing.createdDateTime&sortsOrders=DESC&status=AVAILABLE' +
      '&ageMax=23&overallMin=70&overallMax=82&paceMin=50&passingMin=50&isFreeAgent=true&view=full'
    )
  })

  test('a filter that is switched off is left out of the search', () => {
    const query = buildListingsQuery({ ...DEFAULT_SCOUT_FILTERS, ageMax: null, paceMin: null, defenseMin: 65, isFreeAgent: false })

    expect(query.has('ageMax')).toBe(false)
    expect(query.has('paceMin')).toBe(false)
    expect(query.has('isFreeAgent')).toBe(false)
    expect(query.get('defenseMin')).toBe('65')
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
    expect(filtersEqual(DEFAULT_SCOUT_FILTERS, { ...DEFAULT_SCOUT_FILTERS, isFreeAgent: false })).toBe(false)
    expect(filtersEqual(DEFAULT_SCOUT_FILTERS, { ...DEFAULT_SCOUT_FILTERS, limit: 50 })).toBe(false)
    expect(filtersEqual(DEFAULT_SCOUT_FILTERS, { ...DEFAULT_SCOUT_FILTERS, position: 'ST' })).toBe(false)
  })
})
