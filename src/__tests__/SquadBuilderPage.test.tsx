import React from 'react'
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import SquadBuilderPage from '../components/SquadBuilderPage'

// Every attribute the same, so a player rates their overall at their primary position
const player = (id: number, firstName: string, lastName: string, positions: string[], overall: number) => {
  const keeper = positions[0] === 'GK'
  const outfield = keeper ? 0 : overall
  return {
    id,
    metadata: {
      firstName, lastName, positions, overall, age: 25,
      pace: outfield, shooting: outfield, passing: outfield, dribbling: outfield, defense: outfield, physical: outfield, goalkeeping: keeper ? overall : 0,
    },
    activeContract: { startSeason: 27 },
  }
}

const agency = [
  player(1, 'Keeper', 'One', ['GK'], 80),
  player(2, 'Keeper', 'Two', ['GK'], 70),
  player(3, 'Centre', 'One', ['CB'], 85),
  player(4, 'Centre', 'Two', ['CB'], 84),
  player(5, 'Centre', 'Three', ['CB'], 83),
  player(6, 'Left', 'Back', ['LB'], 82),
  player(7, 'Right', 'Back', ['RB'], 81),
  player(8, 'Holding', 'Mid', ['CDM'], 80),
  player(9, 'Central', 'One', ['CM'], 79),
  player(10, 'Central', 'Two', ['CM'], 78),
  player(11, 'Left', 'Wing', ['LW'], 77),
  player(12, 'Right', 'Wing', ['RW'], 76),
  player(13, 'Striker', 'One', ['ST'], 75),
  player(14, 'Striker', 'Two', ['ST'], 74),
]

// The filter range sliders measure themselves with ResizeObserver, which jsdom does not provide
beforeAll(() => {
  (global as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

const mockWallet: { isConnected: boolean; account: string | null; viewedAddress: string | null; isReady: boolean } = {
  isConnected: true,
  account: '0xTEST',
  viewedAddress: null,
  isReady: true,
}
jest.mock('../contexts/WalletContext', () => ({
  useWallet: () => mockWallet,
}))
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
}))
jest.mock('../components/Toast', () => ({
  useToast: () => ({ toasts: [], removeToast: () => {}, success: () => {}, error: () => {}, warning: () => {}, info: () => {} }),
  ToastContainer: () => null,
}))
jest.mock('../services/clientDataService', () => ({
  supabaseDataService: { getAgencyPlayers: jest.fn() },
}))
jest.mock('../services/squadService', () => ({
  getSquads: jest.fn(),
  saveSquad: jest.fn(),
  updateSquad: jest.fn(),
  deleteSquad: jest.fn(),
}))

const { supabaseDataService } = jest.requireMock('../services/clientDataService')
const squadService = jest.requireMock('../services/squadService')

beforeEach(() => {
  jest.clearAllMocks()
  window.localStorage.clear()
  Object.assign(mockWallet, { isConnected: true, account: '0xTEST', viewedAddress: null, isReady: true })
  supabaseDataService.getAgencyPlayers.mockResolvedValue(agency)
  squadService.getSquads.mockResolvedValue([])
  squadService.saveSquad.mockResolvedValue({})
})

const renderBuilder = async () => {
  render(<SquadBuilderPage />)
  return screen.findByRole('button', { name: /^Lineup A/ })
}
const pitchSlot = (position: string) => screen.getAllByRole('button', { name: new RegExp(`^(${position}: |Pick a player for ${position}$)`) })

describe('Squad Builder', () => {
  it('starts with the best XI in each of two formations', async () => {
    await renderBuilder()

    expect(screen.getByRole('button', { name: /^Lineup A/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /^Lineup B/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'GK: Keeper One, 80' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ST: Striker One, 75' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sub 1: Keeper Two' })).toBeInTheDocument()
    // The season only shows in the retirement icons' labels
    expect(screen.queryByText('S27')).not.toBeInTheDocument()
  })

  it('lists the best players for a picked position first, and puts the one chosen there', async () => {
    await renderBuilder()

    fireEvent.click(screen.getByRole('button', { name: 'ST: Striker One, 75' }))
    expect(screen.getByRole('heading', { name: 'Select ST' })).toBeInTheDocument()
    const candidates = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(candidates[0]).toHaveTextContent('Striker One')
    expect(candidates[1]).toHaveTextContent('Striker Two')

    fireEvent.click(candidates[1])
    expect(screen.getByRole('button', { name: 'ST: Striker Two, 74' })).toBeInTheDocument()
    // He came off the bench, so the striker he replaced takes his seat
    expect(screen.getByRole('button', { name: 'Sub 3: Striker One' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Select ST' })).not.toBeInTheDocument()
  })

  it('places a clicked player in the empty position they suit best', async () => {
    await renderBuilder()

    fireEvent.click(screen.getByRole('button', { name: 'Remove Centre One' }))
    expect(pitchSlot('CB').map(slot => slot.getAttribute('aria-label'))).toContain('Pick a player for CB')

    const pool = screen.getByRole('region', { name: 'Your players' })
    fireEvent.click(within(pool).getByText('Centre One'))
    expect(screen.getByRole('button', { name: 'CB: Centre One, 85' })).toBeInTheDocument()
  })

  it('keeps the same players when the formation changes', async () => {
    await renderBuilder()

    fireEvent.change(screen.getByLabelText('Formation'), { target: { value: '4-4-2' } })
    expect(screen.getByRole('button', { name: /^Lineup A\s*4-4-2/ })).toBeInTheDocument()
    expect(screen.queryAllByRole('button', { name: /^Pick a player for (?!sub|reserve)/ })).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'GK: Keeper One, 80' })).toBeInTheDocument()
  })

  it('adds a lineup as a copy of the current one', async () => {
    await renderBuilder()

    fireEvent.click(screen.getByRole('button', { name: '+ Add formation' }))
    expect(screen.getByRole('button', { name: /^Lineup C/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'GK: Keeper One, 80' })).toBeInTheDocument()
  })

  it('shows the lineup in a statistics table, without having to open it', async () => {
    await renderBuilder()

    expect(screen.queryByRole('button', { name: /Squad Statistics/ })).not.toBeInTheDocument()
    const table = screen.getByRole('table')
    // 11 starters and 3 substitutes, under the header
    expect(within(table).getAllByRole('row')).toHaveLength(15)
    expect(screen.getByRole('heading', { name: 'Squad statistics · Lineup A' })).toBeInTheDocument()
  })

  it('names and saves a new squad with all its lineups', async () => {
    await renderBuilder()

    fireEvent.click(screen.getByRole('button', { name: 'Save Squad' }))
    fireEvent.change(screen.getByLabelText('Squad name'), { target: { value: 'Japan' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(squadService.saveSquad).toHaveBeenCalled())
    const [wallet, name, formationId, data] = squadService.saveSquad.mock.calls[0]
    expect([wallet, name, formationId]).toEqual(['0xTEST', 'Japan', '4-3-3'])
    expect(data.lineups.map((l: { name: string }) => l.name)).toEqual(['Lineup A', 'Lineup B'])
    expect(data.lineups[0].xi).toHaveLength(11)
  })

  it('loads a squad saved before lineups existed', async () => {
    const [keeper, , centre] = agency
    squadService.getSquads.mockResolvedValue([
      {
        id: 'old',
        wallet_address: '0xTEST',
        squad_name: 'Old squad',
        formation_id: '4-4-2',
        players: { GK: { player: keeper, position: 'GK' }, CB1: { player: centre, position: 'CB1' } },
        created_at: '2025-01-01',
        updated_at: '2025-01-01',
      },
    ])
    await renderBuilder()

    fireEvent.click(screen.getByRole('button', { name: 'Load Squad' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Load' }))

    expect(screen.getByRole('button', { name: /^Lineup A\s*4-4-2/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Lineup B/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'GK: Keeper One, 80' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'CB: Centre One, 85' })).toBeInTheDocument()
    expect(screen.getByText('Old squad')).toBeInTheDocument()
  })

  it("lets a viewed wallet's squads be built but not saved", async () => {
    Object.assign(mockWallet, { isConnected: false, account: null, viewedAddress: '0x95dc70d7d39f6f76' })
    await renderBuilder()

    expect(screen.getByText(/read-only/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save Squad' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Load Squad' })).not.toBeInTheDocument()
    expect(squadService.getSquads).not.toHaveBeenCalled()
  })

  it('carries on from the squad left last time', async () => {
    const { unmount } = render(<SquadBuilderPage />)
    await screen.findByRole('button', { name: /^Lineup A/ })
    fireEvent.click(screen.getByRole('button', { name: 'Remove Keeper One' }))
    unmount()

    await renderBuilder()
    expect(screen.queryByRole('button', { name: 'GK: Keeper One, 80' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pick a player for GK' })).toBeInTheDocument()
  })

  it('filters the players by card type, and can hide the ones already picked', async () => {
    await renderBuilder()
    const pool = screen.getByRole('region', { name: 'Your players' })
    fireEvent.click(within(pool).getByRole('button', { name: 'Show Filters' }))

    fireEvent.click(within(pool).getByRole('button', { name: 'Legendary' }))
    await waitFor(() => expect(within(pool).queryByText('Centre Two')).not.toBeInTheDocument())
    expect(within(pool).getByText('Centre One')).toBeInTheDocument()

    fireEvent.click(within(pool).getByRole('button', { name: 'Reset Filters' }))
    await within(pool).findByText('Centre Two')

    // Both lineups start with all 14 players picked
    fireEvent.click(within(pool).getByLabelText('Hide selected players'))
    expect(await within(pool).findByText('No players match.')).toBeInTheDocument()
    expect(within(pool).getAllByRole('slider').length).toBeGreaterThan(0)
  })

  it('can hide players retiring at the end of this season, and then leaves them out of auto-fill', async () => {
    supabaseDataService.getAgencyPlayers.mockResolvedValue(
      agency.map(p => (p.id === 13 ? { ...p, metadata: { ...p.metadata, retirementYears: 1 } } : p))
    )
    await renderBuilder()
    expect(screen.getByRole('button', { name: 'ST: Striker One, 75' })).toBeInTheDocument()

    const pool = screen.getByRole('region', { name: 'Your players' })
    fireEvent.click(within(pool).getByRole('button', { name: 'Show Filters' }))
    fireEvent.click(within(pool).getByLabelText('Hide players retiring at the end of this season'))
    await waitFor(() => expect(within(pool).queryByText('Striker One')).not.toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Auto-fill best XI' }))
    expect(screen.getByRole('button', { name: 'ST: Striker Two, 74' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /: Striker One/ })).not.toBeInTheDocument()
  })

  it('auto-fills an empty squad from only the players the filters leave', async () => {
    await renderBuilder()
    fireEvent.click(screen.getByRole('button', { name: 'Clear Squad' }))
    const pool = screen.getByRole('region', { name: 'Your players' })
    fireEvent.click(within(pool).getByRole('button', { name: 'Show Filters' }))
    // Legendary (85+) leaves just Centre One
    fireEvent.click(within(pool).getByRole('button', { name: 'Legendary' }))

    fireEvent.click(screen.getByRole('button', { name: 'Auto-fill best XI' }))
    expect(screen.getByRole('button', { name: 'CB: Centre One, 85' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^GK: / })).not.toBeInTheDocument()
    expect(screen.queryAllByRole('button', { name: /^Sub \d: / })).toHaveLength(0)
  })

  it("auto-fills from the squad's own players first, and from the list only for positions none of them play", async () => {
    // A squad of a keeper, a centre back and the weaker striker
    window.localStorage.setItem(
      'mfl-data-squad-builder:0xtest',
      JSON.stringify({ name: '', active: 0, lineups: [{ id: 1, name: 'Lineup A', formation: '4-3-3', xi: [1, null, 3, null, null, null, null, null, null, 14, null], bench: Array(7).fill(null) }] })
    )
    await renderBuilder()

    fireEvent.click(screen.getByRole('button', { name: 'Auto-fill best XI' }))
    expect(screen.getByRole('button', { name: 'GK: Keeper One, 80' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ST: Striker Two, 74' })).toBeInTheDocument()
    // Striker One is better, but the squad already has a striker
    expect(screen.queryByRole('button', { name: /: Striker One/ })).not.toBeInTheDocument()
    // No one in the squad plays the wings, so they come from the list
    expect(screen.getByRole('button', { name: 'LW: Left Wing, 77' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pick a player for sub 1' })).toBeInTheDocument()
  })

  it('offers every MFL formation, by the names the game uses', async () => {
    await renderBuilder()
    const options = within(screen.getByLabelText('Formation')).getAllByRole('option').map(option => option.textContent)
    expect(options).toHaveLength(25)
    expect(options).toEqual(expect.arrayContaining(['4-3-3', '4-3-3 (def)', '4-3-3 (false 9)', '5-4-1 (flat)', '3-4-2-1']))
  })

  it('pages the player list, staying on the page after placing a player from it', async () => {
    const many = Array.from({ length: 45 }, (_, i) => player(100 + i, 'Squad', `Player ${String(i + 1).padStart(2, '0')}`, ['CM'], 90 - Math.floor(i / 2)))
    supabaseDataService.getAgencyPlayers.mockResolvedValue(many)
    await renderBuilder()
    const pool = screen.getByRole('region', { name: 'Your players' })
    expect(within(pool).getByText('Squad Player 20')).toBeInTheDocument()
    expect(within(pool).queryByText('Squad Player 21')).not.toBeInTheDocument()

    const pages = within(pool).getByRole('navigation', { name: 'Pages of players' })
    fireEvent.click(within(pages).getByRole('button', { name: '2' }))
    expect(within(pool).getByText('Squad Player 21')).toBeInTheDocument()
    expect(within(pool).getByText('Showing 21-40 of 45')).toBeInTheDocument()

    // The squad takes the best 23, so free a place first
    fireEvent.click(screen.getByRole('button', { name: 'Remove Squad Player 01' }))
    fireEvent.click(within(pool).getByText('Squad Player 25'))
    expect(screen.getAllByRole('button', { name: /: Squad Player 25/ }).length).toBeGreaterThan(0)
    expect(within(pages).getByRole('button', { name: '2' })).toHaveAttribute('aria-current', 'page')
  })

  it('makes a squad of 23, the five after the bench as reserves out of the matchday squad', async () => {
    const many = Array.from({ length: 30 }, (_, i) => player(100 + i, 'Squad', `Player ${String(i + 1).padStart(2, '0')}`, ['CM'], 90 - i))
    supabaseDataService.getAgencyPlayers.mockResolvedValue(many)
    await renderBuilder()

    const reserves = screen.getByRole('region', { name: 'Reserves' })
    expect(within(reserves).getByText(/squad 23 \/ 23/)).toBeInTheDocument()
    expect(within(reserves).getByRole('button', { name: 'Reserve 1: Squad Player 19' })).toBeInTheDocument()
    expect(within(reserves).getByRole('button', { name: 'Reserve 5: Squad Player 23' })).toBeInTheDocument()
    // Players 19 and 20 are the reserves on the list's first page
    expect(within(screen.getByRole('region', { name: 'Your players' })).getAllByText('Reserves')).toHaveLength(2)
    // 11 starters, 7 substitutes and 5 reserves, under the header
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(24)

    // A reserve can be swapped onto the bench
    fireEvent.click(within(reserves).getByRole('button', { name: 'Remove Squad Player 23' }))
    fireEvent.click(within(reserves).getByRole('button', { name: 'Pick a player for reserve 5' }))
    expect(screen.getByRole('heading', { name: 'Select reserve' })).toBeInTheDocument()
    fireEvent.click(within(screen.getByRole('list')).getByText('Squad Player 30'))
    expect(within(reserves).getByRole('button', { name: 'Reserve 5: Squad Player 30' })).toBeInTheDocument()
  })

  it("opens a player's menu without placing them: their page, their ID to copy and mfl.com", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    await renderBuilder()
    fireEvent.click(screen.getByRole('button', { name: 'Remove Centre One' }))
    const pool = screen.getByRole('region', { name: 'Your players' })

    fireEvent.click(within(pool).getByRole('button', { name: 'Options for Centre One' }))
    const menu = screen.getByRole('menu', { name: 'Options for Centre One' })
    expect(within(menu).getByRole('menuitem', { name: /Open player page/ })).toHaveAttribute('href', '/players/3')
    expect(within(menu).getByRole('menuitem', { name: /Open on mfl.com/ })).toHaveAttribute('href', 'https://app.playmfl.com/players/3')
    expect(within(menu).getByRole('menuitem', { name: /Open on mfl.com/ })).toHaveAttribute('target', '_blank')

    fireEvent.click(within(menu).getByRole('menuitem', { name: /Copy player ID/ }))
    expect(writeText).toHaveBeenCalledWith('3')
    expect(await within(menu).findByText('Copied')).toBeInTheDocument()
    // Still out of the lineup
    expect(screen.queryByRole('button', { name: 'CB: Centre One, 85' })).not.toBeInTheDocument()

    fireEvent.keyDown(menu, { key: 'Escape' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it("shows how much better a player rates at a position than their primary one", async () => {
    // A centre back who passes and dribbles well enough to rate higher as a holding midfielder
    const ballPlayer = player(20, 'Ball', 'Player', ['CB', 'CDM'], 74)
    Object.assign(ballPlayer.metadata, { pace: 70, shooting: 40, passing: 90, dribbling: 90, defense: 70, physical: 70 })
    supabaseDataService.getAgencyPlayers.mockResolvedValue([...agency, ballPlayer])
    const { positionFit } = jest.requireActual('../utils/squadLineups')
    const cb = positionFit(ballPlayer, 'CB').rating
    const cdm = positionFit(ballPlayer, 'CDM').rating
    expect(cdm).toBeGreaterThan(cb)
    await renderBuilder()

    const pool = screen.getByRole('region', { name: 'Your players' })
    const card = within(pool).getByText('Ball Player').closest('[role="button"]') as HTMLElement
    expect(within(card).getByTitle(`+${cdm - cb} vs primary position`)).toHaveTextContent(`CDM ${cdm} (+${cdm - cb})`)
    expect(within(card).getByText(`${cb}`).parentElement).toHaveTextContent(`CB ${cb}`)
  })

  it("shows the lineup's balance, ages and position coverage with its statistics", async () => {
    await renderBuilder()

    expect(screen.getByText('AVG (TOP11)')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Age Analysis' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Position Coverage' })).toBeInTheDocument()

    // Picking a group in Squad Balance narrows the table to it
    fireEvent.click(screen.getByRole('button', { name: /^Goalkeepers/ }))
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(3)
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(15)

    fireEvent.click(screen.getByRole('button', { name: 'Show all positions coverage' }))
    expect(screen.getByRole('dialog', { name: 'All Positions Coverage' })).toBeInTheDocument()
  })
})
