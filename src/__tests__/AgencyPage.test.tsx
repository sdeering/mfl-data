import React from 'react'
import { render, screen, within, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import AgencyPage from '../components/AgencyPage'
import { calculatePositionOVR } from '../utils/ruleBasedPositionCalculator'
import { MFLPosition } from '../types/mflApi'

// The filter range sliders measure themselves with ResizeObserver, which jsdom does not provide
beforeAll(() => {
  (global as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

const midfielder = {
  id: 116267,
  metadata: {
    firstName: 'Igor',
    lastName: 'Pavlović',
    positions: ['LM', 'RM', 'CM'],
    overall: 92,
    pace: 90,
    shooting: 85,
    passing: 93,
    dribbling: 94,
    defense: 60,
    physical: 78,
    goalkeeping: 0,
    age: 31,
    retirementYears: 2,
  },
}

// Listed at RW, but a passer without the pace for the wing, so better at CAM
const playmaker = {
  id: 116268,
  metadata: {
    firstName: 'Test',
    lastName: 'Playmaker',
    positions: ['RW', 'CAM'],
    overall: 79,
    pace: 50,
    shooting: 75,
    passing: 90,
    dribbling: 85,
    defense: 40,
    physical: 60,
    goalkeeping: 0,
    age: 34,
    retirementYears: 1,
  },
}

const striker = {
  id: 999001,
  metadata: {
    firstName: 'Test',
    lastName: 'Striker',
    positions: ['ST'],
    overall: 85,
    pace: 80,
    shooting: 85,
    passing: 70,
    dribbling: 78,
    defense: 40,
    physical: 75,
    goalkeeping: 0,
    age: 25,
  },
}

jest.mock('../contexts/WalletContext', () => ({
  useWallet: () => ({ isConnected: true, account: '0xTEST' }),
}))
jest.mock('../contexts/SupabaseSyncContext', () => ({
  useSupabaseSyncUI: () => ({ startSync: jest.fn(), isSyncing: false, progress: [] }),
}))
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
}))
jest.mock('../services/clientDataService', () => ({
  supabaseDataService: {
    getAgencyPlayers: jest.fn(() => Promise.resolve([midfielder, playmaker, striker])),
    clearCache: jest.fn(),
  },
}))

const ratingAt = (player: typeof midfielder | typeof playmaker, position: string) => {
  const m = player.metadata
  return calculatePositionOVR({
    id: player.id,
    name: `${m.firstName} ${m.lastName}`,
    attributes: { PAC: m.pace, SHO: m.shooting, PAS: m.passing, DRI: m.dribbling, DEF: m.defense, PHY: m.physical, GK: m.goalkeeping },
    positions: m.positions as MFLPosition[],
    overall: m.overall,
  }, position as MFLPosition).ovr
}

// The card colour ranges as text, as the design shows ratings beside a position
const tierText = (rating: number) =>
  rating >= 95 ? 'var(--rt-cyan)' : rating >= 85 ? 'var(--rt-pink)' : rating >= 75 ? 'var(--rt-blue)' :
  rating >= 65 ? 'var(--rt-green)' : rating >= 55 ? 'var(--rt-sand)' : 'var(--rt-grey)'

const rowOf = async (name: string) => (await screen.findByText(name)).closest('tr') as HTMLElement
const positionPills = (row: HTMLElement, positions: string[]) =>
  positions.map(position => within(row).getByText(position, { selector: 'span' }))

describe('AgencyPage player table', () => {
  it('shows the rating at each of a player\'s positions, coloured by its card range', async () => {
    render(<AgencyPage />)
    const row = await rowOf('Igor Pavlović')

    for (const position of ['LM', 'RM', 'CM']) {
      const [pill] = positionPills(row, [position])
      const rating = ratingAt(midfielder, position)
      expect(pill).toHaveTextContent(`${position} ${rating}`)
      expect(within(pill).getByText(String(rating))).toHaveStyle({ color: tierText(rating) })
    }
    // Primary position carries no penalty, the others take -1
    expect(ratingAt(midfielder, 'RM')).toBe(ratingAt(midfielder, 'LM') - 1)
  })

  it('lists a better position than the primary first, with how much better it is', async () => {
    const gain = ratingAt(playmaker, 'CAM') - ratingAt(playmaker, 'RW')
    expect(gain).toBeGreaterThan(0)

    render(<AgencyPage />)
    const row = await rowOf('Test Playmaker')

    const [cam, rw] = positionPills(row, ['CAM', 'RW'])
    expect(cam.compareDocumentPosition(rw) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(row).getByText(`+${gain}`)).toBeInTheDocument()
    expect(within(row).getAllByText(/^\+\d+$/)).toHaveLength(1)
  })

  it('shows the retirement calendar next to a retiring player\'s name only', async () => {
    render(<AgencyPage />)
    const retiringRow = await rowOf('Igor Pavlović')
    expect(within(retiringRow).getByRole('img', { name: 'Retiring in 2 seasons' })).toBeInTheDocument()

    const otherRow = await rowOf('Test Striker')
    expect(within(otherRow).queryByRole('img', { name: /Retiring/ })).not.toBeInTheDocument()
  })

  it('can leave out the players retiring at the end of this season', async () => {
    render(<AgencyPage />)
    await screen.findByText('Test Playmaker')

    fireEvent.click(screen.getByText('Show Filters'))
    fireEvent.click(screen.getByLabelText('Exclude players retiring at the end of this season'))

    expect(screen.queryByText('Test Playmaker')).not.toBeInTheDocument()
    // Retiring later, or not at all, they stay
    expect(screen.getByText('Igor Pavlović')).toBeInTheDocument()
    expect(screen.getByText('Test Striker')).toBeInTheDocument()
  })
})
