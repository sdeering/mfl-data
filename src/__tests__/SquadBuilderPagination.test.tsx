import React from 'react'
import { render, screen, act, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'

// Mock Radix Slider for jsdom
jest.mock('@radix-ui/react-slider', () => {
  const React = require('react')
  return {
    __esModule: true,
    Root: ({ children }: any) => <div>{children}</div>,
    Track: (props: any) => React.createElement('div', props),
    Range: (props: any) => React.createElement('div', props),
    Thumb: (props: any) => React.createElement('div', props),
  }
})

jest.mock('../../src/contexts/WalletContext', () => ({
  useWallet: () => ({ isConnected: true, account: '0xTEST' })
}))
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() })
}))
jest.mock('../../src/components/Toast', () => ({
  useToast: () => ({ toasts: [], removeToast: () => {}, success: () => {}, error: () => {}, warning: () => {}, info: () => {} }),
  ToastContainer: () => null
}))

// 25 players, so the sidebar has two pages of 20. Player 01 has the highest overall.
const mockPlayers = Array.from({ length: 25 }, (_, i) => ({
  id: 999001 + i,
  metadata: {
    firstName: 'Player',
    lastName: String(i + 1).padStart(2, '0'),
    positions: ['ST'],
    overall: 90 - i,
    pace: 80,
    shooting: 85,
    passing: 70,
    dribbling: 78,
    defense: 40,
    physical: 75,
    goalkeeping: 0,
    age: 25,
  },
}))

jest.mock('../../src/services/clientDataService', () => ({
  supabaseDataService: { getAgencyPlayers: jest.fn(() => Promise.resolve(mockPlayers)) },
  dataService: { getAgencyPlayers: jest.fn(() => Promise.resolve(mockPlayers)) },
}))
jest.mock('../../src/services/squadService', () => ({
  getSquads: jest.fn().mockResolvedValue([]),
  saveSquad: jest.fn(),
  updateSquad: jest.fn(),
  deleteSquad: jest.fn(),
}))

describe('Squad Builder - sidebar pagination', () => {
  it('stays on page 2 after adding a player from page 2', async () => {
    jest.useFakeTimers()
    const Page = require('../../app/squad-builder/page').default
    render(<Page />)
    await act(async () => {
      jest.advanceTimersByTime(1600)
    })
    expect(await screen.findByText('Player 01')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '2' }))
    expect(await screen.findByText('Player 21')).toBeInTheDocument()
    expect(screen.queryByText('Player 01')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Player 22'))
    await act(async () => {
      jest.advanceTimersByTime(3000)
    })

    // Still on page 2: its players are listed, page 1's are not
    expect(screen.getByText('Player 21')).toBeInTheDocument()
    expect(screen.queryByText('Player 01')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '2' })).toHaveClass('bg-accent')
  })
})
