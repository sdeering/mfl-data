import { useEffect, useState } from 'react';
import { scoutService, type ScoutReport } from '../services/scoutService';

export interface ScoutReportState {
  report: ScoutReport | null;
  error: string | null;
  isLoading: boolean;
}

/** A club's squad and recent matches with formations, for the formation planner. Nothing for no club. */
export function useScoutReport(clubId: number | null | undefined, limit: number): ScoutReportState {
  const [state, setState] = useState<ScoutReportState>({ report: null, error: null, isLoading: !!clubId });

  useEffect(() => {
    if (!clubId) {
      setState({ report: null, error: null, isLoading: false });
      return;
    }
    let cancelled = false;
    setState({ report: null, error: null, isLoading: true });
    scoutService.fetchReport(clubId, limit).then(
      report => !cancelled && setState({ report, error: null, isLoading: false }),
      (error: Error) => !cancelled && setState({ report: null, error: error.message, isLoading: false }),
    );
    return () => {
      cancelled = true;
    };
  }, [clubId, limit]);

  return state;
}
