import { executeRaw } from '../lib/db-helpers';

/*
 * A club owner's notes for the AI match analysis: what they know about their club that the data doesn't show
 * (players to rest or develop, preferences, plans). Kept per club in club_notes, private to the owner.
 */

/** Longest notes kept, in characters */
export const MAX_NOTES = 2000;

export interface ClubNotes {
  notes: string;
  updatedAt: string | null;
}

/** The club's notes, empty without any or without a database */
export async function loadClubNotes(clubId: number): Promise<ClubNotes> {
  if (!process.env.TURSO_DATABASE_URL) return { notes: '', updatedAt: null };
  const { data, error } = await executeRaw('SELECT notes, updated_at FROM club_notes WHERE club_id = ?', [clubId]);
  if (error || !data?.length) return { notes: '', updatedAt: null };
  return { notes: String(data[0].notes ?? ''), updatedAt: data[0].updated_at ? String(data[0].updated_at) : null };
}

/** Keeps the club's notes, or forgets them when blank */
export async function saveClubNotes(clubId: number, notes: string, walletAddress: string): Promise<void> {
  const text = notes.trim().slice(0, MAX_NOTES);
  const { error } = text
    ? await executeRaw(
        `INSERT INTO club_notes (club_id, notes, wallet_address, updated_at) VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT (club_id) DO UPDATE SET notes = excluded.notes, wallet_address = excluded.wallet_address, updated_at = excluded.updated_at`,
        [clubId, text, walletAddress],
      )
    : await executeRaw('DELETE FROM club_notes WHERE club_id = ?', [clubId]);
  if (error) throw new Error(error.message);
}

/** A short hash of the notes, so an analysis asked with other notes isn't served from the cache */
export function notesKey(notes: string): string {
  let hash = 5381;
  for (let index = 0; index < notes.length; index++) hash = ((hash << 5) + hash + notes.charCodeAt(index)) | 0;
  return notes ? (hash >>> 0).toString(36) : '0';
}
