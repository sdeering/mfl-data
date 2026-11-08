import React, { useCallback, useState } from 'react';
import { PLAYER_ONLY_SETTINGS, PLAYER_SETTINGS, TACTIC_SETTINGS, TACTIC_STEPS, type TacticPick } from '../../services/matchAnalysis';
import type { MFLPlayer } from '../../types/mflApi';
import {
  BANDS,
  MAX_LOGGED_PLAYERS,
  adviceAgreement,
  adviceRecord,
  bandOf,
  FOLLOWED_SHARE,
  followedAdvice,
  playerSettingEffects,
  type PlayerSettings,
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
const colourOf = (key: string) => (PLAYER_SETTINGS.concat(TACTIC_SETTINGS).find(setting => setting.key === key)?.group === 'in' ? IN_COLOUR : OUT_COLOUR);
const labelOf = (key: string) => PLAYER_SETTINGS.concat(TACTIC_SETTINGS).find(setting => setting.key === key)?.label ?? key;
const playerName = (playersById: Map<number, MFLPlayer> | undefined, id: number | string) => {
  const player = playersById?.get(Number(id));
  return player ? `${player.metadata.firstName.charAt(0)}. ${player.metadata.lastName}` : `Player ${id}`;
};
/** Players with instructions set, as the log keeps them: those left all on TEAM dropped */
const setOnly = (players: PlayerSettings): PlayerSettings => Object.fromEntries(Object.entries(players).filter(([, own]) => Object.keys(own).length));
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

/** How a logged match compares with what the AI advised for it */
const AdviceChip: React.FC<{ match: ClubMatchLog }> = ({ match }) => {
  if (!match.advice) return null;
  if (!match.settings || !match.advice.settings) {
    return (
      <span className="h-[20px] px-1.5 rounded-md grid place-items-center bg-chip text-[10px] font-extrabold text-fg-3" title="The AI's advice for this match is kept: log what you used to compare">
        AI
      </span>
    );
  }
  const { same, total } = adviceAgreement(match.settings, match.advice.settings);
  const followed = followedAdvice(match);
  return (
    <span
      className="h-[20px] px-1.5 rounded-md grid place-items-center text-[10px] font-extrabold"
      style={followed ? { background: 'rgba(198,244,50,.14)', color: '#c6f432' } : { background: 'var(--chip)', color: 'var(--muted)' }}
      title={`${same} of ${total} team settings as the AI advised${followed ? ': followed' : ''}`}
    >
      AI {same}/{total}
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

/** One player's individual instructions to click: TEAM follows the team's step, a step sets theirs */
const PlayerEditor: React.FC<{ own: TacticSettings; advised?: TacticSettings; onChange: (own: TacticSettings) => void }> = ({ own, advised, onChange }) => (
  <div className="flex flex-col gap-1.5">
    {PLAYER_SETTINGS.map(setting => {
      const step = own[setting.key];
      const colour = colourOf(setting.key);
      const clear = () => {
        const { [setting.key]: _cleared, ...rest } = own;
        onChange(rest);
      };
      return (
        <div key={setting.key} className="grid grid-cols-[minmax(0,1fr)_46px_100px] items-center gap-2" title={advised?.[setting.key] ? `AI advised ${advised[setting.key]}` : undefined}>
          <span className={`text-xs truncate ${step ? 'font-bold' : 'font-semibold text-muted'}`}>
            {setting.label}
            {advised?.[setting.key] !== undefined && <span className="ml-1 text-[10px] font-bold text-accent-ink">AI {advised[setting.key]}</span>}
          </span>
          <button
            type="button"
            onClick={clear}
            aria-pressed={!step}
            className={`h-5 rounded-md text-[10px] font-extrabold cursor-pointer ${!step ? 'border border-[#c6f432] text-accent-ink' : 'border border-line-2 text-muted-3 hover:text-fg'}`}
          >
            {PLAYER_ONLY_SETTINGS.has(setting.key) ? 'MID' : 'TEAM'}
          </button>
          <span className="flex gap-[3px]" role="radiogroup" aria-label={setting.label}>
            {Array.from({ length: TACTIC_STEPS }, (_, index) => (
              <button
                key={index}
                type="button"
                role="radio"
                aria-checked={step === index + 1}
                title={`${setting.label}: ${index + 1}${index === 0 ? ` (${setting.low})` : index === TACTIC_STEPS - 1 ? ` (${setting.high})` : ''}`}
                onClick={() => onChange({ ...own, [setting.key]: index + 1 })}
                className="flex-1 h-2.5 rounded-full border-0 p-0 cursor-pointer hover:opacity-80"
                style={{ background: step && index < step ? colour : 'var(--line)' }}
              />
            ))}
          </span>
        </div>
      );
    })}
  </div>
);

/** Individual instructions for a match: a card per player, players added from the squad */
const PlayersEditor: React.FC<{
  players: PlayerSettings;
  advised?: PlayerSettings;
  playersById?: Map<number, MFLPlayer>;
  onChange: (players: PlayerSettings) => void;
}> = ({ players, advised, playersById, onChange }) => {
  const ids = Object.keys(players);
  const squad = [...(playersById?.values() ?? [])].filter(player => !ids.includes(String(player.id))).sort((a, b) => b.metadata.overall - a.metadata.overall);
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="flex flex-col">
          <span className={capsLabel}>Player instructions</span>
          <span className="text-[11px] font-medium text-muted-3">Only what you set differently from the team. Players left all on TEAM aren&apos;t kept.</span>
        </span>
        {ids.length < MAX_LOGGED_PLAYERS && squad.length > 0 && (
          <select
            value=""
            onChange={event => event.target.value && onChange({ ...players, [event.target.value]: {} })}
            aria-label="Add a player"
            className="h-8 px-2.5 rounded-lg border border-line-2 bg-field text-fg text-xs font-bold cursor-pointer outline-none"
          >
            <option value="">+ Add player</option>
            {squad.map(player => (
              <option key={player.id} value={player.id}>
                {player.metadata.positions[0]} {player.metadata.lastName} ({player.metadata.overall})
              </option>
            ))}
          </select>
        )}
      </div>
      {ids.length > 0 && (
        <div className="grid gap-2.5 grid-cols-[repeat(auto-fill,minmax(min(100%,270px),1fr))]">
          {ids.map(id => (
            <div key={id} className="flex flex-col gap-2 px-3 py-2.5 rounded-xl bg-panel border border-line">
              <span className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-bold truncate">
                  {playersById?.get(Number(id))?.metadata.positions[0] ?? ''} {playerName(playersById, id)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const { [id]: _removed, ...rest } = players;
                    onChange(rest);
                  }}
                  className="text-[11px] font-bold text-muted-3 cursor-pointer bg-transparent border-0 p-0 hover:text-[#ef4444]"
                >
                  Remove
                </button>
              </span>
              <PlayerEditor own={players[id]} advised={advised?.[id]} onChange={own => onChange({ ...players, [id]: own })} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/** Rows shown before "Show all" */
const SHOWN_ROWS = 8;

/**
 * The "Import from MFL" bookmark and how to use it: on app.playmfl.com it loads public/mfl-import.js, which reads the
 * tactics MFL's match reports show the logged-in owner and logs them here.
 */
const ImportFromMfl: React.FC<{ onRefresh?: () => void }> = ({ onRefresh }) => {
  // React won't render a javascript: link, so the bookmark's address is set on the element
  const bookmark = useCallback((link: HTMLAnchorElement | null) => {
    if (!link) return;
    const script = `${window.location.origin}/mfl-import.js`;
    link.setAttribute('href', `javascript:(()=>{const s=document.createElement('script');s.src='${script}?t='+Date.now();document.body.appendChild(s)})()`);
  }, []);
  return (
    <div className="flex flex-col gap-2.5 px-3.5 py-3 rounded-xl bg-inset border border-line text-[13px] font-medium text-muted">
      <span className={capsLabel}>Import your tactics from MFL</span>
      <ol className="m-0 pl-5 flex flex-col gap-1">
        <li>
          Drag this to your bookmarks bar:{' '}
          <a
            ref={bookmark}
            onClick={event => event.preventDefault()}
            title="Drag me to your bookmarks bar"
            className="inline-flex items-center h-7 px-2.5 rounded-[9px] bg-[#c6f432] text-[#0d1a05] text-xs font-extrabold no-underline cursor-grab"
          >
            MFL Data import
          </a>
        </li>
        <li>
          Open <span className="font-bold text-fg-3">app.playmfl.com</span>, logged in, and click the bookmark there.
        </li>
      </ol>
      <span>
        For each of your clubs it reads MFL&apos;s match reports, newest first, up to the last {10} matches, and logs the team settings and player
        instructions you used. It stops at a match already logged the same, so running it again only adds new matches, and it corrects any match logged
        differently. Your MFL login stays on MFL&apos;s site.
      </span>
      {onRefresh && (
        <button type="button" onClick={onRefresh} className="self-start text-xs font-semibold text-accent-ink cursor-pointer bg-transparent border-0 p-0">
          Imported? Refresh the log
        </button>
      )}
    </div>
  );
};

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
  onSave: (matchId: number, settings: TacticSettings | null, players?: PlayerSettings) => Promise<void>;
  /** Our squad, for naming players and adding them to individual instructions */
  playersById?: Map<number, MFLPlayer>;
  /** Reads the log again, after an import from MFL */
  onRefresh?: () => void;
}> = ({ clubName, history, isLoading, error, canEdit, onSave, playersById, onRefresh }) => {
  const [showImport, setShowImport] = useState(false);
  const [editing, setEditing] = useState<{ matchId: number; settings: TacticSettings; players: PlayerSettings } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [showAll, setShowAll] = useState(false);
  const matches = history?.matches ?? [];
  const logged = loggedMatches(history).length;

  const startEditing = (match: ClubMatchLog) => {
    // The settings logged for it, or for the latest match before it that has some
    const previous = matches.slice(matches.indexOf(match) + 1).find(item => item.settings) ?? matches.find(item => item.settings);
    const start = match.settings ?? previous?.settings ?? Object.fromEntries(TACTIC_SETTINGS.map(setting => [setting.key, DEFAULT_STEP]));
    // Individual instructions carry over the same way, so a friendly can change just one
    const players = match.settings ? match.players ?? {} : previous?.players ?? {};
    setEditing({ matchId: match.matchId, settings: { ...start }, players: JSON.parse(JSON.stringify(players)) });
    setSaveError('');
  };
  const save = async (settings: TacticSettings | null) => {
    if (!editing) return;
    setSaving(true);
    setSaveError('');
    try {
      await onSave(editing.matchId, settings, setOnly(editing.players));
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
        <span className="flex items-center gap-3">
          {!canEdit && <span className="text-xs font-semibold text-muted-3">Connect the club owner&apos;s wallet to log</span>}
          <button
            type="button"
            onClick={() => setShowImport(!showImport)}
            aria-expanded={showImport}
            className="h-8 px-3 rounded-[9px] border border-line-2 text-xs font-bold text-fg-3 cursor-pointer hover:border-[#c6f432] hover:text-[#c6f432]"
          >
            {showImport ? 'Close' : 'Import from MFL'}
          </button>
        </span>
      </div>
      {showImport && <ImportFromMfl onRefresh={onRefresh} />}
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
                  <AdviceChip match={match} />
                  {match.settings ? (
                    <>
                      <SettingsStrip settings={match.settings} />
                      {Object.keys(match.players ?? {}).length > 0 && (
                        <span
                          className="text-[10px] font-bold text-muted-3"
                          title={Object.entries(match.players!)
                            .map(([id, own]) => `${playerName(playersById, id)}: ${Object.entries(own).map(([key, step]) => `${labelOf(key)} ${step}`).join(', ')}`)
                            .join('\n')}
                        >
                          +{Object.keys(match.players!).length}P
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-[11px] font-semibold text-muted-3">Not logged</span>
                  )}
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
                  {match.advice && (
                    <div className="flex items-center gap-2.5 flex-wrap px-3 py-2 rounded-lg bg-panel border border-line text-xs font-semibold text-muted">
                      <span className={capsLabel}>AI advised</span>
                      <span>
                        {formationLabel(match.advice.formation)}
                        {match.advice.aim !== 'win' ? ` · aim ${match.advice.aim === 'notLose' ? 'not lose' : match.advice.aim}` : ''}
                      </span>
                      {match.advice.settings && <SettingsStrip settings={match.advice.settings} />}
                      {Object.keys(match.advice.players).length > 0 && <span>{Object.keys(match.advice.players).length} player instructions</span>}
                      <span className="flex-1" />
                      <button
                        type="button"
                        onClick={() =>
                          setEditing({
                            ...editing,
                            settings: match.advice!.settings ? { ...match.advice!.settings } : editing.settings,
                            players: JSON.parse(JSON.stringify(match.advice!.players)),
                          })
                        }
                        className="h-7 px-2.5 rounded-[9px] border border-line-2 text-xs font-bold text-fg-3 cursor-pointer hover:border-[#c6f432] hover:text-[#c6f432]"
                      >
                        Use AI advice
                      </button>
                    </div>
                  )}
                  <SettingsEditor settings={editing.settings} onChange={settings => setEditing({ ...editing, settings })} />
                  <PlayersEditor
                    players={editing.players}
                    advised={match.advice?.players}
                    playersById={playersById}
                    onChange={players => setEditing({ ...editing, players })}
                  />
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
  playersById?: Map<number, MFLPlayer>;
}> = ({ history, opponentClubId, opponentName, opponentFormation, tactics, notes, playersById }) => {
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
  const advice = adviceRecord(logged);
  const tried = playerSettingEffects(logged).slice(0, 10);
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-1">
        {header}
        <span className="text-[13px] font-medium text-muted">{recordLine(recordOf(logged))}</span>
        {advice && (
          <span className="text-[13px] font-medium text-muted">
            <b className="text-accent-ink">Following the AI</b> ({Math.round(100 * FOLLOWED_SHARE)}%+ of settings as advised): {advice.followed.games ? recordLine(advice.followed) : 'not yet'}
            <br />
            <b className="text-fg-3">Not following it</b>: {advice.ignored.games ? recordLine(advice.ignored) : 'not yet'}
          </span>
        )}
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
      {tried.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className={capsLabel}>Player instructions tried</span>
          {tried.map(effect => (
            <div key={`${effect.playerId}-${effect.key}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 py-1 border-t border-divider text-xs">
              <span className="flex items-center gap-1.5 font-bold truncate">
                <span className="w-1.5 h-1.5 rounded-full flex-none" style={{ background: colourOf(effect.key) }} />
                {playerName(playersById, effect.playerId)} · {labelOf(effect.key)}
              </span>
              <span className="flex items-center gap-1.5 flex-wrap justify-end">
                {effect.bySteps.map(({ step, record }) => (
                  <span
                    key={step}
                    className="h-6 px-2 rounded-md flex items-center gap-1 bg-chip font-semibold text-fg-3"
                    title={`Set to ${step}: ${record.wins}W ${record.draws}D ${record.losses}L${record.xgDiff !== null ? ` · xG ${signed(record.xgDiff)} a game` : ''}`}
                  >
                    <b className="text-fg">{step}</b> {record.ppg!.toFixed(1)} pts<span className="text-muted-3">· {record.games}</span>
                  </span>
                ))}
                <span
                  className="h-6 px-2 rounded-md flex items-center gap-1 font-semibold text-muted-3"
                  title="The other logged matches: on the team's setting, or not playing"
                >
                  without {effect.team.games ? `${effect.team.ppg!.toFixed(1)} pts · ${effect.team.games}` : '–'}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))]">
        <PastMatches title={`Against ${opponentName}`} matches={sameOpponent} />
        <PastMatches title={`Against ${formationLabel(opponentFormation)}`} matches={sameFormation} />
      </div>
    </div>
  );
};
