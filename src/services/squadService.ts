import type { MFLPlayer } from '../types/mflApi';

export interface SquadPlayer {
  player: MFLPlayer;
  position: string;
}

/** How squads were saved before lineups: one formation's players keyed by position ("CB1"), extras as "EXTRA1"... */
export type SquadPlayers = { [position: string]: SquadPlayer };

export interface SavedLineup {
  name: string;
  formation: string;
  xi: (number | null)[];
  bench: (number | null)[];
  /** Missing from squads saved before lineups had reserves */
  reserves?: (number | null)[];
  /** Missing from squads saved before lineups had captains */
  captain?: number | null;
}

/** How squads are saved now: the lineups by player ID, and each of those players as they were when saved. */
export interface SquadLineups {
  lineups: SavedLineup[];
  players: Record<string, MFLPlayer>;
}

export interface Squad {
  id?: string;
  wallet_address: string;
  squad_name: string;
  formation_id: string;
  players: SquadPlayers | SquadLineups;
  created_at?: string;
  updated_at?: string;
}

export interface SavedSquad {
  id: string;
  wallet_address: string;
  squad_name: string;
  formation_id: string;
  players: SquadPlayers | SquadLineups;
  created_at: string;
  updated_at: string;
}

// Get all squads for a wallet
export async function getSquads(walletAddress: string): Promise<SavedSquad[]> {
  try {
    const response = await fetch(`/api/squads?walletAddress=${encodeURIComponent(walletAddress)}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch squads: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.squads || [];
  } catch (error) {
    console.error('Error fetching squads:', error);
    throw error;
  }
}

// Save a new squad
export async function saveSquad(
  walletAddress: string,
  squadName: string,
  formationId: string,
  players: SquadPlayers | SquadLineups
): Promise<SavedSquad> {
  try {
    const response = await fetch('/api/squads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        walletAddress,
        squadName,
        formationId,
        players
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to save squad: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.squad;
  } catch (error) {
    console.error('Error saving squad:', error);
    throw error;
  }
}

// Update an existing squad
export async function updateSquad(
  squadId: string,
  walletAddress: string,
  squadName: string,
  formationId: string,
  players: SquadPlayers | SquadLineups
): Promise<SavedSquad> {
  try {
    const response = await fetch(`/api/squads/${squadId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        walletAddress,
        squadName,
        formationId,
        players
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to update squad: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.squad;
  } catch (error) {
    console.error('Error updating squad:', error);
    throw error;
  }
}

// Delete a squad
export async function deleteSquad(squadId: string, walletAddress: string): Promise<void> {
  try {
    const response = await fetch(`/api/squads/${squadId}?walletAddress=${encodeURIComponent(walletAddress)}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to delete squad: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error deleting squad:', error);
    throw error;
  }
}

// Load a squad (get squad data and return formatted for the squad builder)
export async function loadSquad(squadId: string): Promise<SavedSquad> {
  try {
    const response = await fetch(`/api/squads/${squadId}`);
    
    if (!response.ok) {
      throw new Error(`Failed to load squad: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.squad;
  } catch (error) {
    console.error('Error loading squad:', error);
    throw error;
  }
}

// Rename a squad, keeping its lineups as they were saved
export async function renameSquad(squad: SavedSquad, walletAddress: string, squadName: string): Promise<SavedSquad> {
  return updateSquad(squad.id, walletAddress, squadName, squad.formation_id, squad.players);
}

// Put a wallet's squads in the order given, first to last
export async function reorderSquads(walletAddress: string, squadIds: string[]): Promise<void> {
  const response = await fetch('/api/squads/order', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ walletAddress, squadIds }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to order squads: ${response.statusText}`);
  }
}
