import { executeRaw } from '../lib/db-helpers';
import type { MatchAnalysis, MatchAnalysisRequest } from './matchAnalysis';
import { scopeKey, type NotesScope } from './clubNotes';

/*
 * AI match analyses kept per club and match (match_analyses), so going back to a matchup shows its last analysis,
 * and asking again when nothing it read has changed gives that one back rather than a fresh Gemini call. Each is
 * kept under the fingerprint of what it read: formations, aim, notes, our tactics log and both clubs' squads and
 * latest matches. Private to the club's owner.
 */

/** How long an analysis is kept */
const KEEP_DAYS = 30;

/** The matchup an analysis was asked for, without the wallet and the planner's counters */
export type SavedRequest = Pick<MatchAnalysisRequest, 'ourClubId' | 'theirClubId' | 'ourFormation' | 'theirFormation' | 'aim' | 'matchId'>;

export interface SavedAnalysis {
  request: SavedRequest;
  analysis: MatchAnalysis;
  fingerprint: string;
  /** ISO time it was made */
  savedAt: string;
}

const toSaved = (row: any): SavedAnalysis | null => {
  try {
    return {
      request: JSON.parse(String(row.request)),
      analysis: JSON.parse(String(row.analysis)),
      fingerprint: String(row.fingerprint),
      savedAt: `${String(row.created_at).replace(' ', 'T')}Z`,
    };
  } catch {
    return null;
  }
};

/** The analysis made from exactly these inputs, if one was kept */
export async function findSavedAnalysis(clubId: number, scope: NotesScope, fingerprint: string): Promise<SavedAnalysis | null> {
  if (!process.env.TURSO_DATABASE_URL) return null;
  const { data, error } = await executeRaw(
    'SELECT request, analysis, fingerprint, created_at FROM match_analyses WHERE club_id = ? AND match_key = ? AND fingerprint = ?',
    [clubId, scopeKey(scope), fingerprint],
  );
  return error || !data?.length ? null : toSaved(data[0]);
}

/** The match's latest analysis, whatever it was made from */
export async function latestSavedAnalysis(clubId: number, scope: NotesScope): Promise<SavedAnalysis | null> {
  if (!process.env.TURSO_DATABASE_URL) return null;
  const { data, error } = await executeRaw(
    'SELECT request, analysis, fingerprint, created_at FROM match_analyses WHERE club_id = ? AND match_key = ? ORDER BY created_at DESC, rowid DESC LIMIT 1',
    [clubId, scopeKey(scope)],
  );
  return error || !data?.length ? null : toSaved(data[0]);
}

/** Keeps an analysis as the match's latest, and forgets ones older than KEEP_DAYS */
export async function saveAnalysis(clubId: number, scope: NotesScope, fingerprint: string, request: SavedRequest, analysis: MatchAnalysis): Promise<void> {
  if (!process.env.TURSO_DATABASE_URL) return;
  const { error } = await executeRaw(
    `INSERT INTO match_analyses (club_id, match_key, fingerprint, request, analysis, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT (club_id, match_key, fingerprint) DO UPDATE SET request = excluded.request, analysis = excluded.analysis, created_at = excluded.created_at`,
    [clubId, scopeKey(scope), fingerprint, JSON.stringify(request), JSON.stringify(analysis)],
  );
  if (error) throw new Error(error.message);
  await executeRaw(`DELETE FROM match_analyses WHERE created_at < datetime('now', '-${KEEP_DAYS} days')`);
}

/** A short hash of an analysis's inputs */
export function fingerprintOf(parts: (string | number | null | undefined)[]): string {
  const text = parts.map(part => String(part ?? '')).join('|');
  let hash = 5381;
  let second = 52711;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    hash = ((hash << 5) + hash + code) | 0;
    second = ((second << 5) + second + code * 31) | 0;
  }
  return `${(hash >>> 0).toString(36)}${(second >>> 0).toString(36)}`;
}
