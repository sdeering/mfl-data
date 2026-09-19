'use client';

import React, { useState, useEffect } from 'react';
import { loadAppSettings, saveAppSettings, DEFAULT_APP_SETTINGS, type AppSettings } from '../../src/utils/appSettings';

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);

  // Saved settings live in the browser, so they can only be read after mounting
  useEffect(() => {
    setSettings(loadAppSettings());
  }, []);

  const updateSettings = (patch: Partial<AppSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveAppSettings(next);
  };

  return (
    <div className="min-h-screen">
      <div className="p-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
          Settings
        </h1>

        <div className="max-w-2xl bg-white dark:bg-gray-800 rounded-lg shadow divide-y divide-gray-200 dark:divide-gray-700">
          <div className="flex items-center justify-between gap-6 px-6 py-4">
            <div>
              <label htmlFor="hide-retired-players" className="block font-medium text-gray-900 dark:text-white">
                Hide retired players
              </label>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Retired players stay in your agency but can no longer play or sign a contract.
                When on, they are left out of My Players, the Squad Builder, Player Progression and the Compare suggestions.
              </p>
            </div>
            <button
              id="hide-retired-players"
              role="switch"
              aria-checked={settings.hideRetiredPlayers}
              onClick={() => updateSettings({ hideRetiredPlayers: !settings.hideRetiredPlayers })}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
                settings.hideRetiredPlayers ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                  settings.hideRetiredPlayers ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
          Settings are saved in this browser.
        </p>
      </div>
    </div>
  );
}
