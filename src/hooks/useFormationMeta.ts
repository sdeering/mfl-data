import { useEffect, useMemo, useState } from 'react';
import { chooseFormationMeta, type FormationMeta, type MetaSnapshot } from '../utils/formationPlanner';

type OwnMeta = MetaSnapshot & { totalGames: number };

// Asked for once a page load: the server caches it for a day anyway
let ownMeta: Promise<OwnMeta | null> | null = null;
const fetchOwnMeta = () =>
  (ownMeta ??= fetch('/api/formation-meta', { headers: { Accept: 'application/json' } })
    .then(response => response.json())
    .then(result => (result.success ? (result.data as OwnMeta | null) : null))
    .catch(() => null));

export interface FormationMetaState {
  meta: FormationMeta;
  /** Our own meta from MFL matches, whether or not it holds enough games to be used yet */
  own: { games: number; engine: string } | null;
}

/** The formation meta to plan with: ours once it has enough games, the bundled mfl-coach snapshot until then. */
export function useFormationMeta(): FormationMetaState {
  const [own, setOwn] = useState<OwnMeta | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchOwnMeta().then(data => !cancelled && setOwn(data));
    return () => {
      cancelled = true;
    };
  }, []);
  return useMemo(
    () => ({ meta: chooseFormationMeta(own), own: own ? { games: own.totalGames, engine: own.engine } : null }),
    [own],
  );
}
