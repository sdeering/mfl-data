import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { MFLPlayer } from '../../types/mflApi';
import { fullName } from './shared';

const itemClass =
  'flex items-center justify-between gap-3 h-10 px-3 rounded-[10px] text-sm font-semibold text-fg-2 text-left cursor-pointer outline-none transition-colors hover:bg-chip hover:text-fg focus-visible:bg-chip focus-visible:text-fg';
// Roughly the menu's height, to open it upwards when there's no room below
const MENU_HEIGHT = 150;

/**
 * A player's links behind a small button: their page here and on mfl.com, each in a new tab, and copying
 * their ID. The menu is laid over the page, so the scrolling list it opens from never cuts it off.
 */
export default function PlayerMenu({ player, className = '' }: { player: MFLPlayer; className?: string }) {
  const [place, setPlace] = useState<React.CSSProperties | null>(null);
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle');
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const copyTimer = useRef<number | undefined>(undefined);
  const isOpen = place !== null;

  const close = (refocus = false) => {
    window.clearTimeout(copyTimer.current);
    setPlace(null);
    setCopy('idle');
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
    // It stays where it opened, so it closes rather than float away from the card when the page or list scrolls
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('scroll', shut, true);
    window.addEventListener('resize', shut);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('scroll', shut, true);
      window.removeEventListener('resize', shut);
    };
  }, [isOpen]);

  useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(String(player.id));
      setCopy('copied');
      window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => close(), 900);
    } catch {
      setCopy('failed');
    }
  };

  const name = fullName(player);
  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={e => {
          // The card underneath places the player on a click or Enter
          e.stopPropagation();
          if (isOpen) close();
          else open();
        }}
        onKeyDown={e => e.stopPropagation()}
        aria-label={`Options for ${name}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title="Player page, ID and mfl.com"
        className={`${className} flex-none w-6 h-6 -my-1 rounded-full grid place-items-center cursor-pointer transition-colors hover:bg-chip hover:text-fg ${isOpen ? 'bg-chip text-fg' : 'text-muted'}`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </button>
      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={`Options for ${name}`}
            style={place}
            // Events from here still reach the card through React, which would place the player
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
            <a role="menuitem" href={`/players/${player.id}`} target="_blank" rel="noopener noreferrer" onClick={() => close()} className={itemClass}>
              Open player page
              <span aria-hidden="true">↗</span>
            </a>
            <button role="menuitem" type="button" onClick={copyId} className={itemClass}>
              {copy === 'copied' ? 'Copied' : copy === 'failed' ? "Couldn't copy" : 'Copy player ID'}
              <span className={`font-mono text-xs ${copy === 'copied' ? 'text-accent-ink' : 'text-muted'}`}>{player.id}</span>
            </button>
            <a
              role="menuitem"
              href={`https://app.playmfl.com/players/${player.id}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => close()}
              className={itemClass}
            >
              Open on mfl.com
              <span aria-hidden="true">↗</span>
            </a>
          </div>,
          document.body,
        )}
    </>
  );
}
