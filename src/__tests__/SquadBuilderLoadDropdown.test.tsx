import React from 'react'
import { render, screen, act } from '@testing-library/react'
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
jest.mock('../../src/services/supabaseDataService', () => ({
  supabaseDataService: {
    getAgencyPlayers: jest.fn().mockResolvedValue([]),
    getAgencyPlayerMarketValues: jest.fn().mockResolvedValue([])
  }
}))
jest.mock('../../src/services/squadService', () => ({
  getSquads: jest.fn().mockResolvedValue([])
}))
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() })
}))
jest.mock('../../src/components/Toast', () => ({
  useToast: () => ({ toasts: [], removeToast: () => {}, success: () => {}, error: () => {}, warning: () => {}, info: () => {} }),
  ToastContainer: () => null
}))

describe('Squad Builder - Load Dropdown', () => {
  it('renders the load dropdown placeholder', async () => {
    jest.useFakeTimers()
    const Page = require('../../app/squad-builder/page').default
    render(<Page />)
    await act(async () => {
      jest.advanceTimersByTime(1600)
    })
    expect(await screen.findByText(/^Load Squad$/i)).toBeInTheDocument()
  })
})
