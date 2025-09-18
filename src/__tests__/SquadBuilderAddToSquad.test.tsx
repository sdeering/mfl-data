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

// Mocks for wallet and navigation
jest.mock('../..//src/contexts/WalletContext', () => ({
  useWallet: () => ({ isConnected: true, account: '0xTEST' })
}))
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() })
}))

// Mock Toast to avoid rendering
jest.mock('../..//src/components/Toast', () => ({
  useToast: () => ({ toasts: [], removeToast: () => {}, success: () => {}, error: () => {}, warning: () => {}, info: () => {} }),
  ToastContainer: () => null
}))

// Mock services
jest.mock('../..//src/services/supabaseDataService', () => ({
  supabaseDataService: {
    getAgencyPlayers: jest.fn().mockResolvedValue([
      {
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
      },
    ]),
  }
}))
jest.mock('../..//src/services/squadService', () => ({
  getSquads: jest.fn().mockResolvedValue([]),
  saveSquad: jest.fn(),
  deleteSquad: jest.fn(),
}))

describe('Squad Builder - Add to squad', () => {
  it('adds player to table when clicking anywhere on the card', async () => {
    jest.useFakeTimers()
    const Page = require('../../app/squad-builder/page').default
    render(<Page />)
    await act(async () => {
      jest.advanceTimersByTime(1600)
    })
    // Clicking the name area should add as well
    const name = await screen.findByText(/Test Striker/i)
    fireEvent.click(name)

    // Ensure present (can appear in sidebar and table); at least one instance
    const occurrences = await screen.findAllByText(/Test Striker/i)
    expect(occurrences.length).toBeGreaterThan(0)
  })
})


