import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LoadSquadModal } from '../components/squadBuilder/SquadModals'

const squad = (id: string, name: string) => ({
  id,
  wallet_address: '0xTEST',
  squad_name: name,
  formation_id: '4-4-2',
  players: { lineups: [{ name: 'Lineup A', formation: '4-4-2', xi: [], bench: [] }], players: {} },
  created_at: '2026-10-01',
  updated_at: '2026-10-20',
})
const squads = [squad('a', 'Japan'), squad('b', 'Brazil'), squad('c', 'Spain')]

describe('Load Saved Squad', () => {
  // jsdom has no pointer events, so fireEvent would send ones without a button or position
  beforeAll(() => {
    if (!window.PointerEvent) (window as any).PointerEvent = class PointerEvent extends MouseEvent {}
  })

  // Rows 60px apart, as jsdom lays nothing out
  beforeEach(() => {
    jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const index = this.parentElement ? Array.from(this.parentElement.children).indexOf(this) : 0
      return { top: index * 60, height: 50, bottom: index * 60 + 50, left: 0, right: 600, width: 600, x: 0, y: index * 60, toJSON: () => ({}) } as DOMRect
    })
  })
  afterEach(() => jest.restoreAllMocks())

  const renderModal = (onReorder = jest.fn()) => {
    render(
      <LoadSquadModal
        squads={squads}
        isLoading={false}
        deletingId={null}
        onLoad={jest.fn()}
        onDelete={jest.fn()}
        onRename={jest.fn()}
        onReorder={onReorder}
        onClose={jest.fn()}
      />
    )
    return onReorder
  }
  const names = () => within(screen.getByRole('list', { name: 'Saved squads' })).getAllByRole('heading').map(h => h.textContent)

  it('shows a squad where it is dragged, and keeps the order when it is let go', () => {
    const onReorder = renderModal()

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Move Japan' }), { button: 0 })
    // Past the middle of Brazil (85), then of Spain (145)
    fireEvent.pointerMove(window, { clientY: 100 })
    expect(names()).toEqual(['Brazil', 'Japan', 'Spain'])
    fireEvent.pointerMove(window, { clientY: 160 })
    expect(names()).toEqual(['Brazil', 'Spain', 'Japan'])
    expect(onReorder).not.toHaveBeenCalled()

    fireEvent.pointerUp(window)
    expect(onReorder).toHaveBeenCalledWith([squads[1], squads[2], squads[0]])
  })

  it('leaves the order alone when a squad is let go where it started', () => {
    const onReorder = renderModal()

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Move Brazil' }), { button: 0 })
    // Up past the middle of Japan, then back down past it
    fireEvent.pointerMove(window, { clientY: 20 })
    expect(names()).toEqual(['Brazil', 'Japan', 'Spain'])
    fireEvent.pointerMove(window, { clientY: 100 })
    fireEvent.pointerUp(window)

    expect(onReorder).not.toHaveBeenCalled()
    expect(names()).toEqual(['Japan', 'Brazil', 'Spain'])
  })
})
