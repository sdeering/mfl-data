import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { MFLPlayer } from '../../types/mflApi';
import { CAPTAIN_BADGE, CloseIcon, fullName } from './shared';

const itemBase =
  'flex items-center justify-between gap-3 h-10 px-3 rounded-[10px] text-sm font-semibold text-left cursor-pointer outline-none transition-colors hover:bg-chip focus-visible:bg-chip';
const itemClass = `${itemBase} text-fg-2 hover:text-fg focus-visible:text-fg`;
// Roughly the height of a menu of five items, to open it upwards when there's no room below
const MENU_HEIGHT = 240;

const Dots = ({ across = false }: { across?: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    {[5, 12, 19].map(at => (
      <circle key={at} cx={across ? at : 12} cy={across ? 12 : at} r="2" />
    ))}
  </svg>
);

/**
 * A small button opening a menu of things to do with a player. The menu is laid over the page, so the scrolling
 * list or pitch it opens from never cuts it off.
 */
function OptionsMenu({
  player,
  title,
  buttonClass,
  across,
  children,
}: {
  player: MFLPlayer;
  title: string;
  /** The button's look and place, open or not */
  buttonClass: (isOpen: boolean) => string;
  /** Dots across (⋯) rather than down (⋮) */
  across?: boolean;
  /** The items, given a way to close the menu */
  children: (close: () => void) => React.ReactNode;
}) {
  const [place, setPlace] = useState<React.CSSProperties | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const isOpen = place !== null;

  const close = (refocus = false) => {
    setPlace(null);
    if (refocus) buttonRef.current?.focus();
  };

  const open = () => {
    const button = buttonRef.current?.getBoundingClientRect();
    if (!button) return;
    const below = button.bottom + 6 + MENU_HEIGHT <= window.innerHeight;
    setPlace({ right: Math.max(8, window.innerWidth - button.right), ...(below ? { top: button.bottom + 6 } : { bottom: window.innerHeight - button.top + 6 }) });
  };

  useEffect(() => {
    if (!isOpen) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const shut = () => close();
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) shut();
    };
    // It stays where it opened, so it closes rather than float away from the player when the page or list scrolls
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('scroll', shut, true);
    window.addEventListener('resize', shut);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('scroll', shut, true);
      window.removeEventListener('resize', shut);
    };
  }, [isOpen]);

  const name = fullName(player);
  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={e => {
          // The card or position underneath acts on a click or Enter of its own
          e.stopPropagation();
          if (isOpen) close();
          else open();
        }}
        onKeyDown={e => e.stopPropagation()}
        aria-label={`Options for ${name}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title={title}
        className={buttonClass(isOpen)}
      >
        <Dots across={across} />
      </button>
      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={`Options for ${name}`}
            style={place}
            // Events from here still reach the card through React, which would act on them
            onClick={e => e.stopPropagation()}
            onKeyDown={e => {
              e.stopPropagation();
              const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
              const at = items.indexOf(document.activeElement as HTMLElement);
              if (e.key === 'Escape' || e.key === 'Tab') {
                e.preventDefault();
                close(true);
              } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                items[(at + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus();
              }
            }}
            className="fixed z-50 w-[220px] p-1.5 rounded-2xl border border-line-2 bg-panel shadow-[0_20px_50px_rgba(0,0,0,.45)] flex flex-col gap-0.5"
          >
            {children(() => close())}
          </div>,
          document.body,
        )}
    </>
  );
}

const LinkItem = ({ href, close, children }: { href: string; close: () => void; children: React.ReactNode }) => (
  <a role="menuitem" href={href} target="_blank" rel="noopener noreferrer" onClick={close} className={itemClass}>
    {children}
    <span aria-hidden="true">↗</span>
  </a>
);

function CopyIdItem({ player, close }: { player: MFLPlayer; close: () => void }) {
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(String(player.id));
      setCopy('copied');
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(close, 900);
    } catch {
      setCopy('failed');
    }
  };

  return (
    <button role="menuitem" type="button" onClick={copyId} className={itemClass}>
      {copy === 'copied' ? 'Copied' : copy === 'failed' ? "Couldn't copy" : 'Copy player ID'}
      <span className={`font-mono text-xs ${copy === 'copied' ? 'text-accent-ink' : 'text-muted'}`}>{player.id}</span>
    </button>
  );
}

/** A player's links, from the list: their page here and on mfl.com, each in a new tab, and copying their ID. */
export default function PlayerMenu({ player, className = '' }: { player: MFLPlayer; className?: string }) {
  return (
    <OptionsMenu
      player={player}
      title="Player page, ID and mfl.com"
      buttonClass={isOpen =>
        `${className} flex-none w-6 h-6 -my-1 rounded-full grid place-items-center cursor-pointer transition-colors hover:bg-chip hover:text-fg ${isOpen ? 'bg-chip text-fg' : 'text-muted'}`
      }
    >
      {close => (
        <>
          <LinkItem href={`/players/${player.id}`} close={close}>
            Open player page
          </LinkItem>
          <CopyIdItem player={player} close={close} />
          <LinkItem href={`https://app.playmfl.com/players/${player.id}`} close={close}>
            Open on mfl.com
          </LinkItem>
        </>
      )}
    </OptionsMenu>
  );
}

/**
 * A starter's options, from the pitch: the captain's armband, their page and comparing them, each in a new tab,
 * copying their ID, and taking them out of the lineup.
 */
export function PitchPlayerMenu({
  player,
  isCaptain,
  onToggleCaptain,
  onRemove,
  className = '',
}: {
  player: MFLPlayer;
  isCaptain: boolean;
  onToggleCaptain: () => void;
  onRemove: () => void;
  className?: string;
}) {
  return (
    <OptionsMenu
      player={player}
      title="Captain, player page, compare, ID and remove"
      across
      buttonClass={isOpen =>
        `${className} grid place-items-center cursor-pointer transition-colors ${isOpen ? 'bg-accent text-accent-fg' : 'bg-[#0b1406] text-white hover:bg-accent hover:text-accent-fg'}`
      }
    >
      {close => (
        <>
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              close();
              onToggleCaptain();
            }}
            className={itemClass}
          >
            {isCaptain ? 'Remove captain' : 'Make captain'}
            <span aria-hidden="true" className={`w-5 h-5 rounded-full grid place-items-center text-[10px] font-extrabold ${CAPTAIN_BADGE}`}>
              C
            </span>
          </button>
          <LinkItem href={`/players/${player.id}`} close={close}>
            Open player page
          </LinkItem>
          <LinkItem href={`/compare?playerId=${player.id}`} close={close}>
            Compare vs player
          </LinkItem>
          <CopyIdItem player={player} close={close} />
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              close();
              onRemove();
            }}
            className={`${itemBase} text-danger-ink`}
          >
            Remove from lineup
            <CloseIcon size={10} strokeWidth={3} />
          </button>
        </>
      )}
    </OptionsMenu>
  );
}
