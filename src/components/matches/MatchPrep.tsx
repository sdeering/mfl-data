import React, { useState } from 'react';
import { clubsService } from '../../services/clubsService';
import type { ScoutMatch } from '../../services/scoutService';
import { matchResult, type FilledSlot, type FormationFit, type FormationGuess, type FormationPick } from '../../utils/formationPlanner';
import { FORMATIONS, FORMATION_NAMES, formationLabel } from '../../utils/squadLineups';
import type { MFLPlayer } from '../../types/mflApi';
import { Panel } from '../ui';

/*
 * The panels of the Match Prep Tool (the Matches page), from the "MFL Matches" Claude Design file: an opponent's
 * likely formation, how often they change it, our counters, the matchup on a pitch and their recent results.
 */

const LIME = '#c6f432';
const ORANGE = '#f97316';
const OTHER_FORMATION = '#9aa49e';
const RESULT_COLOURS = { W: ['#8ae63a', '#0d1a05'], D: ['#3a4640', '#dfe7e1'], L: ['#ef4444', '#ffffff'] } as const;
const FIT_COLOURS = { natural: LIME, alt: '#facc15', out: '#ef4444' } as const;

// Division chips: the design's Bronze, Silver and Gold, and the rest in the same manner
const DIVISION_CHIPS: Record<number, [background: string, text: string]> = {
  1: ['#b9a6ff', '#140f24'],
  2: ['#cfe3ea', '#0f1517'],
  3: ['#facc15', '#1a1402'],
  4: ['#9aa3a0', '#101412'],
  5: ['#ea7a1e', '#1a0d02'],
  6: ['#6b7570', '#f1f4f2'],
  7: ['#8a8f8c', '#101412'],
  8: ['#86f0f2', '#06191a'],
  9: ['#fde047', '#1a1402'],
  10: ['#f97316', '#1a0d02'],
};

export const panelTitle = 'm-0 font-display text-xl font-bold';
export const capsLabel = 'text-[11px] font-bold uppercase tracking-[0.1em] text-muted-2';
export const limeButton =
  'h-10 px-4 rounded-xl border-0 bg-[#c6f432] text-[#0b1406] text-[13px] font-bold cursor-pointer hover:bg-[#dcff6e] disabled:opacity-50 disabled:cursor-not-allowed';
const percent = (value: number) => `${Math.round(value * 100)}%`;

const ResultDot: React.FC<{ result: 'W' | 'D' | 'L'; size?: string }> = ({ result, size = 'w-6 h-6' }) => (
  <span
    className={`${size} rounded-full grid place-items-center text-[11px] font-extrabold`}
    style={{ background: RESULT_COLOURS[result][0], color: RESULT_COLOURS[result][1] }}
  >
    {result}
  </span>
);

export const DivisionChip: React.FC<{ division: number | null | undefined }> = ({ division }) => {
  const [background, color] = (division && DIVISION_CHIPS[division]) || ['var(--chip)', 'var(--text3)'];
  return (
    <span className="flex-none h-5 px-2 rounded-full flex items-center text-[11px] font-bold" style={{ background, color }}>
      {clubsService.getDivisionName(division)}
    </span>
  );
};

/** A club's crest from MFL, or its initials while it loads or when it has none (a club not founded yet). */
const ClubLogo: React.FC<{ clubId: number; name: string; logoVersion?: string }> = ({ clubId, name, logoVersion }) => {
  const [logo, setLogo] = useState<'loading' | 'shown' | 'missing'>('loading');
  return (
    <span className="relative w-11 h-11 flex-none grid place-items-center">
      {logo !== 'shown' && (
        <span className="w-full h-full rounded-full bg-chip border border-line-2 grid place-items-center font-display text-sm font-extrabold text-fg-3">
          {name.split(/\s+/).map(word => word[0]).join('').slice(0, 2)}
        </span>
      )}
      {logo !== 'missing' && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`https://d13e14gtps4iwl.cloudfront.net/u/clubs/${clubId}/logo.webp${logoVersion ? `?v=${logoVersion}` : ''}`}
          alt=""
          draggable={false}
          onLoad={() => setLogo('shown')}
          onError={() => setLogo('missing')}
          className={`absolute inset-0 w-full h-full object-contain ${logo === 'shown' ? '' : 'invisible'}`}
        />
      )}
    </span>
  );
};

/** An opponent to pick, with when we play them and the formation they'll likely play. */
export const OpponentCard: React.FC<{
  clubId: number;
  name: string;
  logoVersion?: string;
  division: number | null | undefined;
  when: string;
  ovr: number | null;
  likely: FormationGuess | null;
  isLoading: boolean;
  error: string | null;
  selected: boolean;
  onSelect: () => void;
}> = ({ clubId, name, logoVersion, division, when, ovr, likely, isLoading, error, selected, onSelect }) => (
  <button
    type="button"
    onClick={onSelect}
    aria-pressed={selected}
    className={`flex items-center gap-3.5 px-4 py-3.5 rounded-[18px] border text-fg text-left cursor-pointer transition-colors hover:border-[#c6f432] ${
      selected ? 'border-[#c6f432] bg-[rgba(198,244,50,.07)]' : 'border-line bg-panel/92'
    }`}
  >
    <ClubLogo key={`${clubId}-${logoVersion}`} clubId={clubId} name={name} logoVersion={logoVersion} />
    <span className="flex-1 min-w-0 flex flex-col gap-[5px]">
      <span className="flex items-center gap-2 min-w-0">
        <span className="text-base font-bold truncate">{name}</span>
        {division !== undefined && <DivisionChip division={division} />}
      </span>
      <span className="text-xs font-medium text-muted">
        {error ? <span className="text-[#f87171]">{error}</span> : <>{when} · OVR {ovr !== null ? ovr.toFixed(1) : isLoading ? '…' : '–'}</>}
      </span>
    </span>
    {likely && (
      <span className="flex flex-col items-end gap-0.5">
        <span className="flex items-center gap-[5px]">
          <span className="text-[11px] font-semibold text-accent-ink">{percent(likely.probability)}</span>
          <span className="text-[10px] font-bold tracking-[0.08em] uppercase text-muted-3">Likely</span>
        </span>
        <span className="font-display text-base font-extrabold whitespace-nowrap">{formationLabel(likely.formation)}</span>
      </span>
    )}
  </button>
);

/** "2W 0D 1L" */
const record = (matches: ScoutMatch[]) =>
  (['W', 'D', 'L'] as const).map(result => `${matches.filter(match => matchResult(match) === result).length}${result}`).join(' ');

/**
 * The formations an opponent will likely play. Picking one (a row, or any formation from the list) plans against
 * it alone instead of the likely mix.
 */
export const LikelyFormationPanel: React.FC<{
  name: string;
  guesses: FormationGuess[];
  matches: ScoutMatch[];
  assumed: string | null;
  onAssume: (formation: string | null) => void;
}> = ({ name, guesses, matches, assumed, onAssume }) => {
  const [top] = guesses;
  return (
    <Panel className="p-[22px] flex flex-col gap-4">
      <h2 className={panelTitle}>{name} · Likely formation</h2>
      <div className="flex items-baseline gap-3 flex-wrap">
        <span className="font-display text-[48px] leading-none font-extrabold tracking-[-0.02em] text-accent-ink">{formationLabel(top.formation)}</span>
        <span className="text-lg font-bold">{percent(top.probability)} likely</span>
      </div>
      <div className="flex flex-col gap-1">
        {guesses.slice(0, 3).map((guess, index) => {
          const played = matches.filter(match => match.formation === guess.formation);
          const on = guess.formation === assumed;
          return (
            <button
              key={guess.formation}
              type="button"
              onClick={() => onAssume(on ? null : guess.formation)}
              aria-pressed={on}
              title={on ? 'Plan against their likely mix again' : `Plan against ${formationLabel(guess.formation)}`}
              className={`-mx-2.5 px-2.5 py-2 flex flex-col gap-[5px] rounded-xl border text-fg text-left cursor-pointer transition-colors hover:border-[#c6f432] ${
                on ? 'border-[#c6f432] bg-[rgba(198,244,50,.07)]' : 'border-transparent'
              }`}
            >
              <span className="grid grid-cols-[110px_minmax(0,1fr)_48px] items-center gap-3.5 w-full">
                <span className="text-[15px] font-bold truncate" title={formationLabel(guess.formation)}>
                  {formationLabel(guess.formation)}
                </span>
                <span className="h-2 rounded-full bg-line overflow-hidden" title={`${percent(guess.probability)} likely`}>
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${Math.max(1.5, guess.probability * 100)}%`, background: index ? 'var(--muted3)' : LIME }}
                  />
                </span>
                <span className="text-sm font-bold text-right">{percent(guess.probability)}</span>
              </span>
              <span className="text-xs font-medium text-muted">
                {played.length ? `Played ${played.length} of last ${matches.length} · ${record(played)}` : 'Not played lately'}
              </span>
            </button>
          );
        })}
      </div>
      <label className="flex items-center gap-2.5 flex-wrap text-xs font-semibold text-muted">
        Plan against
        <span className="relative block">
          <select
            value={assumed ?? ''}
            onChange={event => onAssume(event.target.value || null)}
            className="appearance-none h-8 pl-3 pr-8 rounded-lg border border-line-2 bg-field text-fg text-xs font-bold cursor-pointer outline-none"
          >
            <option value="">Their likely mix</option>
            {FORMATION_NAMES.map(formation => (
              <option key={formation} value={formation}>
                {formationLabel(formation)}
              </option>
            ))}
          </select>
          <svg className="absolute right-2.5 top-2.5 pointer-events-none stroke-muted" width="12" height="12" viewBox="0 0 24 24" fill="none" strokeWidth={2.4} aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </label>
    </Panel>
  );
};

const VERDICTS = [
  { upTo: 2, label: 'Predictable', colour: '#8ae63a', background: 'rgba(138,230,58,.12)' },
  { upTo: 5, label: 'Situational', colour: '#facc15', background: 'rgba(250,204,21,.12)' },
  { upTo: Infinity, label: 'Rotates often', colour: '#ef4444', background: 'rgba(239,68,68,.12)' },
];

/** The shape alone, "4-3-3" for "4-3-3_attack", to fit a narrow block */
const shape = (formation: string | null) => formation?.split('_')[0] ?? '?';

export const FormationChangePanel: React.FC<{ name: string; matches: ScoutMatch[]; likeliest: string }> = ({ name, matches, likeliest }) => {
  const latest = matches.slice(0, 10);
  const oldestFirst = [...latest].reverse();
  let changes = 0;
  let losses = 0;
  let changedAfterLoss = 0;
  const changed = oldestFirst.map((match, index) => {
    if (index === 0) return false;
    const before = oldestFirst[index - 1];
    const switched = match.formation !== before.formation;
    if (switched) changes++;
    if (matchResult(before) === 'L') {
      losses++;
      if (switched) changedAfterLoss++;
    }
    return switched;
  });
  let run = 0;
  while (run < latest.length && latest[run].formation === latest[0].formation) run++;
  const used = new Set(latest.map(match => match.formation));
  const verdict = VERDICTS.find(({ upTo }) => changes <= upTo)!;
  const kpis = [
    { label: 'Current run', value: `${run} ${run === 1 ? 'game' : 'games'}`, sub: `in ${latest[0] ? formationLabel(latest[0].formation ?? '?') : '–'}` },
    { label: 'Change after a loss', value: losses ? `${changedAfterLoss} / ${losses}` : '–', sub: 'switched after losing' },
    { label: 'Formations used', value: String(used.size), sub: `in the last ${latest.length} games` },
  ];
  const colourOf = (formation: string | null) => (!formation ? OTHER_FORMATION : formation === likeliest ? LIME : ORANGE);

  return (
    <Panel className="p-[22px] flex flex-col gap-[18px]">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className={panelTitle}>{name} · Formation change frequency</h2>
        <span className="h-7 px-3 rounded-full flex items-center text-xs font-bold" style={{ background: verdict.background, color: verdict.colour }}>
          {verdict.label}
        </span>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5">
        {kpis.map(kpi => (
          <div key={kpi.label} className="px-4 py-3.5 rounded-2xl bg-inset border border-line flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted">{kpi.label}</span>
            <span className="font-display text-[28px] leading-none font-extrabold">{kpi.value}</span>
            <span className="text-xs font-medium text-muted-3">{kpi.sub}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <div className={`flex justify-between ${capsLabel}`}>
          <span>Latest</span>
          <span>Oldest</span>
        </div>
        <div className="flex gap-1">
          {latest.map((match, index) => {
            const result = matchResult(match);
            const switched = changed[latest.length - 1 - index];
            return (
              <div
                key={match.id}
                title={`${result} ${match.goalsFor}-${match.goalsAgainst} vs ${match.opponent.name} · ${match.formation ? formationLabel(match.formation) : 'formation unknown'}`}
                className="flex-1 min-w-0 flex flex-col items-center gap-1.5"
              >
                <span className="h-3.5 text-[11px] leading-[14px] font-extrabold text-accent-ink">{switched ? '↻' : ''}</span>
                <span
                  className="w-full h-12 rounded-[10px] grid place-items-center font-display text-[13px] font-extrabold tracking-[-0.03em] text-[#0b1406] overflow-hidden whitespace-nowrap"
                  style={{ background: colourOf(match.formation) }}
                >
                  {shape(match.formation)}
                </span>
                <ResultDot result={result} size="w-[22px] h-[22px]" />
              </div>
            );
          })}
        </div>
        <div className="flex gap-3.5 flex-wrap pt-1">
          <span className="text-xs font-semibold text-muted">
            <span className="text-accent-ink">↻&nbsp;</span> formation changed
          </span>
        </div>
      </div>
    </Panel>
  );
};

/** How familiar the XI is with a formation's positions, as a coloured chip. */
function fitChip(pick: FormationPick): { label: string; colour: string; background: string } {
  if (pick.outOfPosition.length) return { label: `${pick.outOfPosition.length} out of position`, colour: '#ef4444', background: 'rgba(239,68,68,.12)' };
  if (pick.alternative.length) {
    const count = pick.alternative.length;
    return { label: `${count} alt position${count > 1 ? 's' : ''}`, colour: '#facc15', background: 'rgba(250,204,21,.12)' };
  }
  return { label: 'All natural positions', colour: '#8ae63a', background: 'rgba(138,230,58,.12)' };
}

/** Whole percentages of a win, draw and loss that add up to 100 */
export function wdl(pick: FormationPick): [number, number, number] {
  const win = Math.round(pick.win * 100);
  const draw = Math.round(pick.draw * 100);
  return [win, draw, 100 - win - draw];
}

export const CounterPanel: React.FC<{
  name: string;
  /** The one formation planned against, or null for their likely mix */
  against: string | null;
  picks: FormationPick[];
  selected: string;
  onSelect: (formation: string) => void;
}> = ({ name, against, picks, selected, onSelect }) => (
  <Panel className="p-[22px] flex flex-col gap-3.5">
    <div className="flex flex-col gap-1">
      <h2 className={panelTitle}>Your counter vs {name}</h2>
      <span className="text-[13px] font-medium text-muted">
        {against
          ? `Ranked by expected points if they play ${formationLabel(against)}, checked against your squad`
          : 'Ranked by expected points, weighted by their likely formations and checked against your squad'}
      </span>
    </div>
    {picks.slice(0, 3).map((pick, index) => {
      const on = pick.formation === selected;
      const [win, draw, loss] = wdl(pick);
      const chip = fitChip(pick);
      return (
        <button
          key={pick.formation}
          type="button"
          onClick={() => onSelect(pick.formation)}
          aria-pressed={on}
          className={`flex flex-col gap-3 px-[18px] py-4 rounded-[18px] border text-fg text-left cursor-pointer transition-colors hover:border-[#c6f432] ${
            on ? 'border-[#c6f432] bg-[rgba(198,244,50,.07)]' : 'border-line bg-inset'
          }`}
        >
          <span className="flex items-center gap-3.5 flex-wrap w-full">
            <span className="w-7 h-7 rounded-full grid place-items-center border border-line-2 text-[13px] font-extrabold text-fg-3">{index + 1}</span>
            <span className="font-display text-[26px] leading-none font-extrabold" style={{ color: on ? LIME : 'var(--text)' }}>
              {formationLabel(pick.formation)}
            </span>
            {index === 0 && <span className="h-[22px] px-[9px] rounded-full flex items-center bg-[#c6f432] text-[#0b1406] text-[11px] font-bold">Best pick</span>}
            <span className="flex-1" />
            <span className="flex flex-col items-end">
              <span className="font-display text-[28px] leading-none font-extrabold">{win}%</span>
              <span className="text-[11px] font-semibold text-muted">win chance</span>
            </span>
          </span>
          <span className="flex w-full h-2 rounded-full overflow-hidden gap-0.5" title={`Win ${win}% · Draw ${draw}% · Loss ${loss}%`}>
            <span style={{ width: `${win}%`, background: '#8ae63a' }} />
            <span style={{ width: `${draw}%`, background: '#56635c' }} />
            <span style={{ width: `${loss}%`, background: '#ef4444' }} />
          </span>
          <span className="flex items-center gap-3.5 flex-wrap text-xs font-semibold text-muted">
            <span>
              W {win}% · D {draw}% · L {loss}%
            </span>
            <span>
              <b className="text-fg">{pick.score.toFixed(2)}</b> pts/game
            </span>
            <span>
              XI avg <b className="text-fg">{pick.xiRating.toFixed(1)}</b>
            </span>
            <span className="h-[22px] px-[9px] rounded-full flex items-center text-[11px] font-bold" style={{ background: chip.background, color: chip.colour }}>
              {chip.label}
            </span>
          </span>
        </button>
      );
    })}
  </Panel>
);

const PITCH_LINE = 'rgba(255,255,255,.45)';
// Formations stand up the pitch with our goal at the bottom; the matchup lays it sideways, us attacking left to right
const ourX = (down: number) => 4 + (100 - down) * 0.46;
const ourY = (across: number) => 6 + across * 0.88;

/** A spot on the matchup pitch: the position in a ring, and below it who plays there and their rating at it. */
const PitchSpot: React.FC<{
  position: string;
  left: number;
  top: number;
  slot: FilledSlot | undefined;
  playersById: Map<number, MFLPlayer>;
  ours: boolean;
}> = ({ position, left, top, slot, playersById, ours }) => {
  const player = slot?.playerId ? playersById.get(slot.playerId) : undefined;
  const rating = player && Math.round(slot!.rating);
  return (
    <div
      title={
        player
          ? `${player.metadata.firstName} ${player.metadata.lastName} · ${rating} at ${position}${rating !== player.metadata.overall ? ` (overall ${player.metadata.overall})` : ''}`
          : position
      }
      className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5"
      style={{ left: `${left}%`, top: `${top}%` }}
    >
      <span
        className={`w-5 h-5 sm:w-[30px] sm:h-[30px] rounded-full grid place-items-center text-[7px] sm:text-[9px] font-extrabold ${ours ? 'text-white bg-[#0b1406]' : 'text-[#1a0d02]'}`}
        style={ours ? { border: `2px solid ${FIT_COLOURS[slot?.kind ?? 'out']}` } : { background: ORANGE, border: '2px solid rgba(0,0,0,.35)' }}
      >
        {position}
      </span>
      {/* On a phone the pitch is too narrow for 22 names, so it shows ratings alone */}
      {(player || ours) && (
        <span className="px-[3px] sm:px-[5px] py-px rounded-[5px] bg-black/60 text-[9px] sm:text-[10px] font-bold text-white whitespace-nowrap">
          <span className={player ? 'hidden sm:inline' : ''}>{player?.metadata.lastName ?? '—'}</span>
          {player && <span className={`sm:ml-1 ${ours ? 'text-[#c6f432]' : 'text-[#fdba74]'}`}>{rating}</span>}
        </span>
      )}
    </div>
  );
};

export const MatchupPanel: React.FC<{
  name: string;
  formation: string;
  theirFormation: string;
  fit: FormationFit | undefined;
  playersById: Map<number, MFLPlayer>;
  /** Their best XI in their formation, when we know their squad */
  theirFit: FormationFit | undefined;
  theirPlayersById: Map<number, MFLPlayer>;
  onOpenSquad: () => void;
}> = ({ name, formation, theirFormation, fit, playersById, theirFit, theirPlayersById, onOpenSquad }) => (
  <Panel className="p-[22px] flex flex-col gap-4">
    <div className="flex items-start justify-between gap-3 flex-wrap">
      <div className="flex flex-col gap-1">
        <span className={capsLabel}>Matchup</span>
        <span className="font-display text-2xl leading-[1.1] font-extrabold">
          <span className="text-accent-ink">{formationLabel(formation)}</span> <span className="text-muted-3 text-base">vs</span>{' '}
          <span className="text-[#fb923c]">{formationLabel(theirFormation)}</span>
        </span>
      </div>
      <button type="button" onClick={onOpenSquad} disabled={!fit} className={limeButton}>
        Open in Squad Builder
      </button>
    </div>
    <div
      className="relative aspect-[100/64] rounded-2xl overflow-hidden"
      style={{ background: 'repeating-linear-gradient(90deg,#0d3a22 0 10%,#104429 10% 20%)' }}
    >
      <div className="absolute inset-[4%] rounded-[3px]" style={{ border: `2px solid ${PITCH_LINE}` }} />
      <div className="absolute top-[4%] bottom-[4%] left-1/2 w-0.5" style={{ background: PITCH_LINE }} />
      <div className="absolute left-1/2 top-1/2 h-[26%] aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ border: `2px solid ${PITCH_LINE}` }} />
      <div className="absolute left-[4%] top-[24%] bottom-[24%] w-[13%]" style={{ border: `2px solid ${PITCH_LINE}`, borderLeft: 0 }} />
      <div className="absolute right-[4%] top-[24%] bottom-[24%] w-[13%]" style={{ border: `2px solid ${PITCH_LINE}`, borderRight: 0 }} />
      {FORMATIONS[theirFormation].map(([position, across, down], index) => (
        <PitchSpot
          key={`them-${index}`}
          position={position}
          left={100 - ourX(down)}
          top={100 - ourY(across)}
          slot={theirFit?.slots[index]}
          playersById={theirPlayersById}
          ours={false}
        />
      ))}
      {FORMATIONS[formation].map(([position, across, down], index) => (
        <PitchSpot key={`us-${index}`} position={position} left={ourX(down)} top={ourY(across)} slot={fit?.slots[index]} playersById={playersById} ours />
      ))}
    </div>
    <div className="flex gap-3.5 flex-wrap text-xs font-semibold text-muted">
      {(
        [
          ['Natural', FIT_COLOURS.natural],
          ['Alternative', FIT_COLOURS.alt],
          ['Out of position', FIT_COLOURS.out],
        ] as const
      ).map(([label, colour]) => (
        <span key={label} className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ border: `2px solid ${colour}` }} />
          {label}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: ORANGE }} />
        {name}
      </span>
    </div>
  </Panel>
);

export const RecentResultsPanel: React.FC<{ name: string; matches: ScoutMatch[]; ourClubId: number }> = ({ name, matches, ourClubId }) => (
  <Panel className="w-[calc((100%-22px)/2)] min-w-[min(100%,560px)] p-[22px] flex flex-col gap-1">
    <h2 className={`${panelTitle} mb-2.5`}>{name} · Recent results</h2>
    {matches.length === 0 && <p className="m-0 text-sm font-medium text-muted">No competitive matches yet.</p>}
    <div className="overflow-x-auto">
      {matches.map(match => {
        const result = matchResult(match);
        return (
          <div
            key={match.id}
            className="min-w-[400px] grid grid-cols-[26px_44px_84px_20px_84px_minmax(0,1fr)_auto] items-center gap-2.5 py-2 border-b border-divider"
          >
            <ResultDot result={result} />
            <span className="font-display text-[15px] font-extrabold">
              {match.goalsFor}-{match.goalsAgainst}
            </span>
            <span className="text-[13px] font-bold truncate" title={match.formation ? formationLabel(match.formation) : undefined}>
              {match.formation ? formationLabel(match.formation) : '?'}
            </span>
            <span className="text-xs font-medium text-muted-3">vs</span>
            <span className="text-[13px] font-bold text-fg-3 truncate" title={match.opponentFormation ? formationLabel(match.opponentFormation) : undefined}>
              {match.opponentFormation ? formationLabel(match.opponentFormation) : '?'}
            </span>
            <span className="flex items-center gap-2 min-w-0 text-[13px] font-medium text-muted">
              <span className="truncate">{match.opponent.name}</span>
              {match.opponent.clubId === ourClubId && (
                <span className="flex-none h-[18px] px-[7px] rounded-full flex items-center bg-[rgba(198,244,50,.14)] text-accent-ink text-[10px] font-bold">You</span>
              )}
            </span>
            <a
              href={`https://app.playmfl.com/matches/${match.id}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Open match on MFL"
              className="flex items-center gap-[5px] h-7 px-2.5 rounded-[9px] border border-line-2 text-xs font-bold text-fg-3 hover:border-[#c6f432] hover:text-[#c6f432]"
            >
              Match
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} aria-hidden="true">
                <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
              </svg>
            </a>
          </div>
        );
      })}
    </div>
  </Panel>
);
