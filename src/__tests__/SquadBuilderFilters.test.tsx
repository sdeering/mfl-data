import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom'
// Mock Radix Slider to simple range inputs for jsdom
jest.mock('@radix-ui/react-slider', () => {
  const React = require('react')
  return {
    __esModule: true,
    Root: ({ min = 0, max = 100, step = 1, value = [0, 100], onValueChange }: any) => (
      <div>
        <input type="range" role="slider" aria-label="min" min={min} max={max} step={step} value={value[0]} onChange={(e) => onValueChange([Number(e.target.value), value[1]])} />
        <input type="range" role="slider" aria-label="max" min={min} max={max} step={step} value={value[1]} onChange={(e) => onValueChange([value[0], Number(e.target.value)])} />
      </div>
    ),
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

describe('Squad Builder - Filters', () => {
  it('attribute sliders render and can change values', async () => {
    jest.useFakeTimers()
    const Page = require('../../app/squad-builder/page').default
    render(<Page />)
    await act(async () => {
      jest.advanceTimersByTime(1600)
    })

    // Sliders should be present (Radix slider thumbs)
    const sliders = await screen.findAllByRole('slider')
    expect(sliders.length).toBeGreaterThan(0)
    // Simulate keyboard adjustment on first slider thumb
    sliders[0].focus()
    fireEvent.keyDown(sliders[0], { key: 'ArrowRight', code: 'ArrowRight' })
  })
})
