import React, { useState } from 'react';
import type { MFLPlayer } from '../../types/mflApi';
import type { FitKind, SlotRef } from '../../utils/squadLineups';

/** The squad builder's colour for how well a player fits a position, as dots, rings and position tags. */
export const FIT_COLORS: Record<FitKind, string> = { natural: '#8ae63a', alt: '#facc15', out: '#ef4444' };
export const FIT_LABELS: Record<FitKind, string> = { natural: 'Natural position', alt: 'Alternative position', out: 'Out of position' };
export const FIT_SHORT_LABELS: Record<FitKind, string> = { natural: 'Natural', alt: 'Alternative', out: 'Out of position' };
/** The captain's armband: in the accent, as the fit colours already use yellow */
export const CAPTAIN_BADGE = 'bg-accent text-accent-fg';

export const STAT_KEYS = ['pace', 'shooting', 'passing', 'dribbling', 'defense', 'physical'] as const;
export const STAT_LABELS = ['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY'];

export const fullName = (player: MFLPlayer) => `${player.metadata.firstName} ${player.metadata.lastName}`.trim();
export const shortName = (player: MFLPlayer) => player.metadata.lastName || player.metadata.firstName;
export const slotKey = (slot: SlotRef) => `${slot.type}-${slot.index}`;

/** Dragging players between the pool, the pitch and the bench. Each returns the handler for one element. */
export interface DragHandlers {
  start: (playerId: number) => (e: React.DragEvent) => void;
  end: () => void;
  over: (key: string) => (e: React.DragEvent) => void;
  leave: (key: string) => () => void;
  drop: (target: SlotRef) => (e: React.DragEvent) => void;
  /** The slot a player is being dragged over, e.g. "xi-3" */
  overKey: string | null;
}

/**
 * Round photo of a player, their initials until it loads (or if there is none). The photo is a head and
 * shoulders shot, so it is enlarged and lifted to frame the face.
 */
export const PlayerAvatar: React.FC<{ player: MFLPlayer; className?: string; initialsClassName?: string }> = ({
  player,
  className = '',
  initialsClassName = '',
}) => {
  const [photo, setPhoto] = useState<'loading' | 'shown' | 'missing'>('loading');
  const initials = fullName(player).split(' ').map(word => word[0]).join('').slice(0, 2);
  return (
    <span className={`relative flex-none grid place-items-center rounded-full overflow-hidden pointer-events-none ${className}`}>
      {photo !== 'shown' && <span className={`font-display font-extrabold ${initialsClassName}`}>{initials}</span>}
      {photo !== 'missing' && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`https://d13e14gtps4iwl.cloudfront.net/players/v2/${player.id}/photo.webp`}
          alt=""
          loading="lazy"
          draggable={false}
          onLoad={() => setPhoto('shown')}
          onError={() => setPhoto('missing')}
          className={`absolute left-[-55%] top-[-3%] w-[210%] h-[210%] max-w-none object-cover ${photo === 'shown' ? '' : 'invisible'}`}
        />
      )}
    </span>
  );
};

/** A rating as text in its card colour, or a dash for none (goalkeepers have no outfield attributes). */
export const RatingText: React.FC<{ value: number | null | undefined; color: string | undefined; className?: string }> = ({ value, color, className = '' }) =>
  value ? (
    <span className={`font-display font-bold tabular-nums ${className}`} style={{ color }}>
      {value}
    </span>
  ) : (
    <span className={`font-display font-bold text-faint ${className}`}>–</span>
  );

export const CloseIcon: React.FC<{ size?: number; strokeWidth?: number }> = ({ size = 11, strokeWidth = 2.8 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden="true">
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
