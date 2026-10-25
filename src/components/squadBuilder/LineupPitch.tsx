import React from 'react';
import type { MFLPlayer } from '../../types/mflApi';
import { FORMATIONS, Lineup, SQUAD_SIZE, SlotRef, lineupPlayerIds, positionFit } from '../../utils/squadLineups';
import { getTierColors } from '../../utils/tierColors';
import { Panel } from '../ui';
import { PitchPlayerMenu } from './PlayerMenu';
import { CAPTAIN_BADGE, CloseIcon, DragHandlers, FIT_COLORS, PlayerAvatar, fullName, shortName, slotKey } from './shared';

interface LineupPitchProps {
  lineup: Lineup;
  playersById: Map<number, MFLPlayer>;
  selected: SlotRef | null;
  onSelect: (slot: SlotRef) => void;
  onRemove: (playerId: number) => void;
  /** Gives a starter the captain's armband, or takes it back */
  onToggleCaptain: (playerId: number) => void;
  drag: DragHandlers;
}

const pitchLine = 'absolute border-2 border-white/55';

/** The lineup's starting XI on a pitch, each position taking a dropped player or a click to pick one. */
export function LineupPitch({ lineup, playersById, selected, onSelect, onRemove, onToggleCaptain, drag }: LineupPitchProps) {
  return (
    <section aria-label="Pitch" className="w-full max-w-[700px] mx-auto">
      <div
        className="@container relative w-full aspect-[5/6] rounded-3xl overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,.35)]"
        style={{ background: 'repeating-linear-gradient(180deg,#11482c 0 8.333%,#145233 8.333% 16.666%)' }}
      >
        <div className={`${pitchLine} inset-[4%] rounded`} />
        <div className="absolute left-[4%] right-[4%] top-1/2 h-0.5 bg-white/55" />
        <div className={`${pitchLine} left-1/2 top-1/2 w-[24%] aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full`} />
        <div className="absolute left-1/2 top-1/2 w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/55" />
        <div className={`${pitchLine} left-[22%] right-[22%] top-[4%] h-[15%] border-t-0`} />
        <div className={`${pitchLine} left-[37%] right-[37%] top-[4%] h-[6%] border-t-0`} />
        <div className={`${pitchLine} left-[22%] right-[22%] bottom-[4%] h-[15%] border-b-0`} />
        <div className={`${pitchLine} left-[37%] right-[37%] bottom-[4%] h-[6%] border-b-0`} />
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_50%_40%,rgba(255,255,255,.06),rgba(0,0,0,.22)_80%)]" />

        {FORMATIONS[lineup.formation].map(([position, x, y], index) => {
          const slot: SlotRef = { type: 'xi', index };
          const key = slotKey(slot);
          const playerId = lineup.xi[index];
          const player = playerId === null ? undefined : playersById.get(playerId);
          const isSelected = selected?.type === 'xi' && selected.index === index;
          const isOver = drag.overKey === key;
          return (
            <div
              key={key}
              onDragOver={drag.over(key)}
              onDragLeave={drag.leave(key)}
              onDrop={drag.drop(slot)}
              // 15% bigger once the pitch is wide enough to have room for it
              className="absolute z-[2] -translate-x-1/2 -translate-y-1/2 @min-[600px]:scale-[1.15] w-[72px] sm:w-24 flex flex-col items-center gap-[5px]"
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              {player ? (
                <FilledPosition
                  player={player}
                  position={position}
                  isCaptain={player.id === lineup.captain}
                  isSelected={isSelected}
                  outline={isSelected ? '#c6f432' : isOver ? '#ffffff' : 'transparent'}
                  onSelect={() => onSelect(slot)}
                  onRemove={() => onRemove(player.id)}
                  onToggleCaptain={() => onToggleCaptain(player.id)}
                  drag={drag}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => onSelect(slot)}
                  aria-label={`Pick a player for ${position}`}
                  aria-pressed={isSelected}
                  className="w-11 h-11 sm:w-[60px] sm:h-[60px] rounded-full border-2 border-dashed flex flex-col items-center justify-center leading-[1.1] text-white text-[11px] sm:text-[13px] font-extrabold cursor-pointer"
                  style={{
                    borderColor: isSelected ? '#c6f432' : isOver ? '#ffffff' : 'rgba(255,255,255,.6)',
                    background: isSelected || isOver ? 'rgba(198,244,50,.22)' : 'rgba(8,12,10,.35)',
                  }}
                >
                  {position}
                  <span className="text-base leading-none opacity-80" aria-hidden="true">
                    +
                  </span>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

const FilledPosition: React.FC<{
  player: MFLPlayer;
  position: Parameters<typeof positionFit>[1];
  isCaptain: boolean;
  isSelected: boolean;
  outline: string;
  onSelect: () => void;
  onRemove: () => void;
  onToggleCaptain: () => void;
  drag: DragHandlers;
}> = ({ player, position, isCaptain, isSelected, outline, onSelect, onRemove, onToggleCaptain, drag }) => {
  const fit = positionFit(player, position);
  const tier = getTierColors(fit.rating);
  const captainSpot = 'absolute -right-1.5 -bottom-1 w-5 h-5 rounded-full grid place-items-center text-[10px] font-extrabold ring-2 ring-[#0b1406] shadow-[0_2px_6px_rgba(0,0,0,.4)]';
  return (
    <>
      <div
        role="button"
        tabIndex={0}
        draggable
        onDragStart={drag.start(player.id)}
        onDragEnd={drag.end}
        onClick={onSelect}
        onKeyDown={e => {
          // Keys pressed on the buttons inside are theirs
          if (e.target !== e.currentTarget) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect();
          }
        }}
        aria-label={`${position}: ${player.metadata.firstName} ${player.metadata.lastName}, ${fit.rating}${isCaptain ? ', captain' : ''}`}
        className="relative w-11 h-11 sm:w-[60px] sm:h-[60px] rounded-full p-[3px] box-border shadow-[0_8px_20px_rgba(0,0,0,.45)] cursor-grab outline-[3px] outline-offset-[3px]"
        style={{ background: FIT_COLORS[fit.kind], outlineStyle: 'solid', outlineColor: outline }}
      >
        <PlayerAvatar player={player} className="w-full h-full bg-[#1a2620]" initialsClassName="text-sm sm:text-lg text-[#c4d0c8]" />
        <span
          className="absolute -left-2 -top-1.5 min-w-[26px] h-[22px] px-1 box-border rounded-lg grid place-items-center font-display text-xs font-extrabold shadow-[0_2px_6px_rgba(0,0,0,.4)]"
          style={{ background: tier.bg, color: tier.fg }}
        >
          {fit.rating}
        </span>
        <PitchPlayerMenu player={player} onRemove={onRemove} className="absolute -right-1.5 -top-1.5 w-5 h-5 rounded-full shadow-[0_2px_6px_rgba(0,0,0,.4)]" />
        {/* Picking a player offers them the armband, in the corner where it shows once they have it */}
        {isSelected ? (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              onToggleCaptain();
            }}
            aria-pressed={isCaptain}
            aria-label={`Make ${fullName(player)} captain`}
            title={isCaptain ? 'Captain. Press again to take the armband off' : 'Make captain'}
            className={`${captainSpot} cursor-pointer ${isCaptain ? CAPTAIN_BADGE : 'bg-white text-[#0b1406] hover:bg-accent'}`}
          >
            C
          </button>
        ) : (
          isCaptain && (
            <span title="Captain" aria-hidden="true" className={`${captainSpot} ${CAPTAIN_BADGE}`}>
              C
            </span>
          )
        )}
      </div>
      {/* Wider than its spot on the pitch when the name needs it, so "Silvestre CDM" fits */}
      <div className="flex items-center gap-[5px] max-w-full sm:w-max sm:max-w-[8.5rem] py-[3px] px-2 sm:pr-1 rounded-full bg-[rgba(8,12,10,.82)] backdrop-blur-md">
        <span className="text-[11px] sm:text-xs font-bold text-white truncate">{shortName(player)}</span>
        {/* On a phone the name needs the room; the ring's colour still shows the fit */}
        <span
          className="hidden sm:block flex-none min-w-[22px] px-1 py-px box-border rounded-full text-[10px] font-extrabold text-center text-[#0b1406]"
          style={{ background: FIT_COLORS[fit.kind] }}
        >
          {position}
        </span>
      </div>
    </>
  );
};

interface LineupBenchProps {
  lineup: Lineup;
  playersById: Map<number, MFLPlayer>;
  selected: SlotRef | null;
  onSelect: (slot: SlotRef) => void;
  onRemove: (playerId: number) => void;
  drag: DragHandlers;
}

/** Under the pitch: the seven substitutes, and the reserves who make the squad up to 23 but sit out the matchday squad. */
export function LineupBench(props: LineupBenchProps) {
  const { lineup } = props;
  return (
    <Panel className="flex flex-col gap-3 px-4 py-3.5">
      <Seats {...props} type="bench" title="Bench" seat="Sub" />
      <div className="h-px bg-divider" />
      <Seats
        {...props}
        type="reserves"
        title="Reserves"
        note={`Out of the matchday squad · squad ${lineupPlayerIds(lineup).length} / ${SQUAD_SIZE}`}
        seat="Reserve"
      />
    </Panel>
  );
}

const Seats: React.FC<LineupBenchProps & { type: 'bench' | 'reserves'; title: string; note?: string; seat: string }> = ({
  lineup,
  playersById,
  selected,
  onSelect,
  onRemove,
  drag,
  type,
  title,
  note,
  seat,
}) => {
  const ids = lineup[type];
  return (
    <section className="flex flex-col gap-3" aria-label={title}>
      <div className="flex items-baseline justify-between gap-2.5">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 min-w-0">
          <h3 className="m-0 font-display text-lg font-bold text-fg">{title}</h3>
          {note && <span className="text-xs font-medium text-muted">{note}</span>}
        </div>
        <span className="flex-none text-xs font-medium text-muted">
          {ids.filter(id => id !== null).length} / {ids.length}
        </span>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(86px,1fr))] gap-2">
        {ids.map((playerId, index) => {
          const slot: SlotRef = { type, index };
          const key = slotKey(slot);
          const player = playerId === null ? undefined : playersById.get(playerId);
          const isSelected = selected?.type === type && selected.index === index;
          const isOver = drag.overKey === key;
          const label = `${seat} ${index + 1}`;
          return (
            <div
              key={key}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(slot)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(slot);
                }
              }}
              onDragOver={drag.over(key)}
              onDragLeave={drag.leave(key)}
              onDrop={drag.drop(slot)}
              aria-label={player ? `${label}: ${player.metadata.firstName} ${player.metadata.lastName}` : `Pick a player for ${label.toLowerCase()}`}
              className={`relative flex flex-col items-center gap-1.5 min-h-24 px-1.5 py-2.5 box-border rounded-[14px] border cursor-pointer ${player ? 'border-solid' : 'border-dashed'} ${
                isSelected ? 'border-accent bg-accent/8' : isOver ? 'border-fg bg-accent/8' : 'border-line bg-inset'
              }`}
            >
              {player ? (
                <>
                  <span draggable onDragStart={drag.start(player.id)} onDragEnd={drag.end} className="cursor-grab">
                    <PlayerAvatar player={player} className="w-[46px] h-[46px] bg-chip" initialsClassName="text-[15px] text-fg-3" />
                  </span>
                  <span className="max-w-full text-xs font-bold text-fg truncate">{shortName(player)}</span>
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-muted">
                    {player.metadata.positions[0]}
                    <b style={{ color: getTierColors(player.metadata.overall).text }}>{player.metadata.overall}</b>
                  </span>
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      onRemove(player.id);
                    }}
                    title="Remove"
                    aria-label={`Remove ${player.metadata.firstName} ${player.metadata.lastName}`}
                    className="absolute right-1 top-1 w-5 h-5 rounded-full grid place-items-center text-muted cursor-pointer hover:text-fg"
                  >
                    <CloseIcon size={9} strokeWidth={3} />
                  </button>
                </>
              ) : (
                <>
                  <span className="w-[46px] h-[46px] rounded-full border-2 border-dashed border-line-2 grid place-items-center text-lg font-bold text-muted" aria-hidden="true">
                    +
                  </span>
                  <span className="text-xs font-semibold text-muted">{label}</span>
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
