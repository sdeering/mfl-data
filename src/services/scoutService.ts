import type { MFLPlayer } from '../types/mflApi';
import type { PlayedMatch } from '../utils/formationPlanner';

/** A club's recent competitive match, from its own side. */
export interface ScoutMatch extends PlayedMatch {
  id: number;
  startDate: number;
  competition: string;
  opponent: { clubId: number; name: string; logoVersion?: string };
}

/** What the formation planner needs to know about a club: its squad, and its recent matches with formations. */
export interface ScoutReport {
  club: {
    id: number;
    name: string;
    /** False for a club no one has founded yet, with no squad or matches */
    founded?: boolean;
    division: number | null;
    logoVersion?: string;
    city?: string;
    country?: string;
  };
  /** The league season the club plays next or is playing, such as "Season 18", when MFL has one */
  season: string | null;
  players: MFLPlayer[];
  /** Newest first */
  matches: ScoutMatch[];
  /** Average rating of the starting XIs it fielded in those matches, when known: its strength even without a squad now */
  recentOvr: number | null;
}

/** Most recent matches a report covers */
export const MAX_SCOUT_MATCHES = 15;

/** Club ID from "1234" or a link to the club, such as https://app.playmfl.com/clubs/1234. */
export function parseClubId(input: string): number | null {
  const text = input.trim();
  const id = /^\d+$/.test(text) ? text : text.match(/clubs\/(\d+)/)?.[1];
  return id ? Number(id) : null;
}

/** The site is pacing its requests to MFL: try again after `retryAfter` seconds. */
export class ScoutBusyError extends Error {
  constructor(message: string, public retryAfter: number) {
    super(message);
  }
}

class ScoutService {
  private cache = new Map<string, { data: Promise<ScoutReport>; timestamp: number }>();
  private readonly CACHE_DURATION = 60 * 60 * 1000; // 1 hour

  /** A club's report from /api/clubs/[clubId]/scout, kept for an hour. Asking twice at once shares one request. */
  fetchReport(clubId: number, limit = 10): Promise<ScoutReport> {
    const key = `${clubId}_${limit}`;
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) return cached.data;

    const data = fetch(`/api/clubs/${clubId}/scout?limit=${limit}`, { headers: { Accept: 'application/json' } }).then(async response => {
      const result = await response.json().catch(() => ({}));
      if (response.status === 429) throw new ScoutBusyError(result.error || 'Busy', Number(response.headers.get('retry-after')) || 10);
      if (!response.ok || !result.success) throw new Error(result.error || `HTTP ${response.status}`);
      return result.data as ScoutReport;
    });
    this.cache.set(key, { data, timestamp: Date.now() });
    data.catch(() => this.cache.delete(key));
    return data;
  }
}

export const scoutService = new ScoutService();
