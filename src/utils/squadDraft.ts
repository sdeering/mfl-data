import { FORMATIONS, type Lineup } from './squadLineups';

// The squad being built is kept per wallet in the browser, so a refresh or a visit later carries on from it
const draftKey = (wallet: string) => `mfl-data-squad-builder:${wallet.toLowerCase()}`;

export interface Draft {
  name: string;
  lineups: Lineup[];
  active: number;
}

export function loadDraft(wallet: string): Draft | null {
  try {
    const draft = JSON.parse(window.localStorage.getItem(draftKey(wallet)) || 'null');
    const valid =
      Array.isArray(draft?.lineups) &&
      draft.lineups.length > 0 &&
      draft.lineups.every((lineup: Lineup) => FORMATIONS[lineup.formation] && Array.isArray(lineup.xi) && Array.isArray(lineup.bench));
    if (!valid) return null;
    return { name: typeof draft.name === 'string' ? draft.name : '', lineups: draft.lineups, active: Number(draft.active) || 0 };
  } catch {
    return null;
  }
}

export function saveDraft(wallet: string, draft: Draft) {
  try {
    window.localStorage.setItem(draftKey(wallet), JSON.stringify(draft));
  } catch {
    // A convenience: without it the builder starts afresh next time
  }
}

/**
 * Adds a lineup to the squad being built and makes it the one shown, e.g. a counter worked out on the Matches
 * page, so the squad builder opens on it. It takes the next free ID; any lineups already there stay.
 */
export function addDraftLineup(wallet: string, lineup: Omit<Lineup, 'id'>) {
  const draft = loadDraft(wallet) ?? { name: '', lineups: [], active: 0 };
  const id = Math.max(0, ...draft.lineups.map(existing => existing.id ?? 0)) + 1;
  const lineups = [...draft.lineups, { ...lineup, id }];
  saveDraft(wallet, { ...draft, lineups, active: lineups.length - 1 });
}
