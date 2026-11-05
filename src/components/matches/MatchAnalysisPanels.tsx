import React, { useEffect, useState } from 'react';
import { TACTIC_SETTINGS, TACTIC_STEPS, type MatchAnalysis, type MatchAnalysisRequest, type TacticPick, type TacticSetting } from '../../services/matchAnalysis';
import type { ComparisonRow, SquadComparison, Weakness } from '../../utils/squadComparison';
import { formationLabel } from '../../utils/squadLineups';
import { Panel } from '../ui';
import type { TacticSettings, TacticsHistory } from '../../utils/tacticsHistory';
import { WhatWorkedSection } from './TacticsLog';
import { capsLabel, limeButton, panelTitle } from './MatchPrep';

/*
 * The Match Prep Tool's squad comparison, with the weak spots in their XI, and the AI match analysis.
 */

const LIME = '#c6f432';
const ORANGE = '#fb923c';
/** A gap this big fills half the bar */
const FULL_GAP = 10;

/** A row of the comparison: our number, a bar leaning to whoever is ahead, theirs */
const Row: React.FC<{ row: ComparisonRow }> = ({ row }) => {
  const { ours, theirs } = row;
  const gap = ours !== null && theirs !== null ? ours - theirs : 0;
  const width = `${(Math.min(Math.abs(gap), FULL_GAP) / FULL_GAP) * 50}%`;
  const show = (value: number | null) => (value === null ? '–' : value.toFixed(1));
  return (
    <div className="grid grid-cols-[96px_44px_minmax(0,1fr)_44px] items-center gap-2.5 py-[5px]" title={row.hint}>
      <span className="text-[13px] font-semibold text-muted truncate">{row.label}</span>
      <span className="text-sm font-extrabold text-right" style={{ color: gap > 0 ? LIME : 'var(--text)' }}>
        {show(ours)}
      </span>
      <span className="relative h-2 rounded-full bg-line" aria-label={gap ? `${Math.abs(gap).toFixed(1)} ${gap > 0 ? 'to you' : 'to them'}` : 'Level'}>
        <span className="absolute left-1/2 top-[-3px] bottom-[-3px] w-px bg-muted-3" />
        {gap !== 0 && (
          <span className="absolute top-0 bottom-0 rounded-full" style={gap > 0 ? { right: '50%', width, background: LIME } : { left: '50%', width, background: ORANGE }} />
        )}
      </span>
      <span className="text-sm font-extrabold" style={{ color: gap < 0 ? ORANGE : 'var(--text)' }}>
        {show(theirs)}
      </span>
    </div>
  );
};

const Section: React.FC<{ title: string; rows: ComparisonRow[] }> = ({ title, rows }) => (
  <div className="flex flex-col">
    <span className={`${capsLabel} mb-1`}>{title}</span>
    {rows.map(row => (
      <Row key={row.label} row={row} />
    ))}
  </div>
);

/** Our XI and squad against theirs, and where to hurt them */
export const SquadComparisonPanel: React.FC<{
  name: string;
  ourFormation: string;
  theirFormation: string;
  comparison: SquadComparison;
  weaknesses: Weakness[];
}> = ({ name, ourFormation, theirFormation, comparison, weaknesses }) => (
  <Panel className="p-[22px] flex flex-col gap-4">
    <div className="flex flex-col gap-1">
      <h2 className={panelTitle}>Squad comparison</h2>
      <span className="text-[13px] font-medium text-muted">
        Your XI in {formationLabel(ourFormation)} against {name}&apos;s best XI in {formationLabel(theirFormation)}
      </span>
    </div>
    <div className="flex justify-between text-xs font-bold">
      <span className="text-accent-ink">You</span>
      <span className="text-[#fb923c]">{name}</span>
    </div>
    <Section title="Strength" rows={comparison.overall.filter(row => row.label !== 'XI age')} />
    <Section title="By line" rows={comparison.lines} />
    <Section title="Outfield XI attributes" rows={comparison.attributes} />
    <div className="flex flex-col gap-2">
      <span className={capsLabel}>Where to hurt them</span>
      {weaknesses.length === 0 && <p className="m-0 text-sm font-medium text-muted">No clear weak spot: their XI is even across the pitch.</p>}
      {weaknesses.map(weakness => (
        <div key={weakness.title + weakness.detail} className="flex gap-2.5 px-3.5 py-2.5 rounded-xl bg-inset border border-line">
          <span className="mt-[5px] w-2 h-2 flex-none rounded-full" style={{ background: weakness.tone === 'target' ? LIME : ORANGE }} />
          <span className="flex flex-col gap-0.5 min-w-0">
            <span className="text-[13px] font-bold">
              {weakness.tone === 'watch' && <span className="text-[#fb923c]">Watch: </span>}
              {weakness.title}
            </span>
            <span className="text-xs font-medium text-muted">{weakness.detail}</span>
          </span>
        </div>
      ))}
    </div>
  </Panel>
);

type AnalysisState = { status: 'idle' } | { status: 'loading' } | { status: 'done'; analysis: MatchAnalysis } | { status: 'error'; error: string };

/** Analyses already asked for this visit, by matchup, so going back to one doesn't ask again */
const analyses = new Map<string, MatchAnalysis>();
const keyOf = (request: MatchAnalysisRequest) => `${request.ourClubId}:${request.theirClubId}:${request.ourFormation}:${request.theirFormation}`;

const EDGE_CHIPS = {
  ours: { label: 'Your edge', colour: '#8ae63a', background: 'rgba(138,230,58,.12)' },
  theirs: { label: 'Their edge', colour: '#ef4444', background: 'rgba(239,68,68,.12)' },
  even: { label: 'Even', colour: '#facc15', background: 'rgba(250,204,21,.12)' },
} as const;

const Points: React.FC<{ title: string; items: { title: string; detail: string }[]; colour: string }> = ({ title, items, colour }) =>
  items.length ? (
    <div className="flex flex-col gap-2">
      <span className={capsLabel}>{title}</span>
      {items.map(item => (
        <div key={item.title} className="flex gap-2.5">
          <span className="mt-[6px] w-2 h-2 flex-none rounded-full" style={{ background: colour }} />
          <span className="flex flex-col gap-0.5 min-w-0">
            <span className="text-sm font-bold">{item.title}</span>
            <span className="text-[13px] font-medium text-muted">{item.detail}</span>
          </span>
        </div>
      ))}
    </div>
  ) : null;

// MFL's colours for the two halves of its playing style screen
const SETTING_GROUPS = [
  { group: 'in', title: 'In possession', sub: 'How your team attacks', colour: '#facc15' },
  { group: 'out', title: 'Out of possession', sub: 'How your team defends', colour: '#3b8bf0' },
] as const;

/** A playing style setting as MFL's Steps view draws it: the step filled in, the ends labelled, and why */
const SettingRow: React.FC<{ setting: TacticSetting; pick: TacticPick; colour: string }> = ({ setting, pick, colour }) => (
  <div className="flex flex-col gap-1.5" title={`${setting.label}: step ${pick.step} of ${TACTIC_STEPS}`}>
    <span className="flex items-baseline justify-between gap-2">
      <span className="text-[13px] font-bold">{setting.label}</span>
      <span className="text-[11px] font-bold text-muted-3">
        {pick.step} / {TACTIC_STEPS}
      </span>
    </span>
    <span className="flex gap-1" aria-label={`Step ${pick.step} of ${TACTIC_STEPS}`}>
      {Array.from({ length: TACTIC_STEPS }, (_, index) => (
        <span key={index} className="flex-1 h-1.5 rounded-full" style={{ background: index < pick.step ? colour : 'var(--line)' }} />
      ))}
    </span>
    <span className="flex justify-between gap-2 text-[10px] font-semibold text-muted-3">
      <span>{setting.low}</span>
      <span className="text-right">{setting.high}</span>
    </span>
    {pick.reason && <span className="text-xs font-medium text-muted">{pick.reason}</span>}
  </div>
);

/** The playing style to set in MFL for this match, both halves side by side */
/** The match to save settings to: the fixture against this opponent, and whether the owner can */
interface SaveTarget {
  matchId: number;
  when: string;
  saved: TacticSettings | null;
  onSave: (matchId: number, settings: TacticSettings) => Promise<void>;
}

const sameSettings = (a: TacticSettings | null, b: TacticSettings | null) =>
  !!a && !!b && TACTIC_SETTINGS.every(setting => a[setting.key] === b[setting.key]);

const MatchSettings: React.FC<{ summary?: string; tactics: TacticPick[]; target?: SaveTarget }> = ({ summary, tactics, target }) => {
  const picks = new Map(tactics.map(pick => [pick.key, pick]));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  // Only a full set of settings can be logged
  const settings: TacticSettings | null =
    picks.size === TACTIC_SETTINGS.length ? Object.fromEntries(TACTIC_SETTINGS.map(setting => [setting.key, picks.get(setting.key)!.step])) : null;
  const saved = !!target && sameSettings(target.saved, settings);
  const save = async () => {
    if (!target || !settings) return;
    setSaving(true);
    setSaveError('');
    try {
      await target.onSave(target.matchId, settings);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className={capsLabel}>Match settings</span>
        {target && settings && (
          <span className="flex items-center gap-2">
            {saveError && <span className="text-xs font-semibold text-[#f87171]">{saveError}</span>}
            <button
              type="button"
              onClick={save}
              disabled={saving || saved}
              title="Log these settings for the match, so the tactics log has them once it's played"
              className="h-8 px-3 rounded-lg border border-line-2 text-xs font-bold text-fg-3 cursor-pointer hover:border-[#c6f432] hover:text-[#c6f432] disabled:cursor-default disabled:hover:border-line-2 disabled:hover:text-fg-3"
            >
              {saved ? `Logged for ${target.when}` : saving ? 'Saving…' : `Log for ${target.when}`}
            </button>
          </span>
        )}
      </div>
      {summary && <p className="m-0 text-sm font-medium text-muted">{summary}</p>}
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))]">
        {SETTING_GROUPS.map(({ group, title, sub, colour }) => {
          const rows = TACTIC_SETTINGS.filter(setting => setting.group === group && picks.has(setting.key));
          if (!rows.length) return null;
          return (
            <div key={group} className="flex flex-col gap-3.5 px-4 py-3.5 rounded-2xl bg-inset border border-line">
              <span className="flex flex-col">
                <span className="text-sm font-bold">{title}</span>
                <span className="text-xs font-medium text-muted-3">{sub}</span>
              </span>
              {rows.map(setting => (
                <SettingRow key={setting.key} setting={setting} pick={picks.get(setting.key)!} colour={colour} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Gemini's read of the matchup, asked for at a click: both squads, their form and their latest match stats go to
 * /api/match-analysis. It suggests a formation, which a click plays.
 */
export const AiAnalysisPanel: React.FC<{
  name: string;
  request: MatchAnalysisRequest;
  onUseFormation: (formation: string) => void;
  /** Our tactics log, for what worked before */
  history: TacticsHistory | null;
  /** The fixture against them, when we play them next, and saving settings to it when the owner is connected */
  fixture?: { matchId: number; when: string };
  onSaveSettings?: (matchId: number, settings: TacticSettings) => Promise<void>;
}> = ({ name, request, onUseFormation, history, fixture, onSaveSettings }) => {
  const key = keyOf(request);
  const [state, setState] = useState<AnalysisState>(() => {
    const known = analyses.get(key);
    return known ? { status: 'done', analysis: known } : { status: 'idle' };
  });
  // The matchup the analysis shown was made for, which stays up when the formations change until asked again
  const [shownFor, setShownFor] = useState<MatchAnalysisRequest | null>(() => (analyses.has(key) ? request : null));

  useEffect(() => {
    const known = analyses.get(key);
    if (known) {
      setState({ status: 'done', analysis: known });
      setShownFor(request);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const analyse = async () => {
    setState({ status: 'loading' });
    try {
      const response = await fetch('/api/match-analysis', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) throw new Error(result.error || `HTTP ${response.status}`);
      analyses.set(key, result.data);
      setState({ status: 'done', analysis: result.data });
      setShownFor(request);
    } catch (error) {
      setState({ status: 'error', error: error instanceof Error ? error.message : 'The analysis failed' });
    }
  };

  const stale = shownFor && keyOf(shownFor) !== key;
  const analysis = state.status === 'done' ? state.analysis : null;
  return (
    <Panel className="p-[22px] flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <h2 className={panelTitle}>AI match analysis</h2>
          <span className="text-[13px] font-medium text-muted">
            {shownFor
              ? `Your ${formationLabel(shownFor.ourFormation)} against ${name}'s ${formationLabel(shownFor.theirFormation)}${stale ? ' · formations changed since' : ''}`
              : `Gemini reads both squads, ${name}'s recent results and their last 5 matches' player stats, and looks for an edge`}
          </span>
        </div>
        <button type="button" onClick={analyse} disabled={state.status === 'loading'} className={limeButton}>
          {state.status === 'loading' ? 'Analysing…' : analysis ? (stale ? 'Analyse this matchup' : 'Analyse again') : 'Analyse matchup'}
        </button>
      </div>

      {state.status === 'loading' && (
        <div className="flex items-center gap-3 py-4">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-accent" />
          <span className="text-sm font-medium text-muted">Reading the squads and their match stats. This can take up to a minute.</span>
        </div>
      )}
      {state.status === 'error' && <p className="m-0 text-sm font-semibold text-danger-ink">{state.error}</p>}

      {analysis && (
        <div className={`flex flex-col gap-5 ${state.status === 'loading' ? 'opacity-50' : ''}`}>
          <p className="m-0 text-[15px] font-medium leading-relaxed">{analysis.summary}</p>
          {analysis.formation.pick && (
            <div className="flex items-center gap-3.5 flex-wrap px-4 py-3.5 rounded-2xl bg-inset border border-line">
              <span className="flex flex-col gap-1 flex-1 min-w-[200px]">
                <span className={capsLabel}>Play</span>
                <span className="font-display text-2xl leading-none font-extrabold text-accent-ink">{formationLabel(analysis.formation.pick)}</span>
                <span className="text-[13px] font-medium text-muted">{analysis.formation.reason}</span>
              </span>
              {analysis.formation.pick !== request.ourFormation && (
                <button
                  type="button"
                  onClick={() => onUseFormation(analysis.formation.pick)}
                  className="h-9 px-3.5 rounded-xl border border-line-2 text-[13px] font-bold text-fg-3 cursor-pointer hover:border-[#c6f432] hover:text-[#c6f432]"
                >
                  Use this formation
                </button>
              )}
            </div>
          )}
          <div className="grid gap-5 grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))]">
            <Points title="Attack" items={analysis.attack} colour={LIME} />
            <Points title="Defend" items={analysis.defend} colour={ORANGE} />
          </div>
          {analysis.matchups.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className={capsLabel}>Key matchups</span>
              <div className="grid gap-2.5 grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))]">
                {analysis.matchups.map(matchup => {
                  const chip = EDGE_CHIPS[matchup.edge] ?? EDGE_CHIPS.even;
                  return (
                    <div key={matchup.ours + matchup.theirs} className="flex flex-col gap-1.5 px-3.5 py-3 rounded-xl bg-inset border border-line">
                      <span className="flex items-center gap-2 flex-wrap text-[13px] font-bold">
                        <span className="text-accent-ink">{matchup.ours}</span>
                        <span className="text-muted-3 text-xs">vs</span>
                        <span className="text-[#fb923c]">{matchup.theirs}</span>
                        <span className="flex-1" />
                        <span className="h-5 px-2 rounded-full flex items-center text-[10px] font-bold" style={{ background: chip.background, color: chip.colour }}>
                          {chip.label}
                        </span>
                      </span>
                      <span className="text-xs font-medium text-muted">{matchup.note}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {analysis.lineup.length > 0 && (
            <Points
              title="Lineup changes"
              items={analysis.lineup.map(change => ({ title: `${change.position}: ${change.change}`, detail: change.reason }))}
              colour="#facc15"
            />
          )}
          {analysis.tactics && analysis.tactics.length > 0 && (
            <MatchSettings
              summary={analysis.styleSummary}
              tactics={analysis.tactics}
              target={
                fixture && onSaveSettings ? { ...fixture, saved: history?.planned[fixture.matchId] ?? null, onSave: onSaveSettings } : undefined
              }
            />
          )}
          <span className="text-[11px] font-medium text-muted-3">AI generated from MFL data. It can be wrong, so check it against the numbers above.</span>
        </div>
      )}
      {history && (
        <div className="pt-4 border-t border-divider">
          <WhatWorkedSection
            history={history}
            opponentClubId={request.theirClubId}
            opponentName={name}
            opponentFormation={request.theirFormation}
            tactics={stale ? undefined : analysis?.tactics}
            notes={stale ? undefined : analysis?.historyNotes}
          />
        </div>
      )}
    </Panel>
  );
};
