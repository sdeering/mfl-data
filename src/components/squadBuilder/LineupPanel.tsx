import React, { useMemo } from 'react';
import type { MFLPlayer } from '../../types/mflApi';
import { FORMATIONS, Lineup, PositionFit, SlotRef, XI_SIZE, formationLabel, positionFit } from '../../utils/squadLineups';
import { getTierColors } from '../../utils/tierColors';
import { Panel, SearchField } from '../ui';
import { CAPTAIN_BADGE, CloseIcon, FIT_COLORS, FIT_LABELS, FIT_SHORT_LABELS, PlayerAvatar, fullName } from './shared';

interface LineupPanelProps {
  lineup: Lineup;
  players: MFLPlayer[];
  playersById: Map<number, MFLPlayer>;
  selected: SlotRef | null;
  onSelect: (slot: SlotRef) => void;
  /** Gives a starter the captain's armband, or takes it back */
  onToggleCaptain: (playerId: number) => void;
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

function Picker({ lineup, players, playersById, selected, onToggleCaptain, onClose, onPick, query, onQuery }: LineupPanelProps & { selected: SlotRef }) {
  const position = selected.type === 'xi' ? FORMATIONS[lineup.formation][selected.index][0] : null;
  const current = lineup[selected.type][selected.index];
  // Only a starter can be captain
  const starter = position && current !== null ? playersById.get(current) : undefined;
  const isCaptain = !!starter && starter.id === lineup.captain;

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
          <h3 className="m-0 font-display text-xl font-bold text-fg">
            {position ? `Select ${position}` : selected.type === 'bench' ? 'Select bench player' : 'Select reserve'}
          </h3>
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
      {starter && (
        <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-[14px] border border-line bg-inset">
          <PlayerAvatar player={starter} className="w-9 h-9 bg-chip" initialsClassName="text-xs text-fg-3" />
          <span className="flex-1 min-w-0 flex flex-col gap-0.5">
            <span className="text-sm font-bold text-fg truncate">{fullName(starter)}</span>
            <span className="text-[11px] font-semibold text-muted">{isCaptain ? 'Captain of this lineup' : `Playing ${position} now`}</span>
          </span>
          <button
            type="button"
            onClick={() => onToggleCaptain(starter.id)}
            aria-pressed={isCaptain}
            title={isCaptain ? 'Press again to take the armband off' : `Make ${fullName(starter)} captain`}
            className={`flex-none flex items-center gap-1.5 h-8 pl-1.5 pr-3 rounded-[10px] text-xs font-bold cursor-pointer transition-colors ${
              isCaptain ? CAPTAIN_BADGE : 'border border-accent/60 bg-accent/15 text-accent-ink hover:bg-accent hover:text-accent-fg'
            }`}
          >
            <span
              aria-hidden="true"
              className={`w-5 h-5 rounded-full grid place-items-center text-[10px] font-extrabold ${isCaptain ? 'bg-accent-fg text-accent' : CAPTAIN_BADGE}`}
            >
              C
            </span>
            {isCaptain ? 'Captain' : 'Make captain'}
          </button>
        </div>
      )}
      <SearchField
        value={query}
        onChange={e => onQuery(e.target.value)}
        onClear={() => onQuery('')}
        placeholder="Filter by name…"
        aria-label="Filter by name"
        wrapperClassName="w-full"
      />
      <div className="flex flex-col gap-1.5 max-h-[60vh] min-[64rem]:max-h-[900px] overflow-y-auto" role="list">
        {candidates.map(({ player, fit }) => {
          const isCurrent = current === player.id;
          const where = isCurrent
            ? 'Selected'
            : lineup.xi.includes(player.id)
              ? 'Starting XI'
              : lineup.bench.includes(player.id)
                ? 'Bench'
                : lineup.reserves.includes(player.id)
                  ? 'Reserves'
                  : null;
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

function Summary({ lineup, playersById, onSelect, onToggleCaptain }: LineupPanelProps) {
  const slots = FORMATIONS[lineup.formation];
  const starters = slots
    .map(([position], index) => {
      const id = lineup.xi[index];
      const player = id === null ? undefined : playersById.get(id);
      return player ? { player, fit: positionFit(player, position) } : null;
    })
    .filter((starter): starter is { player: MFLPlayer; fit: PositionFit } => !!starter);
  const captain = lineup.captain === null ? undefined : playersById.get(lineup.captain);
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
          {lineup.name} · {formationLabel(lineup.formation)}
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
        <div className="flex items-baseline justify-between gap-3 pt-1 pb-1.5">
          <span className="flex-none text-[11px] font-bold uppercase tracking-[0.1em] text-muted-2">Starting XI</span>
          <span className="min-w-0 text-[11px] font-semibold text-muted truncate">
            {captain ? (
              <>
                Captain: <span className="text-fg-2">{fullName(captain)}</span>
              </>
            ) : (
              'No captain yet. Click a player to pick one'
            )}
          </span>
        </div>
        {slots.map(([position], index) => {
          const id = lineup.xi[index];
          const player = id === null ? undefined : playersById.get(id);
          const fit = player && positionFit(player, position);
          const isCaptain = !!player && player.id === lineup.captain;
          return (
            <div key={index} className="flex items-center gap-1.5 border-b border-divider">
              <button
                type="button"
                onClick={() => onSelect({ type: 'xi', index })}
                className="flex-1 min-w-0 flex items-center gap-2.5 h-9 px-1 text-left cursor-pointer hover:bg-row-hover"
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
              {player ? (
                <button
                  type="button"
                  onClick={() => onToggleCaptain(player.id)}
                  aria-pressed={isCaptain}
                  aria-label={`Captain: ${fullName(player)}`}
                  title={isCaptain ? 'Captain. Press again to take the armband off' : 'Make captain'}
                  className={`flex-none w-6 h-6 rounded-md grid place-items-center text-[11px] font-extrabold cursor-pointer transition-colors ${
                    isCaptain ? CAPTAIN_BADGE : 'border border-line-2 text-faint hover:text-fg hover:border-line-hover'
                  }`}
                >
                  C
                </button>
              ) : (
                <span className="flex-none w-6" />
              )}
            </div>
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
