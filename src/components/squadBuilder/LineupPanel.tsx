import React, { useMemo } from 'react';
import type { MFLPlayer } from '../../types/mflApi';
import { FORMATIONS, Lineup, PositionFit, SlotRef, XI_SIZE, positionFit } from '../../utils/squadLineups';
import { getTierColors } from '../../utils/tierColors';
import { Panel, fieldClass } from '../ui';
import { CloseIcon, FIT_COLORS, FIT_LABELS, FIT_SHORT_LABELS, PlayerAvatar, fullName } from './shared';

interface LineupPanelProps {
  lineup: Lineup;
  players: MFLPlayer[];
  playersById: Map<number, MFLPlayer>;
  selected: SlotRef | null;
  onSelect: (slot: SlotRef) => void;
  onClose: () => void;
  onPick: (player: MFLPlayer) => void;
  query: string;
  onQuery: (value: string) => void;
  /** So the page can scroll the panel into view when it sits below the pitch */
  panelRef?: React.Ref<HTMLElement>;
}

/**
 * Beside the pitch: with a position picked, the players who would be best there; otherwise how the lineup
 * shapes up, its XI with each player's rating at their position.
 */
export default function LineupPanel(props: LineupPanelProps) {
  return (
    <Panel ref={props.panelRef} className="[grid-area:panel] min-w-0 flex flex-col gap-3 p-4 scroll-mt-4">
      {props.selected ? <Picker {...props} selected={props.selected} /> : <Summary {...props} />}
    </Panel>
  );
}

function Picker({ lineup, players, selected, onClose, onPick, query, onQuery }: LineupPanelProps & { selected: SlotRef }) {
  const position = selected.type === 'xi' ? FORMATIONS[lineup.formation][selected.index][0] : null;
  const current = selected.type === 'xi' ? lineup.xi[selected.index] : lineup.bench[selected.index];

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return players
      .filter(player => !q || fullName(player).toLowerCase().includes(q))
      .map(player => ({ player, fit: position ? positionFit(player, position) : ({ rating: player.metadata.overall, kind: 'natural' } as PositionFit) }))
      .sort((a, b) => b.fit.rating - a.fit.rating || b.player.metadata.overall - a.player.metadata.overall);
  }, [players, position, query]);

  return (
    <>
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex flex-col gap-0.5">
          <h3 className="m-0 font-display text-xl font-bold text-fg">{position ? `Select ${position}` : 'Select bench player'}</h3>
          <span className="text-[13px] font-medium text-muted">{position ? 'Best matches for this position first' : 'Highest overall first'}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          title="Close"
          aria-label="Close"
          className="flex-none w-8 h-8 rounded-[10px] border border-line-2 bg-panel text-muted grid place-items-center cursor-pointer hover:text-fg"
        >
          <CloseIcon size={12} strokeWidth={2.6} />
        </button>
      </div>
      <input
        type="text"
        value={query}
        onChange={e => onQuery(e.target.value)}
        placeholder="Filter by name…"
        aria-label="Filter by name"
        className={`${fieldClass} h-[38px] px-3`}
      />
      <div className="flex flex-col gap-1.5 max-h-[60vh] min-[64rem]:max-h-[900px] overflow-y-auto" role="list">
        {candidates.map(({ player, fit }) => {
          const isCurrent = current === player.id;
          const where = isCurrent ? 'Selected' : lineup.xi.includes(player.id) ? 'Starting XI' : lineup.bench.includes(player.id) ? 'Bench' : null;
          const tier = getTierColors(fit.rating);
          return (
            <button
              key={player.id}
              type="button"
              role="listitem"
              onClick={() => onPick(player)}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-[14px] border text-left cursor-pointer transition-colors hover:border-line-hover ${
                isCurrent ? 'border-accent/50 bg-accent/6' : 'border-line bg-inset'
              }`}
            >
              <PlayerAvatar player={player} className="w-9 h-9 bg-chip" initialsClassName="text-xs text-fg-3" />
              <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                <span className="text-sm font-bold text-fg truncate">{fullName(player)}</span>
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-muted">
                  <span className="flex-none w-[7px] h-[7px] rounded-full" style={{ background: position ? FIT_COLORS[fit.kind] : 'var(--muted)' }} />
                  <span className="truncate">{position ? FIT_SHORT_LABELS[fit.kind] : player.metadata.positions.join(' / ')}</span>
                  {where && <span className="flex-none text-accent-ink">· {where}</span>}
                </span>
              </span>
              <span
                className="flex-none w-10 h-8 rounded-[10px] grid place-items-center font-display text-[15px] font-extrabold"
                style={{ background: tier.bg, color: tier.fg }}
              >
                {fit.rating}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}

function Summary({ lineup, playersById, onSelect }: LineupPanelProps) {
  const slots = FORMATIONS[lineup.formation];
  const starters = slots
    .map(([position], index) => {
      const id = lineup.xi[index];
      const player = id === null ? undefined : playersById.get(id);
      return player ? { player, fit: positionFit(player, position) } : null;
    })
    .filter((starter): starter is { player: MFLPlayer; fit: PositionFit } => !!starter);
  const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const kpis: [string, string][] = [
    ['Avg overall (XI)', starters.length ? String(Math.round(average(starters.map(s => s.player.metadata.overall)))) : '–'],
    ['Avg position fit', starters.length ? String(Math.round(average(starters.map(s => s.fit.rating)))) : '–'],
    ['Avg age', starters.length ? average(starters.map(s => s.player.metadata.age)).toFixed(1) : '–'],
    ['Natural positions', `${starters.filter(s => s.fit.kind === 'natural').length} / ${XI_SIZE}`],
  ];

  return (
    <>
      <div className="flex flex-col gap-0.5">
        <h3 className="m-0 font-display text-xl font-bold text-fg">
          {lineup.name} · {lineup.formation}
        </h3>
        <span className="text-[13px] font-medium text-muted">Click any position to see the best-matching players</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {kpis.map(([label, value]) => (
          <div key={label} className="flex flex-col gap-1 p-3 rounded-[14px] border border-line bg-inset">
            <span className="text-[11px] font-semibold text-muted">{label}</span>
            <span className="font-display text-2xl font-extrabold leading-none text-fg">{value}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-col">
        <span className="pt-1 pb-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-2">Starting XI</span>
        {slots.map(([position], index) => {
          const id = lineup.xi[index];
          const player = id === null ? undefined : playersById.get(id);
          const fit = player && positionFit(player, position);
          return (
            <button
              key={index}
              type="button"
              onClick={() => onSelect({ type: 'xi', index })}
              className="flex items-center gap-2.5 h-9 px-1 border-b border-divider text-left cursor-pointer hover:bg-row-hover"
            >
              <span className="w-10 text-[11px] font-extrabold text-muted">{position}</span>
              <span className={`flex-1 min-w-0 text-[13px] font-semibold truncate ${player ? 'text-fg' : 'text-faint'}`}>{player ? fullName(player) : 'Empty'}</span>
              {fit && (
                <>
                  <span className="flex-none w-2 h-2 rounded-full" style={{ background: FIT_COLORS[fit.kind] }} title={FIT_LABELS[fit.kind]} />
                  <span className="w-[26px] text-right font-display text-sm font-extrabold" style={{ color: getTierColors(fit.rating).text }}>
                    {fit.rating}
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3 text-[11px] font-semibold text-muted">
        {(['natural', 'alt', 'out'] as const).map(kind => (
          <span key={kind} className="flex items-center gap-[5px]">
            <span className="w-2 h-2 rounded-full" style={{ background: FIT_COLORS[kind] }} />
            {FIT_SHORT_LABELS[kind]}
          </span>
        ))}
      </div>
    </>
  );
}
