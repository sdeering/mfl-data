import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import WalletGate from '../components/WalletGate'
import { normalizeWalletAddress } from '../utils/walletAddress'

const mockWallet = {
  connectWallet: jest.fn(),
  viewWallet: jest.fn((address: string) => normalizeWalletAddress(address) !== null),
  isLoading: false,
  isReady: true,
}

jest.mock('../contexts/WalletContext', () => ({
  useWallet: () => mockWallet,
}))

describe('WalletGate', () => {
  beforeEach(() => {
    mockWallet.connectWallet.mockClear()
    mockWallet.viewWallet.mockClear()
    mockWallet.isReady = true
  })

  it('offers to connect a wallet or to view one by its address', () => {
    render(<WalletGate title="MFL Clubs" description="the clubs you own" />)

    expect(screen.getByRole('heading', { name: 'MFL Clubs' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Connect Wallet' }))
    expect(mockWallet.connectWallet).toHaveBeenCalled()
    expect(screen.getByLabelText('Wallet address')).toBeInTheDocument()
  })

  it('views a pasted wallet address straight away', () => {
    render(<WalletGate title="MFL Clubs" description="the clubs you own" />)

    fireEvent.paste(screen.getByLabelText('Wallet address'), { clipboardData: { getData: () => ' 0x95dc70d7d39f6f76 ' } })
    expect(mockWallet.viewWallet).toHaveBeenCalledWith(' 0x95dc70d7d39f6f76 ')
  })

  it('says so when what was typed is not a wallet address', () => {
    render(<WalletGate title="MFL Clubs" description="the clubs you own" />)

    fireEvent.change(screen.getByLabelText('Wallet address'), { target: { value: 'not-a-wallet' } })
    fireEvent.click(screen.getByRole('button', { name: 'View' }))
    expect(screen.getByRole('alert')).toHaveTextContent("isn't a wallet address")
  })

  it('waits for the saved login to be checked before asking', () => {
    mockWallet.isReady = false
    render(<WalletGate title="MFL Clubs" description="the clubs you own" />)

    expect(screen.getByText('Checking wallet connection...')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Connect Wallet' })).not.toBeInTheDocument()
  })
})

describe('normalizeWalletAddress', () => {
  it('accepts a Flow address with or without 0x, in any case', () => {
    expect(normalizeWalletAddress('0x95dc70d7d39f6f76')).toBe('0x95dc70d7d39f6f76')
    expect(normalizeWalletAddress('95DC70D7D39F6F76')).toBe('0x95dc70d7d39f6f76')
  })

  it('rejects anything else', () => {
    expect(normalizeWalletAddress('0x95dc70d7')).toBeNull()
    expect(normalizeWalletAddress('0x95dc70d7d39f6f7z')).toBeNull()
    expect(normalizeWalletAddress('')).toBeNull()
  })
})
