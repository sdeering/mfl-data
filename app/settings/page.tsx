'use client';

import React, { useState, useEffect } from 'react';
import { loadAppSettings, saveAppSettings, DEFAULT_APP_SETTINGS, type AppSettings } from '../../src/utils/appSettings';
import { PageHeader, Panel } from '../../src/components/ui';

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
    <div className="flex flex-col gap-[22px]">
      <PageHeader title="Settings" />

      <Panel className="max-w-2xl divide-y divide-divider">
        <div className="flex items-center justify-between gap-6 px-5 py-[18px]">
          <div>
            <label htmlFor="hide-retired-players" className="block text-[15px] font-bold text-fg">
              Hide retired players
            </label>
            <p className="m-0 mt-1 text-sm leading-normal text-muted">
              Retired players stay in your agency but can no longer play or sign a contract.
              When on, they are left out of My Players, the Squad Builder, Player Progression and the Compare suggestions.
            </p>
          </div>
          <button
            id="hide-retired-players"
            role="switch"
            aria-checked={settings.hideRetiredPlayers}
            onClick={() => updateSettings({ hideRetiredPlayers: !settings.hideRetiredPlayers })}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full border transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-panel ${
              settings.hideRetiredPlayers ? 'border-accent bg-accent' : 'border-line-2 bg-field'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full transition-transform ${
                settings.hideRetiredPlayers ? 'translate-x-[23px] bg-accent-fg' : 'translate-x-[3px] bg-muted'
              }`}
            />
          </button>
        </div>
      </Panel>

      <p className="m-0 -mt-2 text-sm font-medium text-muted-3">
        Settings are saved in this browser.
      </p>
    </div>
  );
}
