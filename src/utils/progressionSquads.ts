import type { MFLPlayer } from '../types/mflApi';

// Squad filter values: a club ID, or one of these
export const ALL_SQUADS = 'all';
export const NO_SQUAD = 'none';

const MIN_SQUAD_SIZE = 11; // Below this a club is a loan destination rather than a squad worth defaulting to

export interface Squad {
  id: string; // Club ID
  name: string;
  playerCount: number;
  averageAge: number;
  isOwned: boolean; // Owned by this wallet, rather than a club one of its players is contracted to
}

export const getSquadId = (player: MFLPlayer): string | null => {
  const clubId = player.activeContract?.club?.id;
  return clubId === undefined || clubId === null ? null : String(clubId);
};

export const getSquadName = (player: MFLPlayer): string | null => player.activeContract?.club?.name ?? null;

export const isInSquad = (player: MFLPlayer, squadFilter: string) =>
  squadFilter === ALL_SQUADS || (squadFilter === NO_SQUAD ? getSquadId(player) === null : getSquadId(player) === squadFilter);

/** The clubs a wallet's players are contracted to, biggest first. */
export function buildSquads(players: MFLPlayer[], ownedClubIds: Set<string>): Squad[] {
  const bySquad = new Map<string, { name: string; ages: number[] }>();
  for (const player of players) {
    const id = getSquadId(player);
    if (id === null) continue;
    const squad = bySquad.get(id) ?? { name: getSquadName(player) ?? `Club ${id}`, ages: [] };
    squad.ages.push(player.metadata.age);
    bySquad.set(id, squad);
  }

  return [...bySquad.entries()]
    .map(([id, { name, ages }]) => ({
      id,
      name,
      playerCount: ages.length,
      averageAge: ages.reduce((sum, age) => sum + age, 0) / ages.length,
      isOwned: ownedClubIds.has(id)
    }))
    .sort((a, b) => b.playerCount - a.playerCount || a.name.localeCompare(b.name));
}

/**
 * The squad to open on: the wallet's own club with the youngest players, since that is where most
 * progression happens. It also keeps the first load small - one squad instead of every player.
 */
export function getDefaultSquad(squads: Squad[]): string {
  const owned = squads.filter(squad => squad.isOwned);
  // Without ownership info, fall back to clubs big enough to be the wallet's own squads
  const candidates = owned.length > 0 ? owned : squads.filter(squad => squad.playerCount >= MIN_SQUAD_SIZE);

  const youngest = [...candidates].sort(
    (a, b) => a.averageAge - b.averageAge || b.playerCount - a.playerCount || a.name.localeCompare(b.name)
  )[0];
  return youngest?.id ?? ALL_SQUADS;
}
