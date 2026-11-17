import { executeRaw } from '../lib/db-helpers';

/*
 * A club owner's notes for the AI match analysis of one match: what they know that the data doesn't show (players to
 * rest or develop, preferences, plans). Kept per club and fixture in match_notes, or per opponent when there's no
 * fixture, so a new match starts blank. Private to the owner.
 */

/** Longest notes kept, in characters */
export const MAX_NOTES = 2000;

export interface ClubNotes {
  notes: string;
  updatedAt: string | null;
}

/** Which match the notes are for: the fixture, or the opponent when there's no fixture */
export interface NotesScope {
  matchId?: number | null;
  opponentId: number;
}

const isId = (value: unknown): value is number => Number.isInteger(value) && (value as number) > 0;

/** The scope a request names, or null when it names neither a fixture nor an opponent */
export function scopeOf(matchId: unknown, opponentId: unknown): NotesScope | null {
  const match = typeof matchId === 'string' && /^\d+$/.test(matchId) ? Number(matchId) : matchId;
  const opponent = typeof opponentId === 'string' && /^\d+$/.test(opponentId) ? Number(opponentId) : opponentId;
  if (!isId(opponent)) return null;
  return { matchId: isId(match) ? match : null, opponentId: opponent };
}

/** The row key: the fixture when there is one, else the opponent */
export const scopeKey = (scope: NotesScope) => (scope.matchId ? `match:${scope.matchId}` : `vs:${scope.opponentId}`);

/** The match's notes, empty without any or without a database */
export async function loadClubNotes(clubId: number, scope: NotesScope): Promise<ClubNotes> {
  if (!process.env.TURSO_DATABASE_URL) return { notes: '', updatedAt: null };
  const { data, error } = await executeRaw('SELECT notes, updated_at FROM match_notes WHERE club_id = ? AND match_key = ?', [clubId, scopeKey(scope)]);
  if (error || !data?.length) return { notes: '', updatedAt: null };
  return { notes: String(data[0].notes ?? ''), updatedAt: data[0].updated_at ? String(data[0].updated_at) : null };
}

/** Keeps the match's notes, or forgets them when blank */
export async function saveClubNotes(clubId: number, scope: NotesScope, notes: string, walletAddress: string): Promise<void> {
  const text = notes.trim().slice(0, MAX_NOTES);
  const key = scopeKey(scope);
  const { error } = text
    ? await executeRaw(
        `INSERT INTO match_notes (club_id, match_key, notes, wallet_address, updated_at) VALUES (?, ?, ?, ?, datetime('now'))
         ON CONFLICT (club_id, match_key) DO UPDATE SET notes = excluded.notes, wallet_address = excluded.wallet_address, updated_at = excluded.updated_at`,
        [clubId, key, text, walletAddress],
      )
    : await executeRaw('DELETE FROM match_notes WHERE club_id = ? AND match_key = ?', [clubId, key]);
  if (error) throw new Error(error.message);
}

/** A short hash of the notes, so an analysis asked with other notes isn't served from the cache */
export function notesKey(notes: string): string {
  let hash = 5381;
  for (let index = 0; index < notes.length; index++) hash = ((hash << 5) + hash + notes.charCodeAt(index)) | 0;
  return notes ? (hash >>> 0).toString(36) : '0';
}
