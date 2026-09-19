import type { MFLPlayer } from '../types/mflApi';

const APP_SETTINGS_KEY = 'mfl-app-settings';

export interface AppSettings {
  // Retired players stay owned (and synced) forever, but can no longer play or sign a contract
  hideRetiredPlayers: boolean;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  hideRetiredPlayers: true
};

/** The settings saved in this browser, falling back to the defaults. */
export function loadAppSettings(): AppSettings {
  try {
    const stored = window.localStorage.getItem(APP_SETTINGS_KEY);
    if (stored === null) return DEFAULT_APP_SETTINGS;

    const parsed = JSON.parse(stored);
    return {
      hideRetiredPlayers: typeof parsed?.hideRetiredPlayers === 'boolean'
        ? parsed.hideRetiredPlayers
        : DEFAULT_APP_SETTINGS.hideRetiredPlayers
    };
  } catch {
    return DEFAULT_APP_SETTINGS; // No window (server), storage is blocked, or what was saved is not JSON
  }
}

export function saveAppSettings(settings: AppSettings): void {
  try {
    window.localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Remembering the settings is a convenience; the app works the same without it
  }
}

/**
 * MFL counts retirementYears down to 1 in a player's final season; 0 means the career is over.
 * Players who have not had their retirement announced have no retirementYears at all.
 */
export const isRetiredPlayer = (player: MFLPlayer): boolean => player.metadata.retirementYears === 0;

/** Drops retired players when the "hide retired players" setting is on. */
export function applyRetiredPlayersSetting<T extends MFLPlayer>(players: T[]): T[] {
  return loadAppSettings().hideRetiredPlayers ? players.filter(player => !isRetiredPlayer(player)) : players;
}
