import React, { useEffect, useRef, useState } from 'react';
import type { SavedSquad } from '../../services/squadService';
import { formationLabel, fromSavedSquad, lineupPlayerIds } from '../../utils/squadLineups';
import { btnDanger, btnPill, btnPrimary, fieldClass } from '../ui';

const backdropClass = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60';
const modalClass = 'w-full p-5 md:p-6 rounded-2xl border border-line-2 bg-panel shadow-[0_20px_50px_rgba(0,0,0,.45)]';
const spinnerClass = 'rounded-full border-2 border-accent border-t-transparent animate-spin';

interface SaveSquadModalProps {
  name: string;
  onName: (name: string) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
}

export function SaveSquadModal({ name, onName, onSave, onCancel, isSaving }: SaveSquadModalProps) {
  return (
    <div className={backdropClass}>
      <form
        className={`${modalClass} max-w-md`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-squad-title"
        onSubmit={e => {
          e.preventDefault();
          if (name.trim()) onSave();
        }}
      >
        <h3 id="save-squad-title" className="m-0 mb-1.5 font-display text-xl font-bold text-fg">
          Name Your Squad
        </h3>
        <p className="m-0 mb-4 text-sm text-muted">Enter a name for your new squad. All of its lineups are saved together.</p>
        <input
          type="text"
          value={name}
          onChange={e => onName(e.target.value)}
          placeholder="e.g. DogeSports Japan"
          aria-label="Squad name"
          autoFocus
          className={`${fieldClass} w-full mb-5`}
        />
        <div className="flex justify-end gap-2">
          <button type="button" className={btnPill} onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className={btnPrimary} disabled={isSaving || !name.trim()}>
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}

interface LoadSquadModalProps {
  squads: SavedSquad[];
  isLoading: boolean;
  deletingId: string | null;
  onLoad: (squad: SavedSquad) => void;
  onDelete: (squad: SavedSquad) => void;
  /** Resolves to whether the squad took the new name */
  onRename: (squad: SavedSquad, name: string) => Promise<boolean>;
  /** The squads in their new order */
  onReorder: (squads: SavedSquad[]) => void;
  onClose: () => void;
}

const move = <T,>(items: T[], from: number, to: number): T[] => {
  const next = [...items];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
};

const GripIcon = () => (
  <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor" aria-hidden="true">
    {[2, 8, 14].flatMap(y => [3, 9].map(x => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" />))}
  </svg>
);

export function LoadSquadModal({ squads, isLoading, deletingId, onLoad, onDelete, onRename, onReorder, onClose }: LoadSquadModalProps) {
  // While a squad is dragged the list shows where it would go, and the new order is kept when it is let go
  const [dragging, setDragging] = useState<{ id: string; order: SavedSquad[] } | null>(null);
  const drag = useRef(dragging);
  const [renaming, setRenaming] = useState<{ id: string; name: string; isSaving: boolean } | null>(null);
  const rows = useRef(new Map<string, HTMLElement>());
  const grips = useRef(new Map<string, HTMLButtonElement>());
  const shown = dragging?.order ?? squads;

  const setDrag = (next: typeof dragging) => {
    drag.current = next;
    setDragging(next);
  };

  const dragTo = (y: number) => {
    const current = drag.current;
    if (!current) return;
    const middle = (index: number) => {
      const box = rows.current.get(current.order[index].id)?.getBoundingClientRect();
      return box ? box.top + box.height / 2 : 0;
    };
    // Past the middle of a neighbour, the squad takes its place
    const from = current.order.findIndex(squad => squad.id === current.id);
    let to = from;
    while (to > 0 && y < middle(to - 1)) to--;
    while (to < current.order.length - 1 && y > middle(to + 1)) to++;
    if (to !== from) setDrag({ ...current, order: move(current.order, from, to) });
  };

  // Followed on the whole window: moving the row moves its handle in the page, which loses a pointer capture on it
  const draggingId = dragging?.id;
  useEffect(() => {
    if (!draggingId) return;
    const onMove = (event: PointerEvent) => dragTo(event.clientY);
    const onUp = () => {
      const order = drag.current?.order;
      setDrag(null);
      if (order?.some((squad, index) => squad.id !== squads[index]?.id)) onReorder(order);
    };
    const onCancel = () => setDrag(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggingId]);

  // The arrow keys move a squad one place, for anyone not dragging
  const nudge = (squad: SavedSquad, by: -1 | 1) => {
    const from = squads.findIndex(s => s.id === squad.id);
    const to = from + by;
    if (from === -1 || to < 0 || to >= squads.length) return;
    onReorder(move(squads, from, to));
    // Moving the row can take the focus off its handle
    requestAnimationFrame(() => grips.current.get(squad.id)?.focus());
  };

  const rename = async (squad: SavedSquad) => {
    if (!renaming?.name.trim()) return;
    setRenaming({ ...renaming, isSaving: true });
    const renamed = await onRename(squad, renaming.name);
    setRenaming(renamed ? null : { ...renaming, isSaving: false });
  };

  return (
    <div className={backdropClass}>
      <div className={`${modalClass} max-w-2xl max-h-[80vh] overflow-hidden`} role="dialog" aria-modal="true" aria-labelledby="load-squad-title">
        <h3 id="load-squad-title" className="m-0 mb-1 font-display text-xl font-bold text-fg">
          Load Saved Squad
        </h3>
        <p className="m-0 mb-4 text-sm text-muted">Drag a squad by its handle to change the order.</p>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm font-medium text-muted">
            <div className={`w-6 h-6 ${spinnerClass}`}></div>
            <span>Loading squads...</span>
          </div>
        ) : squads.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 py-8 text-center">
            <p className="m-0 text-sm font-medium text-muted">No saved squads found.</p>
            <p className="m-0 text-sm text-muted-3">Create and save a squad to see it here.</p>
          </div>
        ) : (
          <ul className={`m-0 p-0 list-none flex flex-col gap-2.5 max-h-96 overflow-y-auto ${dragging ? 'select-none' : ''}`} aria-label="Saved squads">
            {shown.map(squad => {
              const { lineups } = fromSavedSquad(squad);
              const playerCount = new Set(lineups.flatMap(lineupPlayerIds)).size;
              const isDragged = dragging?.id === squad.id;
              const isRenaming = renaming?.id === squad.id;
              return (
                <li
                  key={squad.id}
                  ref={el => {
                    if (el) rows.current.set(squad.id, el);
                    else rows.current.delete(squad.id);
                  }}
                  className={`flex items-center gap-2 p-4 pl-2.5 rounded-2xl border transition-colors ${
                    isDragged ? 'border-accent bg-accent/6 shadow-[0_10px_30px_rgba(0,0,0,.35)]' : 'border-line bg-inset hover:border-line-hover'
                  }`}
                >
                  <button
                    type="button"
                    ref={el => {
                      if (el) grips.current.set(squad.id, el);
                      else grips.current.delete(squad.id);
                    }}
                    aria-label={`Move ${squad.squad_name}`}
                    title="Drag to change the order, or use the arrow keys"
                    onPointerDown={e => {
                      if (e.button !== 0) return;
                      // No text selection, and no scrolling on a touch screen, while dragging
                      e.preventDefault();
                      setDrag({ id: squad.id, order: squads });
                    }}
                    onKeyDown={e => {
                      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
                      e.preventDefault();
                      nudge(squad, e.key === 'ArrowUp' ? -1 : 1);
                    }}
                    className={`flex-none self-stretch w-7 rounded-lg grid place-items-center touch-none transition-colors hover:bg-chip hover:text-fg ${
                      isDragged ? 'cursor-grabbing text-accent-ink' : 'cursor-grab text-muted'
                    }`}
                  >
                    <GripIcon />
                  </button>
                  <div className="flex-1 min-w-0">
                    {isRenaming ? (
                      <form
                        className="flex items-center gap-2"
                        onSubmit={e => {
                          e.preventDefault();
                          rename(squad);
                        }}
                      >
                        <input
                          type="text"
                          value={renaming.name}
                          onChange={e => setRenaming({ ...renaming, name: e.target.value })}
                          onKeyDown={e => {
                            if (e.key === 'Escape') {
                              e.stopPropagation();
                              setRenaming(null);
                            }
                          }}
                          aria-label={`New name for ${squad.squad_name}`}
                          autoFocus
                          className={`${fieldClass} flex-1 min-w-0 h-9`}
                        />
                        <button type="submit" className={`${btnPrimary} h-9`} disabled={renaming.isSaving || !renaming.name.trim()}>
                          {renaming.isSaving ? 'Saving…' : 'Save'}
                        </button>
                        <button type="button" className={`${btnPill} h-9`} onClick={() => setRenaming(null)}>
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <h4 className="m-0 text-[15px] font-bold text-fg truncate">{squad.squad_name}</h4>
                    )}
                    <div className="flex flex-wrap items-center gap-x-4 mt-1 text-xs font-medium text-muted">
                      <span>
                        {lineups.length === 1 ? formationLabel(lineups[0].formation) : `${lineups.length} lineups`} · {playerCount} players
                      </span>
                      <span>Updated {new Date(squad.updated_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  {!isRenaming && (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button type="button" onClick={() => onLoad(squad)} className={btnPrimary}>
                        Load
                      </button>
                      <button
                        type="button"
                        onClick={() => setRenaming({ id: squad.id, name: squad.squad_name, isSaving: false })}
                        aria-label={`Rename ${squad.squad_name}`}
                        className={btnPill}
                      >
                        Rename
                      </button>
                      <button type="button" onClick={() => onDelete(squad)} disabled={deletingId === squad.id} className={btnDanger}>
                        {deletingId === squad.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex justify-end mt-6">
          <button type="button" onClick={onClose} className={btnPill}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
