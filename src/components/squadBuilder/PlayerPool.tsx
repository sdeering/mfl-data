import React from 'react';
import type { MFLPlayer } from '../../types/mflApi';
import type { MFLPosition } from '../../types/positionOvr';
import { positionFit } from '../../utils/squadLineups';
import { getTierColors } from '../../utils/tierColors';
import RetirementIcon from '../RetirementIcon';
import { Panel, btnSecondary, fieldClass } from '../ui';
import { DragHandlers, PlayerAvatar, RatingText, STAT_KEYS, fullName } from './shared';

export const POSITION_GROUPS: Record<string, MFLPosition[] | null> = {
  All: null,
  GK: ['GK'],
  DEF: ['CB', 'LB', 'RB', 'LWB', 'RWB'],
  MID: ['CDM', 'CM', 'CAM', 'LM', 'RM'],
  FWD: ['LW', 'RW', 'ST', 'CF'],
};

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
  players: MFLPlayer[];
  totalCount: number;
  search: string;
  onSearch: (value: string) => void;
  showFilters: boolean;
  onToggleFilters: () => void;
  group: string;
  onGroup: (group: string) => void;
  whereIs: (player: MFLPlayer) => PoolUse | null;
  onPlace: (player: MFLPlayer) => void;
  /** Dropping a lineup's player back on the pool takes them out of it */
  onDropBack: (playerId: number) => void;
  drag: DragHandlers;
  draggedId: () => number | null;
}

/** Every player in the agency as a card, to drag onto the pitch or click to place. */
export default function PlayerPool({
  players,
  totalCount,
  search,
  onSearch,
  showFilters,
  onToggleFilters,
  group,
  onGroup,
  whereIs,
  onPlace,
  onDropBack,
  drag,
  draggedId,
}: PlayerPoolProps) {
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

      {showFilters && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Positions">
          {Object.keys(POSITION_GROUPS).map(key => (
            <button
              key={key}
              type="button"
              onClick={() => onGroup(key)}
              aria-pressed={group === key}
              className={`h-[30px] px-3 rounded-full border text-xs font-bold cursor-pointer transition-colors ${
                group === key ? 'bg-accent border-accent text-accent-fg' : 'border-line-2 text-fg-3 hover:border-line-hover'
              }`}
            >
              {key}
            </button>
          ))}
        </div>
      )}

      <div className="flex justify-between gap-2 text-xs font-medium text-muted">
        <span>Drag onto the pitch, or click to auto-place</span>
        <span className="flex-none">
          Showing {players.length} of {totalCount}
        </span>
      </div>

      <div className="flex flex-col gap-2 max-h-[26rem] min-[64rem]:max-h-[1060px] overflow-y-auto pr-0.5">
        {players.length === 0 && <p className="m-0 py-8 text-center text-sm font-medium text-muted">No players match.</p>}
        {players.map(player => (
          <PoolCard key={player.id} player={player} use={whereIs(player)} onPlace={() => onPlace(player)} drag={drag} />
        ))}
      </div>
    </Panel>
  );
}

const PoolCard: React.FC<{ player: MFLPlayer; use: PoolUse | null; onPlace: () => void; drag: DragHandlers }> = ({ player, use, onPlace, drag }) => {
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
            <RetirementIcon retirementYears={m.retirementYears} className="w-3 h-3" />
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
