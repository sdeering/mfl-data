import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import WalletConnect from '../components/WalletConnect'

const ACCOUNT = '0x95dc70d7d39f6f76'

jest.mock('../contexts/WalletContext', () => ({
  useWallet: () => ({
    isConnected: true,
    account: '0x95dc70d7d39f6f76',
    connectWallet: jest.fn(),
    disconnectWallet: jest.fn(),
    isLoading: false,
    error: null,
  }),
}))
jest.mock('../contexts/SupabaseSyncContext', () => ({
  useSupabaseSyncUI: () => ({ startSync: jest.fn(), stopSync: jest.fn(), isSyncing: false, progress: [] }),
}))

describe('WalletConnect - copy wallet address', () => {
  const writeText = jest.fn(() => Promise.resolve())

  beforeEach(() => {
    jest.useFakeTimers()
    writeText.mockClear()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('copies the full address from the dropdown and shows a tick for a moment', async () => {
    render(<WalletConnect />)
    fireEvent.click(screen.getByRole('button', { name: /0x95dc/ }))
    expect(screen.getByText(ACCOUNT)).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy wallet address' }))
    })
    expect(writeText).toHaveBeenCalledWith(ACCOUNT)
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument()

    act(() => {
      jest.advanceTimersByTime(1500)
    })
    expect(screen.getByRole('button', { name: 'Copy wallet address' })).toBeInTheDocument()
  })
})
