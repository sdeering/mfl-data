import React from 'react';
import * as Slider from '@radix-ui/react-slider';
import type { MFLPlayer } from '../../types/mflApi';
import type { MFLPosition } from '../../types/positionOvr';
import { positionFit } from '../../utils/squadLineups';
import { getTierColors } from '../../utils/tierColors';
import RetirementIcon from '../RetirementIcon';
import { Panel, btnSecondary, fieldClass } from '../ui';
import { CARD_TYPES, DEFAULT_POOL_FILTERS, POSITION_GROUPS, PoolFilters, Range, StatKey, isFiltering } from './poolFilters';
import { DragHandlers, PlayerAvatar, RatingText, STAT_KEYS, STAT_LABELS, fullName } from './shared';

/** Where a player already is: in the current lineup, or in another saved squad (named in the tooltip). */
export interface PoolUse {
  label: 'XI' | 'Bench' | 'Other squad';
  title?: string;
}

const USE_BADGE: Record<PoolUse['label'], string> = {
  XI: 'bg-accent/16 text-accent-ink',
  Bench: 'bg-yellow-400/16 text-warn-ink',
  'Other squad': 'bg-orange-500/15 text-orange-ink',
};

interface PlayerPoolProps {
  /** The players matching the search and filters */
  players: MFLPlayer[];
  totalCount: number;
  search: string;
  onSearch: (value: string) => void;
  showFilters: boolean;
  onToggleFilters: () => void;
  filters: PoolFilters;
  onFilters: (filters: PoolFilters) => void;
  page: number;
  onPage: (page: number) => void;
  season: number | null;
  whereIs: (player: MFLPlayer) => PoolUse | null;
  onPlace: (player: MFLPlayer) => void;
  /** Dropping a lineup's player back on the pool takes them out of it */
  onDropBack: (playerId: number) => void;
  drag: DragHandlers;
  draggedId: () => number | null;
}

/** Every player in the agency as a card, to drag onto the pitch or click to place. */
export const POOL_PAGE_SIZE = 20;

export default function PlayerPool({
  players,
  totalCount,
  search,
  onSearch,
  showFilters,
  onToggleFilters,
  filters,
  onFilters,
  page,
  onPage,
  season,
  whereIs,
  onPlace,
  onDropBack,
  drag,
  draggedId,
}: PlayerPoolProps) {
  const pageCount = Math.ceil(players.length / POOL_PAGE_SIZE);
  const shown = players.slice(page * POOL_PAGE_SIZE, (page + 1) * POOL_PAGE_SIZE);
  return (
    <Panel
      className="[grid-area:pool] min-w-0 flex flex-col gap-2.5 p-3.5"
      aria-label="Your players"
      onDragOver={e => e.preventDefault()}
      onDrop={e => {
        e.preventDefault();
        const id = draggedId();
        drag.end();
        if (id !== null) onDropBack(id);
      }}
    >
      <div className="flex gap-2">
        <input
          type="text"
          value={search}
          onChange={e => onSearch(e.target.value)}
          placeholder="Search players…"
          aria-label="Search players"
          className={`${fieldClass} flex-1 min-w-0`}
        />
        <button type="button" onClick={onToggleFilters} className={`${btnSecondary} px-3.5`} aria-expanded={showFilters}>
          {showFilters ? 'Hide Filters' : 'Show Filters'}
        </button>
      </div>

      {showFilters && <FiltersPanel filters={filters} onFilters={onFilters} />}

      <div className="flex justify-between gap-2 text-xs font-medium text-muted">
        <span>Drag onto the pitch, or click to auto-place</span>
        <span className="flex-none">
          {players.length > POOL_PAGE_SIZE
            ? `Showing ${page * POOL_PAGE_SIZE + 1}-${page * POOL_PAGE_SIZE + shown.length} of ${players.length}`
            : `Showing ${players.length} of ${totalCount}`}
        </span>
      </div>

      <div className="flex flex-col gap-2 max-h-[26rem] min-[64rem]:max-h-[1060px] overflow-y-auto pr-0.5">
        {players.length === 0 && <p className="m-0 py-8 text-center text-sm font-medium text-muted">No players match.</p>}
        {shown.map(player => (
          <PoolCard key={player.id} player={player} season={season} use={whereIs(player)} onPlace={() => onPlace(player)} drag={drag} />
        ))}
      </div>

      {pageCount > 1 && (
        <nav className="flex flex-wrap justify-center gap-1.5 pt-1" aria-label="Pages of players">
          {Array.from({ length: pageCount }, (_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => onPage(index)}
              aria-current={index === page ? 'page' : undefined}
              className={`min-w-8 h-8 px-2 rounded-lg border text-xs font-bold cursor-pointer transition-colors ${
                index === page ? 'bg-accent text-accent-fg border-accent' : 'bg-btn text-fg-3 border-line-2 hover:border-line-hover'
              }`}
            >
              {index + 1}
            </button>
          ))}
        </nav>
      )}
    </Panel>
  );
}

const sliderLabelClass = 'block mb-1.5 text-xs font-semibold text-muted';

const RangeSlider: React.FC<{ label: string; value: Range; onChange: (value: Range) => void }> = ({ label, value, onChange }) => (
  <div>
    <span className={sliderLabelClass}>
      {label} {value[0]} - {value[1]}
    </span>
    <Slider.Root
      className="relative flex items-center select-none w-full h-5"
      min={0}
      max={100}
      step={1}
      value={value}
      onValueChange={([min, max]) => onChange([min, max])}
    >
      <Slider.Track className="relative grow h-1 rounded-full bg-line-2">
        <Slider.Range className="absolute h-1 rounded-full bg-accent" />
      </Slider.Track>
      {(['min', 'max'] as const).map(end => (
        <Slider.Thumb
          key={end}
          aria-label={`${label} ${end}`}
          className="block w-3.5 h-3.5 rounded-full bg-accent border-2 border-panel shadow-[0_0_0_1px_rgba(0,0,0,.3)] cursor-grab outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        />
      ))}
    </Slider.Root>
  </div>
);

/** Positions, card types, rating and attribute ranges, and leaving out players already picked. */
const FiltersPanel: React.FC<{ filters: PoolFilters; onFilters: (filters: PoolFilters) => void }> = ({ filters, onFilters }) => {
  const set = (patch: Partial<PoolFilters>) => onFilters({ ...filters, ...patch });
  const setStat = (key: StatKey, range: Range) => set({ stats: { ...filters.stats, [key]: range } });
  return (
    <div className="flex flex-col gap-3.5 p-3.5 rounded-2xl border border-line bg-inset">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Positions">
        {Object.keys(POSITION_GROUPS).map(key => (
          <button
            key={key}
            type="button"
            onClick={() => set({ group: key })}
            aria-pressed={filters.group === key}
            className={`h-[30px] px-3 rounded-full border text-xs font-bold cursor-pointer transition-colors ${
              filters.group === key ? 'bg-accent border-accent text-accent-fg' : 'border-line-2 text-fg-3 hover:border-line-hover'
            }`}
          >
            {key}
          </button>
        ))}
      </div>

      <div>
        <span className={sliderLabelClass}>Card type</span>
        <div className="flex items-center gap-2 p-1" role="group" aria-label="Card type">
          {CARD_TYPES.map(type => {
            const selected = filters.cardTypes.includes(type.key);
            return (
              <button
                key={type.key}
                type="button"
                onClick={() => set({ cardTypes: selected ? filters.cardTypes.filter(key => key !== type.key) : [...filters.cardTypes, type.key] })}
                aria-pressed={selected}
                aria-label={type.label}
                title={`${type.label} (${type.min}+)`}
                className={`flex-none w-[30px] h-[35px] rounded-lg border border-[rgba(var(--glass-rgb),.14)] cursor-pointer transition-shadow ${
                  selected ? 'ring-2 ring-accent-ink ring-offset-2 ring-offset-inset' : ''
                }`}
                style={{ background: getTierColors(type.min).bg }}
              />
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
        <RangeSlider label="Overall" value={filters.overall} onChange={overall => set({ overall })} />
        <RangeSlider label="Position rating" value={filters.positionRating} onChange={positionRating => set({ positionRating })} />
        {STAT_KEYS.map((key, index) => (
          <RangeSlider key={key} label={STAT_LABELS[index]} value={filters.stats[key]} onChange={range => setStat(key, range)} />
        ))}
      </div>

      <div className="flex items-center gap-2">
        <input
          id="hide-retiring"
          type="checkbox"
          checked={filters.hideRetiring}
          onChange={e => set({ hideRetiring: e.target.checked })}
          className="w-4 h-4 cursor-pointer accent-accent"
        />
        <label htmlFor="hide-retiring" className="text-sm font-medium text-fg-3 select-none cursor-pointer">
          Hide players retiring at the end of this season
        </label>
      </div>

      <div className="flex items-center gap-2">
        <input
          id="hide-selected"
          type="checkbox"
          checked={filters.hideSelected}
          onChange={e => set({ hideSelected: e.target.checked })}
          className="w-4 h-4 cursor-pointer accent-accent"
        />
        <label htmlFor="hide-selected" className="text-sm font-medium text-fg-3 select-none cursor-pointer">
          Hide selected players
        </label>
        {isFiltering(filters) && (
          <button
            type="button"
            onClick={() => onFilters(DEFAULT_POOL_FILTERS)}
            className="ml-auto text-sm font-semibold text-accent-ink hover:text-accent-hover cursor-pointer"
          >
            Reset Filters
          </button>
        )}
      </div>
    </div>
  );
};

const PoolCard: React.FC<{ player: MFLPlayer; season: number | null; use: PoolUse | null; onPlace: () => void; drag: DragHandlers }> = ({
  player,
  season,
  use,
  onPlace,
  drag,
}) => {
  const m = player.metadata;
  const inLineup = use?.label === 'XI' || use?.label === 'Bench';
  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={drag.start(player.id)}
      onDragEnd={drag.end}
      onClick={onPlace}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPlace();
        }
      }}
      className={`flex flex-col gap-2 px-3.5 py-3 rounded-2xl border cursor-grab select-none transition-colors hover:border-line-hover ${
        inLineup ? 'border-accent/30 bg-accent/[0.04]' : 'border-line bg-inset'
      }`}
    >
      <div className="flex items-center gap-3">
        <PlayerAvatar
          player={player}
          className={`w-11 h-11 border-2 bg-chip ${inLineup ? 'border-accent' : 'border-line-2'}`}
          initialsClassName="text-sm text-fg-3"
        />
        <div className="flex-1 min-w-0 flex flex-col gap-[3px]">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[15px] font-bold text-fg truncate">{fullName(player)}</span>
            <RetirementIcon retirementYears={m.retirementYears} currentSeason={season} className="w-3 h-3" />
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-muted">
            {m.positions.slice(0, 3).map(position => {
              const { rating } = positionFit(player, position as MFLPosition);
              return (
                <span key={position}>
                  {position} <b style={{ color: getTierColors(rating).text }}>{rating}</b>
                </span>
              );
            })}
            {use && (
              <span
                title={use.title}
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-[0.06em] ${USE_BADGE[use.label]}`}
              >
                {use.label}
              </span>
            )}
          </div>
        </div>
        <div className="flex-none flex flex-col items-center">
          <span className="font-display text-2xl font-extrabold leading-none tabular-nums" style={{ color: getTierColors(m.overall).text }}>
            {m.overall}
          </span>
          <span className="text-[9px] font-bold tracking-[0.1em] text-muted-3">OVR</span>
        </div>
      </div>
      <div className="grid grid-cols-6 pt-2 border-t border-divider text-[13px]">
        {STAT_KEYS.map(key => (
          <RatingText key={key} value={m[key]} color={getTierColors(m[key]).text} />
        ))}
      </div>
    </div>
  );
};
