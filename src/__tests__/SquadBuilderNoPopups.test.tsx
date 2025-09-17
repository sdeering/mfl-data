import React from 'react'
import { render, screen, act, queryByText } from '@testing-library/react'
import '@testing-library/jest-dom'

jest.mock('../../src/contexts/WalletContext', () => ({
  useWallet: () => ({ isConnected: true, account: '0xTEST' })
}))
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() })
}))
jest.mock('../../src/services/supabaseDataService', () => ({
  supabaseDataService: {
    getAgencyPlayers: jest.fn().mockResolvedValue([])
  }
}))
// Ensure toasts are not shown
jest.mock('../../src/components/Toast', () => ({
  useToast: () => ({ toasts: [], removeToast: () => {}, success: () => {}, error: () => {}, warning: () => {}, info: () => {} }),
  ToastContainer: () => null
}))

describe('Squad Builder - No initial popups', () => {
  it('does not show any initial toasts/popups on load', () => {
    jest.useFakeTimers()
    const Page = require('../../app/squad-builder/page').default
    const { container } = render(<Page />)
    act(() => {
      jest.advanceTimersByTime(1600)
    })
    // Look for common popup/toast text that would have appeared previously
    expect(container.textContent).not.toMatch(/Players Loaded|Squads Loaded|Success|Warning|Error/i)
  })
})
