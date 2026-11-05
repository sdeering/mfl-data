import React, { useState } from 'react';
import { TACTIC_SETTINGS, TACTIC_STEPS, type TacticPick } from '../../services/matchAnalysis';
import {
  BANDS,
  bandOf,
  loggedMatches,
  recordOf,
  settingEffects,
  similarMatches,
  type Band,
  type ClubMatchLog,
  type Record3,
  type TacticSettings,
  type TacticsHistory,
} from '../../utils/tacticsHistory';
import { formationLabel } from '../../utils/squadLineups';
import { Panel } from '../ui';
import { capsLabel, limeButton, panelTitle } from './MatchPrep';

/*
 * The tactics log: the playing style our club used in each match, kept because MFL doesn't share it, and what that
 * history says about each setting, for the AI analysis.
 */

export const IN_COLOUR = '#facc15';
export const OUT_COLOUR = '#3b8bf0';
const colourOf = (key: string) => (TACTIC_SETTINGS.find(setting => setting.key === key)?.group === 'in' ? IN_COLOUR : OUT_COLOUR);
const DEFAULT_STEP = 3;
const RESULT_CHIPS = { W: ['#8ae63a', '#0d1a05'], D: ['#3a4640', '#dfe7e1'], L: ['#ef4444', '#ffffff'] } as const;
const TYPE_LABELS: Record<string, string> = { LEAGUE: 'League', CUP: 'Cup', FRIENDLY: 'Friendly' };

const resultOf = (match: ClubMatchLog) => (match.goalsFor > match.goalsAgainst ? 'W' : match.goalsFor < match.goalsAgainst ? 'L' : 'D');
const day = (date: number) => new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const signed = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1)}`;

/** All twelve settings as small bars, in possession then out, their height the step */
export const SettingsStrip: React.FC<{ settings: TacticSettings }> = ({ settings }) => (
  <span
    className="inline-flex items-end gap-[2px] h-4"
    title={TACTIC_SETTINGS.map(setting => `${setting.label}: ${settings[setting.key]}`).join('\n')}
    aria-label="Playing style settings"
  >
    {TACTIC_SETTINGS.map((setting, index) => (
      <span
        key={setting.key}
        className={`w-[4px] rounded-[1px] ${index === 7 ? 'ml-1' : ''}`}
        style={{ height: `${(settings[setting.key] / TACTIC_STEPS) * 100}%`, background: colourOf(setting.key) }}
      />
    ))}
  </span>
);

const ResultChip: React.FC<{ match: ClubMatchLog }> = ({ match }) => {
  const result = resultOf(match);
  return (
    <span className="h-[22px] min-w-[42px] px-2 rounded-full grid place-items-center text-[11px] font-extrabold" style={{ background: RESULT_CHIPS[result][0], color: RESULT_CHIPS[result][1] }}>
      {match.goalsFor}-{match.goalsAgainst}
    </span>
  );
};

/** Every setting as its steps to click, both halves side by side */
const SettingsEditor: React.FC<{ settings: TacticSettings; onChange: (settings: TacticSettings) => void }> = ({ settings, onChange }) => (
  <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))]">
    {(['in', 'out'] as const).map(group => (
      <div key={group} className="flex flex-col gap-2.5">
        <span className={capsLabel}>{group === 'in' ? 'In possession' : 'Out of possession'}</span>
        {TACTIC_SETTINGS.filter(setting => setting.group === group).map(setting => (
          <div key={setting.key} className="flex flex-col gap-1">
            <span className="flex justify-between text-xs font-bold">
              {setting.label}
              <span className="text-muted-3">{settings[setting.key]}</span>
            </span>
            <span className="flex gap-1" role="radiogroup" aria-label={setting.label}>
              {Array.from({ length: TACTIC_STEPS }, (_, index) => (
                <button
                  key={index}
                  type="button"
                  role="radio"
                  aria-checked={settings[setting.key] === index + 1}
                  title={`${setting.label}: ${index + 1}${index === 0 ? ` (${setting.low})` : index === TACTIC_STEPS - 1 ? ` (${setting.high})` : ''}`}
                  onClick={() => onChange({ ...settings, [setting.key]: index + 1 })}
                  className="flex-1 h-3 rounded-full border-0 p-0 cursor-pointer hover:opacity-80"
                  style={{ background: index < settings[setting.key] ? colourOf(setting.key) : 'var(--line)' }}
                />
              ))}
            </span>
          </div>
        ))}
      </div>
    ))}
  </div>
);

/** Rows shown before "Show all" */
const SHOWN_ROWS = 8;

/**
 * Our latest matches, competitive and friendly, with the settings logged for each. The owner can log or change them;
 * a new log starts from the one before it.
 */
export const TacticsLogPanel: React.FC<{
  clubName: string;
  history: TacticsHistory | null;
  isLoading: boolean;
  error: string | null;
  canEdit: boolean;
  onSave: (matchId: number, settings: TacticSettings | null) => Promise<void>;
}> = ({ clubName, history, isLoading, error, canEdit, onSave }) => {
  const [editing, setEditing] = useState<{ matchId: number; settings: TacticSettings } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [showAll, setShowAll] = useState(false);
  const matches = history?.matches ?? [];
  const logged = loggedMatches(history).length;

  const startEditing = (match: ClubMatchLog) => {
    // The settings logged for it, or for the latest match before it that has some
    const before = matches.slice(matches.indexOf(match) + 1).find(item => item.settings)?.settings;
    const latest = matches.find(item => item.settings)?.settings;
    const start = match.settings ?? before ?? latest ?? Object.fromEntries(TACTIC_SETTINGS.map(setting => [setting.key, DEFAULT_STEP]));
    setEditing({ matchId: match.matchId, settings: { ...start } });
    setSaveError('');
  };
  const save = async (settings: TacticSettings | null) => {
    if (!editing) return;
    setSaving(true);
    setSaveError('');
    try {
      await onSave(editing.matchId, settings);
      setEditing(null);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel className="p-[22px] flex flex-col gap-3.5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <h2 className={panelTitle}>{clubName} · Tactics log</h2>
          <span className="text-[13px] font-medium text-muted">
            MFL doesn&apos;t share playing styles, so log the settings you used and the AI analysis learns what works for you.
            {logged > 0 && ` ${logged} logged.`}
          </span>
        </div>
        {!canEdit && <span className="text-xs font-semibold text-muted-3">Connect the club owner&apos;s wallet to log</span>}
      </div>
      {error && <p className="m-0 text-sm font-semibold text-danger-ink">{error}</p>}
      {isLoading && !history && <p className="m-0 text-sm font-medium text-muted">Loading your matches…</p>}
      {history && matches.length === 0 && <p className="m-0 text-sm font-medium text-muted">No played matches yet.</p>}
      <div className="flex flex-col">
        {(showAll ? matches : matches.slice(0, SHOWN_ROWS)).map(match => {
          const open = editing?.matchId === match.matchId;
          return (
            <div key={match.matchId} className="flex flex-col gap-3 py-2 border-b border-divider">
              <div className="grid grid-cols-[52px_62px_minmax(0,1fr)_auto_auto] items-center gap-2.5 text-[13px]">
                <span className="font-semibold text-muted">{day(match.startDate)}</span>
                <span className="text-[11px] font-bold text-muted-3">{TYPE_LABELS[match.type] ?? match.type}</span>
                <span className="font-bold truncate">{match.opponent.name}</span>
                <ResultChip match={match} />
                <span className="flex items-center gap-2 justify-end min-w-[96px]">
                  {match.settings ? <SettingsStrip settings={match.settings} /> : <span className="text-[11px] font-semibold text-muted-3">Not logged</span>}
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => (open ? setEditing(null) : startEditing(match))}
                      className="h-7 px-2.5 rounded-[9px] border border-line-2 text-xs font-bold text-fg-3 cursor-pointer hover:border-[#c6f432] hover:text-[#c6f432]"
                    >
                      {open ? 'Close' : match.settings ? 'Edit' : 'Log'}
                    </button>
                  )}
                </span>
              </div>
              {open && editing && (
                <div className="flex flex-col gap-3 px-3.5 py-3 rounded-xl bg-inset border border-line">
                  <SettingsEditor settings={editing.settings} onChange={settings => setEditing({ ...editing, settings })} />
                  <div className="flex items-center gap-2 flex-wrap">
                    <button type="button" onClick={() => save(editing.settings)} disabled={saving} className={limeButton}>
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                    {match.settings && (
                      <button
                        type="button"
                        onClick={() => save(null)}
                        disabled={saving}
                        className="h-10 px-3.5 rounded-xl border border-line-2 text-[13px] font-bold text-fg-3 cursor-pointer hover:border-[#ef4444] hover:text-[#ef4444]"
                      >
                        Forget
                      </button>
                    )}
                    {saveError && <span className="text-xs font-semibold text-[#f87171]">{saveError}</span>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {matches.length > SHOWN_ROWS && (
        <button type="button" onClick={() => setShowAll(!showAll)} className="self-start text-xs font-semibold text-accent-ink cursor-pointer bg-transparent border-0 p-0">
          {showAll ? 'Show fewer' : `Show all ${matches.length}`}
        </button>
      )}
    </Panel>
  );
};

const BAND_LABELS: Record<Band, string> = { low: 'Low 1-2', mid: 'Middle 3', high: 'High 4-5' };
const recordLine = (record: Record3) =>
  `${record.games} logged · ${record.wins}W ${record.draws}D ${record.losses}L · ${record.ppg?.toFixed(2) ?? '–'} pts/game${record.xgDiff !== null ? ` · xG ${signed(record.xgDiff)} a game` : ''}`;

const PastMatches: React.FC<{ title: string; matches: ClubMatchLog[] }> = ({ title, matches }) =>
  matches.length ? (
    <div className="flex flex-col gap-1">
      <span className={capsLabel}>{title}</span>
      {matches.slice(0, 5).map(match => (
        <div key={match.matchId} className="grid grid-cols-[52px_minmax(0,1fr)_auto_auto] items-center gap-2.5 py-1 text-[13px]">
          <span className="font-semibold text-muted">{day(match.startDate)}</span>
          <span className="font-bold truncate">
            {match.opponent.name}
            <span className="font-medium text-muted-3">
              {' '}
              · {TYPE_LABELS[match.type] ?? match.type}
              {match.formation ? ` · ${formationLabel(match.formation)}` : ''}
              {match.xGFor !== null && match.xGAgainst !== null ? ` · xG ${match.xGFor.toFixed(1)}-${match.xGAgainst.toFixed(1)}` : ''}
            </span>
          </span>
          <ResultChip match={match} />
          {match.settings && <SettingsStrip settings={match.settings} />}
        </div>
      ))}
    </div>
  ) : null;

/**
 * What our logged matches say: our record with each setting low, mid and high, the best band picked out and the
 * AI's step marked, our logged games against this opponent and formation, and the AI's reading of it all.
 */
export const WhatWorkedSection: React.FC<{
  history: TacticsHistory | null;
  opponentClubId: number;
  opponentName: string;
  opponentFormation: string;
  tactics?: TacticPick[];
  notes?: { title: string; detail: string }[];
}> = ({ history, opponentClubId, opponentName, opponentFormation, tactics, notes }) => {
  const logged = loggedMatches(history);
  const header = (
    <span className={capsLabel} id="what-worked">
      What worked for us before
    </span>
  );
  if (!logged.length) {
    return (
      <div className="flex flex-col gap-1.5">
        {header}
        <p className="m-0 text-sm font-medium text-muted">
          No matches logged yet. Log the settings you used in the tactics log below, or save these settings to the match, and this fills in after a few
          games.
        </p>
      </div>
    );
  }
  const effects = settingEffects(logged);
  const picked = new Map((tactics ?? []).map(pick => [pick.key, bandOf(pick.step)]));
  const { sameOpponent, sameFormation } = similarMatches(logged, opponentClubId, opponentFormation);
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-1">
        {header}
        <span className="text-[13px] font-medium text-muted">{recordLine(recordOf(logged))}</span>
      </div>
      {notes && notes.length > 0 && (
        <div className="flex flex-col gap-2">
          {notes.map(note => (
            <div key={note.title} className="flex gap-2.5">
              <span className="mt-[6px] w-2 h-2 flex-none rounded-full bg-[#c6f432]" />
              <span className="flex flex-col gap-0.5 min-w-0">
                <span className="text-sm font-bold">{note.title}</span>
                <span className="text-[13px] font-medium text-muted">{note.detail}</span>
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="overflow-x-auto">
        <div className="min-w-[460px] flex flex-col">
          <div className="grid grid-cols-[130px_repeat(3,minmax(0,1fr))] gap-2 pb-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-3">
            <span>Setting</span>
            {BANDS.map(({ band }) => (
              <span key={band}>{BAND_LABELS[band]}</span>
            ))}
          </div>
          {effects.map(effect => {
            const setting = TACTIC_SETTINGS.find(item => item.key === effect.key)!;
            return (
              <div key={effect.key} className="grid grid-cols-[130px_repeat(3,minmax(0,1fr))] gap-2 py-1 border-t border-divider items-center">
                <span className="flex items-center gap-1.5 text-xs font-bold truncate">
                  <span className="w-1.5 h-1.5 rounded-full flex-none" style={{ background: colourOf(effect.key) }} />
                  {setting.label}
                </span>
                {BANDS.map(({ band }) => {
                  const record = effect.bands[band];
                  const best = effect.best === band;
                  const ai = picked.get(effect.key) === band;
                  return (
                    <span
                      key={band}
                      title={record.games ? `${record.wins}W ${record.draws}D ${record.losses}L${record.xgDiff !== null ? ` · xG ${signed(record.xgDiff)} a game` : ''}` : 'Not played'}
                      className={`h-7 px-2 rounded-lg flex items-center gap-1.5 text-xs ${best ? 'bg-[rgba(198,244,50,.12)] text-accent-ink font-extrabold' : 'text-fg-3 font-semibold'} ${
                        ai ? 'ring-1 ring-[#c6f432]' : ''
                      }`}
                    >
                      {record.games ? (
                        <>
                          {record.ppg!.toFixed(1)} pts<span className="text-muted-3 font-medium">· {record.games}</span>
                        </>
                      ) : (
                        <span className="text-muted-3">–</span>
                      )}
                    </span>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <span className="text-[11px] font-medium text-muted-3">
        Points a game and games played with each setting. Highlighted: the best band with {2}+ games.{tactics?.length ? ' Outlined: the band of the step recommended above.' : ''}
      </span>
      <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))]">
        <PastMatches title={`Against ${opponentName}`} matches={sameOpponent} />
        <PastMatches title={`Against ${formationLabel(opponentFormation)}`} matches={sameFormation} />
      </div>
    </div>
  );
};
