import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PlayerFilters, FilterState } from '../components/PlayerFilters';

// The range sliders measure themselves with ResizeObserver, which jsdom does not provide
beforeAll(() => {
  (global as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const filters: FilterState = {
  filterPosition: 'all',
  selectedCardTypes: [],
  overallMin: 0,
  overallMax: 100,
  positionRatingMin: 0,
  positionRatingMax: 100,
  attrFilters: { pace: 0, shooting: 0, passing: 0, dribbling: 0, defense: 0, physical: 0 },
  attrFiltersMax: { pace: 100, shooting: 100, passing: 100, dribbling: 100, defense: 100, physical: 100 },
};

describe('PlayerFilters - include retired players', () => {
  it('offers the tick box and reports changes when the page supports it', () => {
    const onIncludeRetiredChange = jest.fn();
    render(
      <PlayerFilters
        filters={filters}
        onFiltersChange={jest.fn()}
        showSidebarFilters={true}
        includeRetired={false}
        onIncludeRetiredChange={onIncludeRetiredChange}
      />
    );

    const checkbox = screen.getByLabelText('Include retired players');
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    expect(onIncludeRetiredChange).toHaveBeenCalledWith(true);
  });

  it('is left out on pages that do not list retired players', () => {
    render(<PlayerFilters filters={filters} onFiltersChange={jest.fn()} showSidebarFilters={true} />);

    expect(screen.queryByLabelText('Include retired players')).not.toBeInTheDocument();
  });
});
