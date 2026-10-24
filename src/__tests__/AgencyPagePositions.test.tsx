import React from 'react'
import { render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import AgencyPage from '../components/AgencyPage'
import { calculateAllPositionOVRs } from '../utils/ruleBasedPositionCalculator'
import { MFLPosition } from '../types/mflApi'

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
    getAgencyPlayers: jest.fn(() => Promise.resolve([midfielder, striker])),
    clearCache: jest.fn(),
  },
}))

const expectedRating = (position: string) => {
  const m = midfielder.metadata
  return calculateAllPositionOVRs({
    id: midfielder.id,
    name: `${m.firstName} ${m.lastName}`,
    attributes: { PAC: m.pace, SHO: m.shooting, PAS: m.passing, DRI: m.dribbling, DEF: m.defense, PHY: m.physical, GK: m.goalkeeping },
    positions: m.positions as MFLPosition[],
    overall: m.overall,
  }).results[position as MFLPosition].ovr
}

describe('AgencyPage player table', () => {
  it('shows the rating at each of a player\'s positions', async () => {
    render(<AgencyPage />)
    const nameButton = await screen.findByText('Igor Pavlović')
    const row = nameButton.closest('tr') as HTMLElement

    for (const position of ['LM', 'RM', 'CM']) {
      const chip = within(row).getByText(position, { selector: 'span' })
      expect(chip).toHaveTextContent(`${position}${expectedRating(position)}`)
    }
    // Primary position carries no penalty, the others take -1
    expect(expectedRating('RM')).toBe(expectedRating('LM') - 1)
  })

  it('shows the retirement calendar next to a retiring player\'s name only', async () => {
    render(<AgencyPage />)
    const retiringRow = (await screen.findByText('Igor Pavlović')).closest('tr') as HTMLElement
    expect(within(retiringRow).getByRole('img', { name: 'Retiring in 2 seasons' })).toBeInTheDocument()

    const otherRow = screen.getByText('Test Striker').closest('tr') as HTMLElement
    expect(within(otherRow).queryByRole('img', { name: /Retiring/ })).not.toBeInTheDocument()
  })
})
