import React from 'react'
import { render, screen, act } from '@testing-library/react'
import '@testing-library/jest-dom'

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
    expect(await screen.findByText(/Load Squad.../i)).toBeInTheDocument()
  })
})
