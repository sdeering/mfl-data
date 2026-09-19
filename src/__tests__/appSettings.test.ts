import { loadAppSettings, saveAppSettings, isRetiredPlayer, applyRetiredPlayersSetting } from '../utils/appSettings';
import type { MFLPlayer } from '../types/mflApi';

const makePlayer = (id: number, retirementYears?: number) =>
  ({ id, metadata: { retirementYears } } as unknown as MFLPlayer);

describe('appSettings', () => {
  const active = makePlayer(1);
  const finalSeason = makePlayer(2, 1);
  const retired = makePlayer(3, 0);

  beforeEach(() => {
    window.localStorage.clear();
  });

  it('hides retired players by default', () => {
    expect(loadAppSettings().hideRetiredPlayers).toBe(true);
    expect(applyRetiredPlayersSetting([active, finalSeason, retired]).map(p => p.id)).toEqual([1, 2]);
  });

  it('keeps retired players when the setting is turned off', () => {
    saveAppSettings({ hideRetiredPlayers: false });

    expect(loadAppSettings().hideRetiredPlayers).toBe(false);
    expect(applyRetiredPlayersSetting([active, finalSeason, retired]).map(p => p.id)).toEqual([1, 2, 3]);
  });

  it('only treats a player with no retirement years left as retired', () => {
    expect(isRetiredPlayer(retired)).toBe(true);
    expect(isRetiredPlayer(finalSeason)).toBe(false);
    expect(isRetiredPlayer(active)).toBe(false);
  });

  it('falls back to the defaults when what was saved is not valid', () => {
    window.localStorage.setItem('mfl-app-settings', 'not json');

    expect(loadAppSettings().hideRetiredPlayers).toBe(true);
  });
});
