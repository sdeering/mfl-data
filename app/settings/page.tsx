'use client';

import React, { useState, useEffect } from 'react';
import { loadAppSettings, saveAppSettings, DEFAULT_APP_SETTINGS, type AppSettings } from '../../src/utils/appSettings';
import { useTheme } from '../../src/contexts/ThemeContext';
import { PageHeader, Panel } from '../../src/components/ui';

/** One setting: its name and what it does, with an on/off switch. */
const SettingSwitch: React.FC<{ id: string; label: string; description: React.ReactNode; checked: boolean; onChange: () => void }> = ({
  id,
  label,
  description,
  checked,
  onChange,
}) => (
  <div className="flex items-center justify-between gap-6 px-5 py-[18px]">
    <div>
      <label htmlFor={id} className="block text-[15px] font-bold text-fg">
        {label}
      </label>
      <p className="m-0 mt-1 text-sm leading-normal text-muted">{description}</p>
    </div>
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full border transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-panel ${
        checked ? 'border-accent bg-accent' : 'border-line-2 bg-field'
      }`}
    >
      <span className={`inline-block h-4 w-4 rounded-full transition-transform ${checked ? 'translate-x-[23px] bg-accent-fg' : 'translate-x-[3px] bg-muted'}`} />
    </button>
  </div>
);

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const { theme, toggleTheme } = useTheme();

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
        <SettingSwitch
          id="dark-mode"
          label="Dark mode"
          description="Show the site on a dark background. Turn it off for the light theme."
          checked={theme === 'dark'}
          onChange={toggleTheme}
        />
        <SettingSwitch
          id="hide-retired-players"
          label="Hide retired players"
          description={
            <>
              Retired players stay in your agency but can no longer play or sign a contract.
              When on, they are left out of My Players, the Squad Builder, Player Progression and the Compare suggestions.
            </>
          }
          checked={settings.hideRetiredPlayers}
          onChange={() => updateSettings({ hideRetiredPlayers: !settings.hideRetiredPlayers })}
        />
      </Panel>

      <p className="m-0 -mt-2 text-sm font-medium text-muted-3">
        Settings are saved in this browser.
      </p>
    </div>
  );
}
