import { MFLPlayer } from '../types/mfl';

export interface SquadPlayer {
  player: MFLPlayer;
  position: string;
}

export interface Squad {
  id?: string;
  wallet_address: string;
  squad_name: string;
  formation_id: string;
  players: { [position: string]: SquadPlayer };
  created_at?: string;
  updated_at?: string;
}

export interface SavedSquad {
  id: string;
  wallet_address: string;
  squad_name: string;
  formation_id: string;
  players: { [position: string]: SquadPlayer };
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
  players: { [position: string]: SquadPlayer }
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
  players: { [position: string]: SquadPlayer }
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
