import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import Header from '../components/Header'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/squad-builder',
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

  it('links to Settings, where the theme is switched', () => {
    render(<Header />)
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings')
    expect(screen.queryByRole('button', { name: /dark mode|theme/i })).not.toBeInTheDocument()
  })
})
