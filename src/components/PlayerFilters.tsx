'use client';

import React, { useState, useEffect } from 'react';
import * as Slider from '@radix-ui/react-slider';
import { MFLPlayer } from '../types/mflApi';

export interface FilterState {
  filterPosition: string;
  selectedCardTypes: string[];
  overallMin: number;
  overallMax: number;
  positionRatingMin: number;
  positionRatingMax: number;
  attrFilters: {
    pace: number;
    shooting: number;
    passing: number;
    dribbling: number;
    defense: number;
    physical: number;
  };
  attrFiltersMax: {
    pace: number;
    shooting: number;
    passing: number;
    dribbling: number;
    defense: number;
    physical: number;
  };
}

interface PlayerFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  showSidebarFilters?: boolean;
  onToggleSidebarFilters?: () => void;
  calculatePositionRating?: (player: MFLPlayer, position: string) => number;
}

export const PlayerFilters: React.FC<PlayerFiltersProps> = ({
  filters,
  onFiltersChange,
  showSidebarFilters = false,
  onToggleSidebarFilters,
  calculatePositionRating,
}) => {
  const [localFilters, setLocalFilters] = useState<FilterState>(filters);

  // Update local filters when props change
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const updateFilter = (updates: Partial<FilterState>) => {
    const newFilters = { ...localFilters, ...updates };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const resetFilters = () => {
    const defaultFilters: FilterState = {
      filterPosition: 'all',
      selectedCardTypes: [],
      overallMin: 0,
      overallMax: 100,
      positionRatingMin: 0,
      positionRatingMax: 100,
      attrFilters: {
        pace: 0,
        shooting: 0,
        passing: 0,
        dribbling: 0,
        defense: 0,
        physical: 0,
      },
      attrFiltersMax: {
        pace: 100,
        shooting: 100,
        passing: 100,
        dribbling: 100,
        defense: 100,
        physical: 100,
      },
    };
    setLocalFilters(defaultFilters);
    onFiltersChange(defaultFilters);
  };

  const isFiltersActive = () => {
    return (
      localFilters.filterPosition !== 'all' ||
      localFilters.selectedCardTypes.length > 0 ||
      localFilters.overallMin > 0 ||
      localFilters.overallMax < 100 ||
      localFilters.positionRatingMin > 0 ||
      localFilters.positionRatingMax < 100 ||
      Object.values(localFilters.attrFilters).some(v => v > 0) ||
      Object.values(localFilters.attrFiltersMax).some(v => v < 100)
    );
  };

  return (
    <div className="space-y-3 mb-2">
      {/* Filter Toggle Button */}
      {onToggleSidebarFilters && (
        <div className="flex items-center justify-between gap-2">
          <button
            className="text-left px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer"
            onClick={onToggleSidebarFilters}
          >
            {showSidebarFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
          {isFiltersActive() && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              title="Reset filters"
            >
              Reset
            </button>
          )}
        </div>
      )}

      {/* Filter Content */}
      <div className={`grid grid-cols-2 gap-3 ${showSidebarFilters ? '' : 'hidden'}`}>
        {/* Card Type Filter */}
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Card type</label>
          <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap py-1">
            {[
              { key: 'common', label: 'Common', bg: 'bg-[#9f9f9f]', text: 'text-white' },
              { key: 'limited', label: 'Limited', bg: 'bg-[#ecd17f]', text: 'text-black' },
              { key: 'uncommon', label: 'Uncommon', bg: 'bg-[#71ff30]', text: 'text-black' },
              { key: 'epic', label: 'Epic', bg: 'bg-[#0047ff]', text: 'text-white' },
              { key: 'legendary', label: 'Legendary', bg: 'bg-[#fa53ff]', text: 'text-white' },
              { key: 'ultimate', label: 'Ultimate', bg: 'bg-[#87f6f8]', text: 'text-black' },
            ].map(opt => {
              const isSelected = localFilters.selectedCardTypes.includes(opt.key);
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => {
                    const newCardTypes = isSelected
                      ? localFilters.selectedCardTypes.filter(k => k !== opt.key)
                      : [...localFilters.selectedCardTypes, opt.key];
                    updateFilter({ selectedCardTypes: newCardTypes });
                  }}
                  className={`${opt.bg} ${opt.text} w-[30px] h-[35px] rounded-lg shadow-sm text-xs font-semibold cursor-pointer select-none flex items-center justify-center p-0 border ${isSelected ? 'border-2 border-white' : 'border-[var(--tier-common-foreground)]/15'}`}
                  title={opt.label}
                  aria-pressed={isSelected}
                >
                  <span className="sr-only">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Position Filter */}
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Position
          </label>
          <select
            value={localFilters.filterPosition}
            onChange={(e) => updateFilter({ filterPosition: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Positions</option>
            <option disabled>────────────</option>
            <option value="GK">GK - Goalkeeper</option>
            <option value="CB">CB - Center Back</option>
            <option value="LB">LB - Left Back</option>
            <option value="RB">RB - Right Back</option>
            <option value="LWB">LWB - Left Wing Back</option>
            <option value="RWB">RWB - Right Wing Back</option>
            <option value="CDM">CDM - Defensive Midfielder</option>
            <option value="CM">CM - Central Midfielder</option>
            <option value="CAM">CAM - Attacking Midfielder</option>
            <option value="LM">LM - Left Midfielder</option>
            <option value="RM">RM - Right Midfielder</option>
            <option value="LW">LW - Left Winger</option>
            <option value="RW">RW - Right Winger</option>
            <option value="ST">ST - Striker</option>
            <option value="CF">CF - Center Forward</option>
            <option disabled>────────────</option>
            <option value="__GROUP_DEFENDERS">Defenders (CB, LB, RB, LWB, RWB)</option>
            <option value="__GROUP_MIDFIELDERS">Midfielders (CM, CDM, LM, RM)</option>
            <option value="__GROUP_FORWARDS">Forwards (ST, CF, RW, LW, CAM)</option>
          </select>
        </div>

        {/* Overall Rating Slider */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Overall {localFilters.overallMin} - {localFilters.overallMax}
          </label>
          <Slider.Root
            className="relative flex items-center select-none w-full h-5"
            min={0}
            max={100}
            step={1}
            value={[localFilters.overallMin, localFilters.overallMax]}
            onValueChange={([min, max]) => updateFilter({ overallMin: min, overallMax: max })}
          >
            <Slider.Track className="bg-gray-200 dark:bg-gray-600 relative grow rounded h-1" />
            <Slider.Range className="absolute h-1 bg-blue-500 rounded" />
            <Slider.Thumb className="block w-2.5 h-5 bg-gray-600 border border-gray-400 rounded-sm" aria-label="Overall min" />
            <Slider.Thumb className="block w-2.5 h-5 bg-gray-600 border border-gray-400 rounded-sm" aria-label="Overall max" />
          </Slider.Root>
        </div>

        {/* Position Rating Slider (only show if calculatePositionRating is provided) */}
        {calculatePositionRating && (
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Position rating {localFilters.positionRatingMin} - {localFilters.positionRatingMax}
            </label>
            <Slider.Root
              className="relative flex items-center select-none w-full h-5"
              min={0}
              max={100}
              step={1}
              value={[localFilters.positionRatingMin, localFilters.positionRatingMax]}
              onValueChange={([min, max]) => updateFilter({ positionRatingMin: min, positionRatingMax: max })}
            >
              <Slider.Track className="bg-gray-200 dark:bg-gray-600 relative grow rounded h-1" />
              <Slider.Range className="absolute h-1 bg-blue-500 rounded" />
              <Slider.Thumb className="block w-2.5 h-5 bg-gray-600 border border-gray-400 rounded-sm" aria-label="Position min" />
              <Slider.Thumb className="block w-2.5 h-5 bg-gray-600 border border-gray-400 rounded-sm" aria-label="Position max" />
            </Slider.Root>
          </div>
        )}

        {/* Attribute Sliders */}
        {([
          ['pace', 'PAC'],
          ['shooting', 'SHO'],
          ['passing', 'PAS'],
          ['dribbling', 'DRI'],
          ['defense', 'DEF'],
          ['physical', 'PHY'],
        ] as Array<[keyof typeof localFilters.attrFilters, string]>).map(([key, label]) => (
          <div key={key} className="col-span-1">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              {label} {localFilters.attrFilters[key]} - {localFilters.attrFiltersMax[key]}
            </label>
            <Slider.Root
              className="relative flex items-center select-none w-full h-5"
              min={0}
              max={100}
              step={1}
              value={[localFilters.attrFilters[key], localFilters.attrFiltersMax[key]]}
              onValueChange={([min, max]) => {
                updateFilter({
                  attrFilters: { ...localFilters.attrFilters, [key]: min },
                  attrFiltersMax: { ...localFilters.attrFiltersMax, [key]: max },
                });
              }}
            >
              <Slider.Track className="bg-gray-200 dark:bg-gray-600 relative grow rounded h-1" />
              <Slider.Range className="absolute h-1 bg-blue-500 rounded" />
              <Slider.Thumb className="block w-2.5 h-5 bg-gray-600 border border-gray-400 rounded-sm" aria-label={`${label} min`} />
              <Slider.Thumb className="block w-2.5 h-5 bg-gray-600 border border-gray-400 rounded-sm" aria-label={`${label} max`} />
            </Slider.Root>
          </div>
        ))}
      </div>
    </div>
  );
};

// Helper function to get card type from overall rating
export const getCardTypeFromOverall = (overall: number): 'ultimate' | 'legendary' | 'epic' | 'uncommon' | 'limited' | 'common' => {
  if (overall >= 95) return 'ultimate';
  if (overall >= 85) return 'legendary';
  if (overall >= 75) return 'epic';
  if (overall >= 65) return 'uncommon';
  if (overall >= 55) return 'limited';
  return 'common';
};

// Helper function to apply filters to players
export const applyFilters = (
  players: MFLPlayer[],
  filters: FilterState,
  calculatePositionRating?: (player: MFLPlayer, position: string) => number
): MFLPlayer[] => {
  let filtered = [...players];

  // Position filter
  if (filters.filterPosition !== 'all') {
    if (filters.filterPosition === '__GROUP_DEFENDERS') {
      filtered = filtered.filter(p => 
        p.metadata.positions.some(pos => ['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(pos))
      );
    } else if (filters.filterPosition === '__GROUP_MIDFIELDERS') {
      filtered = filtered.filter(p => 
        p.metadata.positions.some(pos => ['CM', 'CDM', 'LM', 'RM'].includes(pos))
      );
    } else if (filters.filterPosition === '__GROUP_FORWARDS') {
      filtered = filtered.filter(p => 
        p.metadata.positions.some(pos => ['ST', 'CF', 'RW', 'LW', 'CAM'].includes(pos))
      );
    } else {
      filtered = filtered.filter(p => 
        p.metadata.positions.includes(filters.filterPosition as any)
      );
    }
  }

  // Card type filter
  if (filters.selectedCardTypes.length > 0) {
    filtered = filtered.filter(p => 
      filters.selectedCardTypes.includes(getCardTypeFromOverall(p.metadata.overall))
    );
  }

  // Overall rating filter
  filtered = filtered.filter(p => 
    p.metadata.overall >= filters.overallMin && p.metadata.overall <= filters.overallMax
  );

  // Position rating filter (only if calculatePositionRating is provided)
  if (calculatePositionRating) {
    filtered = filtered.filter(p => {
      const best = p.metadata.positions
        .map(pos => calculatePositionRating(p, pos))
        .reduce((a, b) => Math.max(a, b), 0);
      return best >= filters.positionRatingMin && best <= filters.positionRatingMax;
    });
  }

  // Attribute filters
  filtered = filtered.filter(p => 
    p.metadata.pace >= filters.attrFilters.pace && p.metadata.pace <= filters.attrFiltersMax.pace &&
    p.metadata.shooting >= filters.attrFilters.shooting && p.metadata.shooting <= filters.attrFiltersMax.shooting &&
    p.metadata.passing >= filters.attrFilters.passing && p.metadata.passing <= filters.attrFiltersMax.passing &&
    p.metadata.dribbling >= filters.attrFilters.dribbling && p.metadata.dribbling <= filters.attrFiltersMax.dribbling &&
    p.metadata.defense >= filters.attrFilters.defense && p.metadata.defense <= filters.attrFiltersMax.defense &&
    p.metadata.physical >= filters.attrFilters.physical && p.metadata.physical <= filters.attrFiltersMax.physical
  );

  return filtered;
};

