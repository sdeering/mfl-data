import { useEffect, useState } from 'react';
import { ScoutBusyError, scoutService, type ScoutReport } from '../services/scoutService';

export interface ScoutReportState {
  report: ScoutReport | null;
  error: string | null;
  isLoading: boolean;
}

/** Times to wait and ask again while the site paces its requests to MFL */
const BUSY_RETRIES = 4;

/** A club's squad and recent matches with formations, for the match prep tool. Nothing for no club. */
export function useScoutReport(clubId: number | null | undefined, limit: number): ScoutReportState {
  const [state, setState] = useState<ScoutReportState>({ report: null, error: null, isLoading: !!clubId });

  useEffect(() => {
    if (!clubId) {
      setState({ report: null, error: null, isLoading: false });
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setState({ report: null, error: null, isLoading: true });
    const load = (attempt: number) =>
      scoutService.fetchReport(clubId, limit).then(
        report => !cancelled && setState({ report, error: null, isLoading: false }),
        (error: Error) => {
          if (cancelled) return;
          // Still loading: it asks again once the wait is over
          if (error instanceof ScoutBusyError && attempt < BUSY_RETRIES) timer = setTimeout(() => load(attempt + 1), error.retryAfter * 1000);
          else setState({ report: null, error: error.message, isLoading: false });
        },
      );
    load(0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [clubId, limit]);

  return state;
}
