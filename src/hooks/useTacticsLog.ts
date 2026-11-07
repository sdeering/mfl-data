import { useCallback, useEffect, useState } from 'react';
import type { PlayerSettings, TacticSettings, TacticsHistory } from '../utils/tacticsHistory';

export interface TacticsLogState {
  history: TacticsHistory | null;
  error: string | null;
  isLoading: boolean;
  /** Keeps the settings and individual instructions for a match, or with null forgets them; throws with the reason when it can't */
  save: (matchId: number, settings: TacticSettings | null, players?: PlayerSettings) => Promise<void>;
  /** Reads the log again, e.g. once the AI's advice for a match is kept */
  refresh: () => void;
  /** The wallet saving to it, when the club owner's is connected */
  walletAddress: string | null;
}

/** Histories already loaded this visit, by club */
const loaded = new Map<number, TacticsHistory>();

/** A club's tactics log: its played matches with the settings logged for each, and saving to it as the club owner. */
export function useTacticsLog(clubId: number | null, walletAddress: string | null): TacticsLogState {
  const [history, setHistory] = useState<TacticsHistory | null>(() => (clubId ? loaded.get(clubId) ?? null : null));
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!clubId) return;
    let cancelled = false;
    setHistory(loaded.get(clubId) ?? null);
    setError(null);
    setIsLoading(true);
    fetch(`/api/clubs/${clubId}/tactics`, { headers: { Accept: 'application/json' } })
      .then(async response => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success) throw new Error(result.error || `HTTP ${response.status}`);
        return result.data as TacticsHistory;
      })
      .then(data => {
        loaded.set(clubId, data);
        if (!cancelled) setHistory(data);
      })
      .catch(err => !cancelled && setError(err instanceof Error ? err.message : 'Could not load the tactics log'))
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [clubId, reload]);

  const save = useCallback(
    async (matchId: number, settings: TacticSettings | null, players: PlayerSettings = {}) => {
      if (!clubId || !walletAddress) throw new Error('Connect the club owner’s wallet to log tactics');
      const response = await fetch(`/api/clubs/${clubId}/tactics`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, matchId, settings, players: settings ? players : {} }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) throw new Error(result.error || `HTTP ${response.status}`);
      // Shows the change at once, then reads the log again for the match's formations and xG
      setHistory(current => {
        if (!current) return current;
        const played = current.matches.some(match => match.matchId === matchId);
        const planned = { ...current.planned };
        const plannedPlayers = { ...current.plannedPlayers };
        if (!played) {
          if (settings) {
            planned[matchId] = settings;
            plannedPlayers[matchId] = players;
          } else {
            delete planned[matchId];
            delete plannedPlayers[matchId];
          }
        }
        const next = {
          matches: current.matches.map(match => (match.matchId === matchId ? { ...match, settings, players: settings ? players : null } : match)),
          planned,
          plannedPlayers,
        };
        loaded.set(clubId, next);
        return next;
      });
      if (settings && history?.matches.some(match => match.matchId === matchId && !match.settings)) setReload(count => count + 1);
    },
    [clubId, walletAddress, history],
  );

  const refresh = useCallback(() => setReload(count => count + 1), []);

  return { history, error, isLoading, save, refresh, walletAddress };
}
