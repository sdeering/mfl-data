import React, { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { SearchField } from '../components/ui'
import { playerIdFromText } from '../utils/playerId'

describe('SearchField', () => {
  const Search = ({ withClear = true }: { withClear?: boolean }) => {
    const [value, setValue] = useState('')
    return (
      <SearchField
        aria-label="Search players"
        value={value}
        onChange={e => setValue(e.target.value)}
        onClear={withClear ? () => setValue('') : undefined}
      />
    )
  }

  it('has an X that empties it whenever something is in it', () => {
    render(<Search />)
    const search = screen.getByLabelText('Search players')
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument()

    fireEvent.change(search, { target: { value: 'Pavlović' } })
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))

    expect(search).toHaveValue('')
    expect(search).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument()
  })

  it('has no X without a way to clear it', () => {
    render(<Search withClear={false} />)
    fireEvent.change(screen.getByLabelText('Search players'), { target: { value: 'Pavlović' } })
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument()
  })
})

describe('playerIdFromText', () => {
  it('finds the ID on its own, or in a link to the player', () => {
    expect(playerIdFromText(' 350355 ')).toBe('350355')
    expect(playerIdFromText('#20686')).toBe('20686')
    expect(playerIdFromText('https://app.playmfl.com/players/20686')).toBe('20686')
    expect(playerIdFromText('https://mfldata.com/players/116267?tab=stats')).toBe('116267')
  })

  it('finds nothing in a name or other text', () => {
    expect(playerIdFromText('Lewis Cox')).toBeNull()
    expect(playerIdFromText('abc123')).toBeNull()
    expect(playerIdFromText('')).toBeNull()
  })
})
