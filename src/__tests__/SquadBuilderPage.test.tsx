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
  it('starts with the best XI in each of two formations, and the season', async () => {
    await renderBuilder()

    expect(screen.getByRole('button', { name: /^Lineup A/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /^Lineup B/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'GK: Keeper One, 80' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ST: Striker One, 75' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sub 1: Keeper Two' })).toBeInTheDocument()
    expect(screen.getByText('S27')).toBeInTheDocument()
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
    expect(screen.queryAllByRole('button', { name: /^Pick a player for (?!sub)/ })).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'GK: Keeper One, 80' })).toBeInTheDocument()
  })

  it('adds a lineup as a copy of the current one', async () => {
    await renderBuilder()

    fireEvent.click(screen.getByRole('button', { name: '+ Add formation' }))
    expect(screen.getByRole('button', { name: /^Lineup C/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'GK: Keeper One, 80' })).toBeInTheDocument()
  })

  it('shows the lineup in a statistics table', async () => {
    await renderBuilder()

    fireEvent.click(screen.getByRole('button', { name: 'Show Squad Statistics' }))
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
})
