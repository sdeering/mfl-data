import React from 'react';
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
  onClose: () => void;
}

export function LoadSquadModal({ squads, isLoading, deletingId, onLoad, onDelete, onClose }: LoadSquadModalProps) {
  return (
    <div className={backdropClass}>
      <div className={`${modalClass} max-w-2xl max-h-[80vh] overflow-hidden`} role="dialog" aria-modal="true" aria-labelledby="load-squad-title">
        <h3 id="load-squad-title" className="m-0 mb-4 font-display text-xl font-bold text-fg">
          Load Saved Squad
        </h3>

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
          <div className="flex flex-col gap-2.5 max-h-96 overflow-y-auto">
            {squads.map(squad => {
              const { lineups } = fromSavedSquad(squad);
              const playerCount = new Set(lineups.flatMap(lineupPlayerIds)).size;
              return (
                <div key={squad.id} className="flex items-center justify-between gap-3 p-4 rounded-2xl border border-line bg-inset transition-colors hover:border-line-hover">
                  <div className="flex-1 min-w-0">
                    <h4 className="m-0 text-[15px] font-bold text-fg truncate">{squad.squad_name}</h4>
                    <div className="flex flex-wrap items-center gap-x-4 mt-1 text-xs font-medium text-muted">
                      <span>
                        {lineups.length === 1 ? formationLabel(lineups[0].formation) : `${lineups.length} lineups`} · {playerCount} players
                      </span>
                      <span>Updated {new Date(squad.updated_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button type="button" onClick={() => onLoad(squad)} className={btnPrimary}>
                      Load
                    </button>
                    <button type="button" onClick={() => onDelete(squad)} disabled={deletingId === squad.id} className={btnDanger}>
                      {deletingId === squad.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
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
