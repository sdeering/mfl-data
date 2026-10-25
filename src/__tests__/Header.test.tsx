import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import Header from '../components/Header'

const mockPush = jest.fn()
let mockPathname = '/squad-builder'
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPathname,
}))
jest.mock('../components/WalletConnect', () => () => null)

describe('Header', () => {
  it('groups the pages under Agency and Tools', () => {
    render(<Header />)
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(within(nav).getAllByRole('link').map(link => link.textContent)).toEqual(['Home', 'Resources'])

    fireEvent.click(within(nav).getByRole('button', { name: 'Agency' }))
    expect(within(nav).getByRole('link', { name: 'Players' })).toHaveAttribute('href', '/agency')
    expect(within(nav).getByRole('link', { name: 'Clubs' })).toHaveAttribute('href', '/clubs')

    fireEvent.click(within(nav).getByRole('button', { name: 'Tools' }))
    expect(within(nav).getAllByRole('link').map(link => link.getAttribute('href'))).toEqual([
      '/', '/squad-builder', '/compare', '/player-progression', '/scout', '/matches', '/resources',
    ])
  })

  it('marks Tools as the section of a tool page', () => {
    render(<Header />)
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(within(nav).getByRole('button', { name: 'Tools' })).toHaveClass('bg-accent')
    expect(within(nav).getByRole('button', { name: 'Agency' })).not.toHaveClass('bg-accent')
  })

  it('opens a player as soon as their ID or link is pasted into the search', () => {
    render(<Header />)
    const search = screen.getByLabelText('Player ID')

    fireEvent.paste(search, { clipboardData: { getData: () => ' 350355 ' } })
    expect(mockPush).toHaveBeenLastCalledWith('/players/350355')

    fireEvent.paste(search, { clipboardData: { getData: () => 'https://app.playmfl.com/players/20686' } })
    expect(mockPush).toHaveBeenLastCalledWith('/players/20686')

    mockPush.mockClear()
    fireEvent.paste(search, { clipboardData: { getData: () => 'Lewis Cox' } })
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('keeps a pasted ID in the search, with an X to clear it', () => {
    const { rerender } = render(<Header />)
    const search = screen.getByLabelText('Player ID')
    expect(screen.queryByRole('button', { name: 'Clear player ID' })).not.toBeInTheDocument()

    fireEvent.paste(search, { clipboardData: { getData: () => 'https://app.playmfl.com/players/20686' } })
    expect(search).toHaveValue('20686')

    fireEvent.click(screen.getByRole('button', { name: 'Clear player ID' }))
    expect(search).toHaveValue('')
    expect(search).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'Clear player ID' })).not.toBeInTheDocument()

    // It stays while that player is on screen, and goes on leaving them
    try {
      fireEvent.paste(search, { clipboardData: { getData: () => '350355' } })
      mockPathname = '/players/350355'
      rerender(<Header />)
      expect(search).toHaveValue('350355')
      mockPathname = '/compare'
      rerender(<Header />)
      expect(search).toHaveValue('')
    } finally {
      mockPathname = '/squad-builder'
    }
  })

  it('picks out comparing on a player page', () => {
    mockPathname = '/players/20686'
    try {
      render(<Header />)
      const compare = screen.getByRole('link', { name: 'Compare vs Player' })
      expect(compare).toHaveAttribute('href', '/compare?playerId=20686')
      expect(compare).toHaveClass('text-accent-ink')
    } finally {
      mockPathname = '/squad-builder'
    }
  })

  it('links to Settings, where the theme is switched', () => {
    render(<Header />)
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings')
    expect(screen.queryByRole('button', { name: /dark mode|theme/i })).not.toBeInTheDocument()
  })
})
