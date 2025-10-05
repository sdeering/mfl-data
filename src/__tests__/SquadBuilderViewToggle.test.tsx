import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
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

// Mock wallet and services to avoid ESM deps and network
jest.mock('../../src/contexts/WalletContext', () => ({
  useWallet: () => ({ isConnected: true, account: '0xTEST' })
}))
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() })
}))
jest.mock('../../src/services/supabaseDataService', () => ({
  supabaseDataService: {
    getAgencyPlayers: jest.fn().mockResolvedValue([]),
    getAgencyPlayerMarketValues: jest.fn().mockResolvedValue([])
  }
}))
jest.mock('../../src/components/Toast', () => ({
  useToast: () => ({ toasts: [], removeToast: () => {}, success: () => {}, error: () => {}, warning: () => {}, info: () => {} }),
  ToastContainer: () => null
}))

describe('Squad Builder - View Toggle', () => {
  it('renders table-only view', async () => {
    jest.useFakeTimers()
    // Lazy import to avoid Next.js routing specifics; render the component module default
    const Page = require('../../app/squad-builder/page').default
    render(<Page />)
    await act(async () => {
      jest.advanceTimersByTime(1600)
    })
    // Table should render
    const tables = await screen.findAllByRole('table')
    expect(tables.length).toBeGreaterThan(0)
    // No field toggle in table-only mode
    expect(screen.queryByRole('button', { name: /field/i })).not.toBeInTheDocument()
  })
})
