import React, { useEffect, useState } from 'react';
import {
  PLAYER_ONLY_SETTINGS,
  PLAYER_SETTINGS,
  TACTIC_SETTINGS,
  TACTIC_STEPS,
  type MatchAnalysis,
  type MatchAnalysisRequest,
  type PlayerInstruction,
  type TacticPick,
  type TacticSetting,
} from '../../services/matchAnalysis';
import type { MFLPlayer } from '../../types/mflApi';
import type { ComparisonRow, SquadComparison, Weakness } from '../../utils/squadComparison';
import { formationLabel } from '../../utils/squadLineups';
import { Panel } from '../ui';
import { adviceFrom, type PlayerSettings, type TacticSettings, type TacticsHistory } from '../../utils/tacticsHistory';
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
const keyOf = (request: MatchAnalysisRequest) =>
  `${request.ourClubId}:${request.theirClubId}:${request.ourFormation}:${request.theirFormation}:${request.aim ?? 'win'}`;

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
  savedPlayers: PlayerSettings | null;
  onSave: (matchId: number, settings: TacticSettings, players: PlayerSettings) => Promise<void>;
}

const sameSettings = (a: TacticSettings | null, b: TacticSettings | null) =>
  !!a && !!b && TACTIC_SETTINGS.every(setting => a[setting.key] === b[setting.key]);
const samePlayers = (a: PlayerSettings | null, b: PlayerSettings) => JSON.stringify(a ?? {}) === JSON.stringify(b);

const MatchSettings: React.FC<{ summary?: string; tactics: TacticPick[]; players: PlayerSettings; target?: SaveTarget }> = ({
  summary,
  tactics,
  players,
  target,
}) => {
  const picks = new Map(tactics.map(pick => [pick.key, pick]));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  // Only a full set of settings can be logged
  const settings: TacticSettings | null =
    picks.size === TACTIC_SETTINGS.length ? Object.fromEntries(TACTIC_SETTINGS.map(setting => [setting.key, picks.get(setting.key)!.step])) : null;
  const saved = !!target && sameSettings(target.saved, settings) && samePlayers(target.savedPlayers, players);
  const save = async () => {
    if (!target || !settings) return;
    setSaving(true);
    setSaveError('');
    try {
      await target.onSave(target.matchId, settings, players);
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
              title="Log these settings and the player instructions below for the match, so the tactics log has them once it's played"
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

const ATTRIBUTES = [
  ['PAC', 'pace'],
  ['SHO', 'shooting'],
  ['PAS', 'passing'],
  ['DRI', 'dribbling'],
  ['DEF', 'defense'],
  ['PHY', 'physical'],
] as const;

/** A player setting as MFL's Individual Instructions draw it: following the team's step (TEAM), or set for them */
const PlayerSettingRow: React.FC<{ setting: TacticSetting; own?: TacticPick; teamStep?: number; colour: string }> = ({ setting, own, teamStep, colour }) => {
  const playerOnly = PLAYER_ONLY_SETTINGS.has(setting.key);
  // A setting left alone follows the team, or for a player-only one sits in the middle
  const step = own?.step ?? teamStep ?? Math.ceil(TACTIC_STEPS / 2);
  const describe = own
    ? `${setting.label}: set to ${step} of ${TACTIC_STEPS} (${step <= 2 ? setting.low : step >= 4 ? setting.high : 'middle'})`
    : playerOnly
      ? `${setting.label}: leave on ${step}`
      : `${setting.label}: leave on TEAM${teamStep ? ` (${teamStep} of ${TACTIC_STEPS})` : ''}`;
  return (
    <div className="flex flex-col gap-1" title={describe}>
      <span className="grid grid-cols-[minmax(0,1fr)_44px_92px] items-center gap-2">
        <span className={`text-xs truncate ${own ? 'font-bold text-fg' : 'font-semibold text-muted'}`}>{setting.label}</span>
        {own ? (
          <span className="h-5 rounded-md grid place-items-center text-[10px] font-extrabold" style={{ background: colour, color: '#0b1406' }}>
            SET {step}
          </span>
        ) : playerOnly ? (
          // No TEAM option in MFL for these: they stay on the middle step
          <span className="text-[10px] font-bold text-center text-muted-3">–</span>
        ) : (
          <span className="h-5 rounded-md grid place-items-center border border-[#c6f432] text-[10px] font-extrabold text-accent-ink">TEAM</span>
        )}
        <span className="flex gap-[3px]" aria-label={describe}>
          {Array.from({ length: TACTIC_STEPS }, (_, index) => (
            <span
              key={index}
              className="flex-1 h-1.5 rounded-full"
              style={{ background: index < step ? colour : 'var(--line)', opacity: index < step && !own ? 0.35 : 1 }}
            />
          ))}
        </span>
      </span>
      {own?.reason && <span className="text-[11px] font-medium text-muted leading-snug">{own.reason}</span>}
    </div>
  );
};

/** One key player's individual instructions, laid out like MFL's screen: their stats, then each setting */
const PlayerInstructionCard: React.FC<{ instruction: PlayerInstruction; player?: MFLPlayer; teamSteps: Map<string, number> }> = ({
  instruction,
  player,
  teamSteps,
}) => {
  const own = new Map(instruction.settings.map(pick => [pick.key, pick]));
  const m = player?.metadata;
  return (
    <div className="flex flex-col gap-3 px-4 py-3.5 rounded-2xl bg-inset border border-line">
      <div className="flex items-start gap-3">
        <span className="h-6 px-2 rounded-md grid place-items-center bg-chip text-[11px] font-extrabold text-fg-3">{instruction.position}</span>
        <span className="flex-1 min-w-0 flex flex-col">
          <span className="text-[15px] font-bold truncate">{m ? `${m.firstName.charAt(0)}. ${m.lastName}` : instruction.name}</span>
          {m && (
            <span className="text-[11px] font-semibold text-muted-3 truncate">
              {m.positions.join(', ')} · {m.age}y/o
            </span>
          )}
        </span>
        {m && <span className="font-display text-[28px] leading-none font-extrabold">{m.overall}</span>}
      </div>
      {m && (
        <div className="grid grid-cols-6 gap-1 px-2 py-2 rounded-xl bg-panel border border-line text-center">
          {ATTRIBUTES.map(([label, attribute]) => (
            <span key={label} className="flex flex-col">
              <span className="text-[10px] font-bold text-muted-3">{label}</span>
              <span className="text-sm font-extrabold">{m[attribute]}</span>
            </span>
          ))}
        </div>
      )}
      <span className="text-xs font-medium text-muted leading-snug">{instruction.reason}</span>
      {SETTING_GROUPS.map(({ group, title, colour }) => (
        <div key={group} className="flex flex-col gap-2">
          <span className="text-[10px] font-extrabold tracking-[0.08em] uppercase" style={{ color: colour }}>
            {title}
          </span>
          {PLAYER_SETTINGS.filter(setting => setting.group === group).map(setting => (
            <PlayerSettingRow key={setting.key} setting={setting} own={own.get(setting.key)} teamStep={teamSteps.get(setting.key)} colour={colour} />
          ))}
        </div>
      ))}
    </div>
  );
};

/** Individual instructions for the analysis's key players, side by side */
const PlayerInstructions: React.FC<{ instructions: PlayerInstruction[]; tactics: TacticPick[]; playersById?: Map<number, MFLPlayer> }> = ({
  instructions,
  tactics,
  playersById,
}) => {
  const teamSteps = new Map(tactics.map(pick => [pick.key, pick.step]));
  return (
    <div className="flex flex-col gap-2.5">
      <span className="flex flex-col gap-0.5">
        <span className={capsLabel}>Player instructions</span>
        <span className="text-xs font-medium text-muted">
          Set in MFL under each player&apos;s Individual Instructions. TEAM follows the match settings above; SET overrides them for that player.
        </span>
      </span>
      <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(min(100%,290px),1fr))]">
        {instructions.map(instruction => (
          <PlayerInstructionCard key={instruction.playerId} instruction={instruction} player={playersById?.get(instruction.playerId)} teamSteps={teamSteps} />
        ))}
      </div>
    </div>
  );
};

/** Fresh AI analyses left today, from /api/match-analysis */
interface Allowance {
  whitelisted: boolean;
  remaining: number | null;
  limit: number | null;
  resetsIn: number;
}

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
  onSaveSettings?: (matchId: number, settings: TacticSettings, players?: PlayerSettings) => Promise<void>;
  /** Our squad, for the stats of the players the analysis gives instructions to */
  playersById?: Map<number, MFLPlayer>;
  /** Called when the server kept the analysis as the advice for the fixture */
  onAdviceSaved?: () => void;
}> = ({ name, request, onUseFormation, history, fixture, onSaveSettings, playersById, onAdviceSaved }) => {
  const key = keyOf(request);
  const [state, setState] = useState<AnalysisState>(() => {
    const known = analyses.get(key);
    return known ? { status: 'done', analysis: known } : { status: 'idle' };
  });
  // The matchup the analysis shown was made for, which stays up when the formations change until asked again
  const [shownFor, setShownFor] = useState<MatchAnalysisRequest | null>(() => (analyses.has(key) ? request : null));
  // The fixture the analysis shown was kept as advice for
  const [keptFor, setKeptFor] = useState<string | null>(null);
  // Fresh analyses left today, null until known or without a database
  const [allowance, setAllowance] = useState<Allowance | null>(null);

  useEffect(() => {
    let cancelled = false;
    // The server reads the signed-in wallet from the session
    fetch('/api/match-analysis')
      .then(response => response.json())
      .then(result => !cancelled && result.success && setAllowance(result.data))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [request.walletAddress]);

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
      if (result.allowance) setAllowance(result.allowance);
      if (!response.ok || !result.success) throw new Error(result.error || `HTTP ${response.status}`);
      analyses.set(key, result.data);
      setState({ status: 'done', analysis: result.data });
      setShownFor(request);
      setKeptFor(result.adviceSaved && fixture ? fixture.when : null);
      if (result.adviceSaved) onAdviceSaved?.();
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
        <div className="flex flex-col items-end gap-1">
          <button type="button" onClick={analyse} disabled={state.status === 'loading'} className={limeButton}>
            {state.status === 'loading' ? 'Analysing…' : analysis ? (stale ? 'Analyse this matchup' : 'Analyse again') : 'Analyse matchup'}
          </button>
          {allowance && (
            <span className="text-[11px] font-semibold text-muted-3" title="A matchup analysed in the last 6 hours opens again for free">
              {allowance.whitelisted
                ? 'Whitelisted: no daily limit'
                : allowance.remaining
                  ? `${allowance.remaining} of ${allowance.limit} analyses left today`
                  : `No analyses left today · more in ${allowance.resetsIn < 3600 ? `${Math.ceil(allowance.resetsIn / 60)} min` : `${Math.ceil(allowance.resetsIn / 3600)} h`}`}
            </span>
          )}
          {allowance && !allowance.whitelisted && (
            <span className="text-[11px] font-semibold text-muted-3">
              Want more? Ask{' '}
              <a href="https://x.com/DogeSports69" target="_blank" rel="noopener noreferrer" className="text-accent-ink hover:underline">
                @DogeSports69
              </a>{' '}
              on X for access
            </span>
          )}
        </div>
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
                {analysis.captain && (
                  <span className="flex items-start gap-2 pt-1.5 text-[13px] font-medium text-muted">
                    <span className="mt-px w-[18px] h-[18px] flex-none rounded-full grid place-items-center bg-[#c6f432] text-[#0b1406] text-[10px] font-extrabold">C</span>
                    <span>
                      <b className="text-fg">{analysis.captain.player}</b> · {analysis.captain.reason}
                    </span>
                  </span>
                )}
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
              players={adviceFrom(analysis, request.aim ?? 'win').players}
              target={
                fixture && onSaveSettings
                  ? {
                      ...fixture,
                      saved: history?.planned[fixture.matchId] ?? null,
                      savedPlayers: history?.plannedPlayers?.[fixture.matchId] ?? null,
                      onSave: onSaveSettings,
                    }
                  : undefined
              }
            />
          )}
          {analysis.players && analysis.players.length > 0 && (
            <PlayerInstructions instructions={analysis.players} tactics={analysis.tactics ?? []} playersById={playersById} />
          )}
          <span className="text-[11px] font-medium text-muted-3">
            AI generated from MFL data. It can be wrong, so check it against the numbers above.
            {keptFor && !stale && ` Kept as the advice for ${keptFor}: log what you used after the match to compare.`}
          </span>
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
            playersById={playersById}
          />
        </div>
      )}
    </Panel>
  );
};
