import React, { useMemo, useState } from 'react';
import { useFormationMeta } from '../../hooks/useFormationMeta';
import { useScoutReport } from '../../hooks/useScoutReport';
import { clubsService } from '../../services/clubsService';
import { matchesService } from '../../services/matchesService';
import { parseClubId, type ScoutMatch, type ScoutReport } from '../../services/scoutService';
import {
  MIN_OWN_GAMES,
  matchResult,
  predictFormations,
  rankFormations,
  seasonField,
  splitByMatchDay,
  squadFits,
  type FormationFit,
  type FormationGuess,
  type FormationMeta,
  type FormationPick,
} from '../../utils/formationPlanner';
import { formationLabel } from '../../utils/squadLineups';
import { ClearButton, Panel, btnSecondary, fieldClass, linkClass } from '../ui';
import { ClubLogo } from './ClubLogo';

/** An opponent the club plays next, from its upcoming matches. */
export interface Fixture {
  clubId: number;
  name: string;
  logoVersion?: string;
  startDate: number;
  competition: string;
  home: boolean;
}

/** Matches of ours the planner reads, and of each opponent's */
const OUR_MATCHES = 15;
const THEIR_MATCHES = 10;
/** Clubs scouted by hand at once */
const MAX_OPPONENTS = 4;

const chipClass = 'inline-flex items-center h-6 px-2.5 rounded-full border text-[11px] font-bold whitespace-nowrap';
const RESULT_CHIP = {
  W: 'border-accent bg-accent text-accent-fg',
  D: 'border-chip-line bg-chip text-fg-3',
  L: 'border-red-500/45 bg-red-500/15 text-danger-ink',
};
const sectionTitle = 'm-0 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-2';

const ppg = (value: number) => value.toFixed(2);
const signed = (value: number) => `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(2)}`;
const percent = (value: number) => `${Math.round(value * 100)}%`;

/** W–D–L of a club's matches, e.g. against one formation. */
function record(matches: Pick<ScoutMatch, 'goalsFor' | 'goalsAgainst'>[]) {
  const results = matches.map(matchResult);
  return `${results.filter(r => r === 'W').length}W ${results.filter(r => r === 'D').length}D ${results.filter(r => r === 'L').length}L`;
}

const Spinner: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center gap-3 py-6 text-sm font-medium text-muted">
    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-accent" />
    {label}
  </div>
);

/** Share of a whole as a thin bar, with the number beside it. */
const ShareBar: React.FC<{ value: number; label: string }> = ({ value, label }) => (
  <span className="flex items-center gap-2 min-w-0" title={label}>
    <span className="relative flex-1 h-1.5 min-w-[3rem] rounded-full bg-chip overflow-hidden">
      <span className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${Math.max(2, value * 100)}%` }} />
    </span>
    <span className="w-9 text-right text-xs font-bold tabular-nums text-fg-2">{percent(value)}</span>
  </span>
);

/** Why a formation ranks where it does: each part of its expected points a game. */
const PickBreakdown: React.FC<{ pick: FormationPick; against: string }> = ({ pick, against }) => (
  <ul className="m-0 pl-4 flex flex-col gap-0.5 text-xs font-medium text-muted list-disc">
    <li>
      Meta: <span className="font-bold text-fg-2 tabular-nums">{ppg(pick.meta)}</span> pts/game {against}
    </li>
    <li>
      Squad fit: <span className="font-bold text-fg-2 tabular-nums">{signed(pick.fit)}</span>
      {pick.outOfPosition.length > 0 && <> · no natural {pick.outOfPosition.join(', ')}</>}
    </li>
    {pick.ourGames > 0 && (
      <li>
        Your results with it: <span className="font-bold text-fg-2 tabular-nums">{signed(pick.ourForm)}</span> on your other formations ({pick.ourGames}{' '}
        game{pick.ourGames === 1 ? '' : 's'})
      </li>
    )}
    {pick.theirGames > 0 && (
      <li>
        Teams playing it against them: <span className="font-bold text-fg-2 tabular-nums">{signed(pick.theirRecord)}</span> on their other opponents (
        {pick.theirGames} game{pick.theirGames === 1 ? '' : 's'})
      </li>
    )}
  </ul>
);

/** The top pick large, with the runners-up and the one to avoid under it. */
const PickSummary: React.FC<{ picks: FormationPick[]; against: string; current?: string }> = ({ picks, against, current }) => {
  const [best, ...rest] = picks;
  const worst = picks[picks.length - 1];
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-display text-[28px] font-extrabold leading-none tracking-[-0.02em] text-accent-ink">{formationLabel(best.formation)}</span>
        <span className="text-sm font-semibold text-fg-2">
          <span className="tabular-nums">{ppg(best.score)}</span> pts/game expected in an even match
        </span>
        {current === best.formation && <span className={`${chipClass} border-pos-line bg-btn-pos text-pos-ink`}>What you play now</span>}
      </div>
      <PickBreakdown pick={best} against={against} />
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-muted">
        <span>
          Also good:{' '}
          {rest.slice(0, 2).map((pick, index) => (
            <span key={pick.formation}>
              {index > 0 && ', '}
              <span className="font-bold text-fg-2">{formationLabel(pick.formation)}</span> <span className="tabular-nums">{ppg(pick.score)}</span>
            </span>
          ))}
        </span>
        <span>
          Avoid: <span className="font-bold text-danger-ink">{formationLabel(worst.formation)}</span>{' '}
          <span className="tabular-nums">{ppg(worst.score)}</span>
        </span>
      </div>
    </div>
  );
};

/** The formation a club played most in its recent matches. */
function mostPlayed(matches: ScoutMatch[]): { formation: string; times: number } | null {
  const counts = new Map<string, number>();
  for (const match of matches) if (match.formation) counts.set(match.formation, (counts.get(match.formation) ?? 0) + 1);
  const [formation, times] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
  return formation ? { formation, times: times! } : null;
}

const SeasonPick: React.FC<{ report: ScoutReport; fits: Map<string, FormationFit>; meta: FormationMeta }> = ({ report, fits, meta }) => {
  const picks = useMemo(() => rankFormations(seasonField(report.matches, meta), fits, report.matches, [], meta), [report, fits, meta]);
  const usual = mostPlayed(report.matches);
  const bestFit = [...fits.values()].find(fit => fit.gap === 0);
  return (
    <div className="flex flex-col gap-3 p-[18px] rounded-[18px] border border-line bg-inset">
      <h3 className={sectionTitle}>Best formation for {report.season ?? 'next season'}</h3>
      <PickSummary picks={picks} against="against the field" current={usual?.formation} />
      <p className="m-0 text-xs font-medium text-muted-3">
        The field is the formations you faced lately, blended with the whole game&apos;s.
        {usual && (
          <>
            {' '}
            You played {formationLabel(usual.formation)} in {usual.times} of your last {report.matches.length}.
          </>
        )}
        {bestFit && (
          <>
            {' '}
            Your squad&apos;s strongest XI on paper is {formationLabel(bestFit.formation)} (avg <span className="tabular-nums">{bestFit.rating.toFixed(1)}</span>).
          </>
        )}
      </p>
    </div>
  );
};

const LikelyFormations: React.FC<{ guesses: FormationGuess[]; matchesRead: number; ours: ScoutMatch[] }> = ({ guesses, matchesRead, ours }) => (
  <div className="flex flex-col gap-2">
    <h4 className={sectionTitle}>Likely formation</h4>
    {guesses.slice(0, 3).map(guess => {
      const yours = ours.filter(match => match.opponentFormation === guess.formation);
      return (
        <div key={guess.formation} className="flex flex-col gap-0.5">
          <div className="grid grid-cols-[minmax(0,7.5rem)_1fr] items-center gap-3">
            <span className="truncate text-sm font-bold text-fg">{formationLabel(guess.formation)}</span>
            <ShareBar value={guess.probability} label={`${percent(guess.probability)} likely`} />
          </div>
          <span className="text-[11px] font-medium text-muted-3">
            {guess.timesPlayed > 0 ? `Played in ${guess.timesPlayed} of their last ${matchesRead}` : 'Not played lately'}
            {guess.fit && guess.fit.outOfPosition.length > 0 && <> · no natural {guess.fit.outOfPosition.join(', ')}</>}
            {yours.length > 0 && <> · you vs it: {record(yours)}</>}
          </span>
        </div>
      );
    })}
  </div>
);

const RecentResults: React.FC<{ matches: ScoutMatch[] }> = ({ matches }) => {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? matches : matches.slice(0, 5);
  return (
    <div className="flex flex-col gap-1.5">
      <h4 className={sectionTitle}>Their recent results</h4>
      {matches.length === 0 && <p className="m-0 text-xs font-medium text-muted">No competitive matches yet.</p>}
      {shown.map(match => {
        const result = matchResult(match);
        return (
          <div key={match.id} className="flex items-center gap-2 text-xs font-medium text-muted min-w-0" title={`${match.competition} · ${matchesService.formatMatchDate(match.startDate)}`}>
            <span className={`${chipClass} flex-none w-6 justify-center px-0 ${RESULT_CHIP[result]}`}>{result}</span>
            <span className="flex-none w-9 tabular-nums font-bold text-fg-2">
              {match.goalsFor}-{match.goalsAgainst}
            </span>
            <span className="flex-none font-semibold text-fg-3">{match.formation ? formationLabel(match.formation) : '?'}</span>
            <span className="flex-none text-faint">vs</span>
            <span className="flex-none font-semibold text-fg-3">{match.opponentFormation ? formationLabel(match.opponentFormation) : '?'}</span>
            <span className="truncate text-muted-3">{match.opponent.name}</span>
          </div>
        );
      })}
      {matches.length > 5 && (
        <button type="button" onClick={() => setShowAll(!showAll)} className={`self-start text-xs font-semibold cursor-pointer ${linkClass}`}>
          {showAll ? 'Show fewer' : `Show all ${matches.length}`}
        </button>
      )}
    </div>
  );
};

const OpponentCard: React.FC<{
  clubId: number;
  name: string;
  logoVersion?: string;
  fixture?: Fixture;
  ours: ScoutReport | null;
  ourFits: Map<string, FormationFit>;
  meta: FormationMeta;
  onRemove?: () => void;
}> = ({ clubId, name, logoVersion, fixture, ours, ourFits, meta, onRemove }) => {
  const { report, error, isLoading } = useScoutReport(clubId, THEIR_MATCHES);
  const theirFits = useMemo(() => squadFits(report?.players ?? []), [report]);
  const guesses = useMemo(() => (report ? predictFormations(report.matches, theirFits, meta) : []), [report, theirFits, meta]);
  const picks = useMemo(
    () => (report && ours ? rankFormations(guesses, ourFits, ours.matches, report.matches, meta) : []),
    [report, ours, guesses, ourFits, meta],
  );
  const clubName = report?.club.name ?? name;
  const likely = guesses[0];

  return (
    <div className="flex flex-col gap-4 p-[18px] rounded-[18px] border border-line bg-inset min-w-0">
      <div className="flex items-start gap-3">
        <ClubLogo clubId={clubId} name={clubName} logoVersion={report?.club.logoVersion ?? logoVersion} className="w-11 h-11" />
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <span className="truncate text-[15px] font-bold text-fg">{clubName}</span>
          <span className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-muted">
            {report && (
              <span className={`inline-flex items-center h-[18px] px-2 rounded-full text-[10px] font-bold ${clubsService.getDivisionColor(report.club.division)}`}>
                {clubsService.getDivisionName(report.club.division)}
              </span>
            )}
            {fixture ? (
              <>
                {matchesService.formatMatchDate(fixture.startDate)} · {fixture.home ? 'Home' : 'Away'}
                {fixture.competition && <> · {fixture.competition}</>}
              </>
            ) : (
              'Scouted'
            )}
          </span>
        </div>
        {onRemove && <ClearButton onClear={onRemove} label={`Stop scouting ${clubName}`} />}
      </div>

      {isLoading && <Spinner label={`Scouting ${clubName}…`} />}
      {error && <p className="m-0 text-sm font-semibold text-danger-ink">{error}</p>}

      {report && (
        <>
          <LikelyFormations guesses={guesses} matchesRead={report.matches.length} ours={ours?.matches ?? []} />
          {picks.length > 0 ? (
            <div className="flex flex-col gap-2 pt-3 border-t border-divider">
              <h4 className={sectionTitle}>Your counter</h4>
              <PickSummary picks={picks} against={`against their likely ${formationLabel(likely.formation)}${guesses[1] ? ' and others' : ''}`} />
            </div>
          ) : (
            !ours && <Spinner label="Reading your squad…" />
          )}
          <RecentResults matches={report.matches} />
        </>
      )}
    </div>
  );
};

/** Adds a club to scout by its ID or a link to it. */
const ScoutForm: React.FC<{ onScout: (clubId: number) => void; disabled: boolean }> = ({ onScout, disabled }) => {
  const [text, setText] = useState('');
  const [invalid, setInvalid] = useState(false);
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const clubId = parseClubId(text);
    setInvalid(!clubId);
    if (clubId) {
      onScout(clubId);
      setText('');
    }
  };
  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <input
        value={text}
        onChange={event => {
          setText(event.target.value);
          setInvalid(false);
        }}
        placeholder="Club ID or MFL club link"
        aria-label="Club ID or MFL club link"
        className={`${fieldClass} w-[260px] max-w-full`}
      />
      <button type="submit" className={btnSecondary} disabled={disabled || !text.trim()}>
        Scout club
      </button>
      {invalid && <span className="text-xs font-semibold text-danger-ink">Paste a club ID, or a link with /clubs/ and its ID</span>}
    </form>
  );
};

/** Where the meta comes from: ours, or the mfl-coach snapshot while ours is still small. */
const MetaSource: React.FC<{ meta: FormationMeta; own: { games: number; engine: string } | null }> = ({ meta, own }) => (
  <p className="m-0 text-[11px] font-medium text-muted-3">
    {meta.source === 'mfldata' ? (
      <>
        Formation meta from {meta.matches.toLocaleString()} MFL matches · engine {meta.engine} · teams within {meta.maxOvrDifference} OVR · updated daily
      </>
    ) : (
      <>
        Formation meta from{' '}
        <a href={meta.source} target="_blank" rel="noopener noreferrer" className={linkClass}>
          mfl-coach.com
        </a>{' '}
        ({meta.matches.toLocaleString()} matches, {meta.fetchedAt}) · engine {meta.engine} · teams within {meta.maxOvrDifference} OVR
        {own && (
          <>
            {' '}
            · ours: {own.games.toLocaleString()} of {MIN_OWN_GAMES.toLocaleString()} matches on engine {own.engine}
          </>
        )}
      </>
    )}
  </p>
);

/**
 * Which formation to play: next season overall, and against each of the next opponents. Opponents are the next
 * match day's fixtures (more at a click), and any club can be scouted by hand, e.g. before the fixtures are out.
 */
export const FormationPlanner: React.FC<{ clubId: number; clubName: string; fixtures: Fixture[] }> = ({ clubId, clubName, fixtures: upcoming }) => {
  const { meta, own } = useFormationMeta();
  const { report: ours, error, isLoading } = useScoutReport(clubId, OUR_MATCHES);
  const ourFits = useMemo(() => squadFits(ours?.players ?? []), [ours]);
  const [scouted, setScouted] = useState<{ clubId: number; name: string; logoVersion?: string }[]>([]);
  const [showLater, setShowLater] = useState(false);

  const { next, later } = splitByMatchDay(upcoming);
  const fixtures = showLater ? upcoming : next;
  const fixtureIds = new Set(fixtures.map(fixture => fixture.clubId));
  const extra = scouted.filter(club => !fixtureIds.has(club.clubId));
  const full = extra.length >= MAX_OPPONENTS;
  const scout = (club: { clubId: number; name: string; logoVersion?: string }) => {
    if (club.clubId === clubId || fixtureIds.has(club.clubId)) return;
    setScouted(current => (current.some(item => item.clubId === club.clubId) ? current : [...current, club]).slice(0, MAX_OPPONENTS));
  };

  // Recent opponents, to scout with a click
  const recentOpponents = useMemo(() => {
    const seen = new Set<number>();
    return (ours?.matches ?? [])
      .map(match => match.opponent)
      .filter(opponent => !seen.has(opponent.clubId) && seen.add(opponent.clubId))
      .slice(0, 8);
  }, [ours]);

  return (
    <Panel className="flex flex-col gap-4 p-[18px]">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 className="m-0 font-display text-xl font-bold text-fg">Formation planner</h2>
          <p className="m-0 text-[13px] font-medium text-muted">
            For {clubName}: what to play next season, and how to counter your next opponents.
          </p>
        </div>
        <MetaSource meta={meta} own={own} />
      </div>

      {isLoading && <Spinner label="Reading your squad and recent formations…" />}
      {error && <p className="m-0 text-sm font-semibold text-danger-ink">Couldn&apos;t load your squad: {error}</p>}
      {ours && <SeasonPick report={ours} fits={ourFits} meta={meta} />}

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className={sectionTitle}>{showLater ? 'Upcoming opponents' : 'Next match day'}</h3>
          {later.length > 0 && (
            <button type="button" onClick={() => setShowLater(!showLater)} className={`text-xs font-semibold cursor-pointer ${linkClass}`}>
              {showLater ? 'Only the next match day' : `Show ${later.length} more upcoming opponent${later.length === 1 ? '' : 's'}`}
            </button>
          )}
        </div>
        {fixtures.length === 0 && (
          <p className="m-0 text-[13px] font-medium text-muted">
            No upcoming fixtures yet. They show here once {ours?.season ?? 'the season'}&apos;s schedule is out. Until then, scout any club.
          </p>
        )}
        {(fixtures.length > 0 || extra.length > 0) && (
          <div className="grid gap-3 md:grid-cols-2">
            {fixtures.map(fixture => (
              <OpponentCard
                key={fixture.clubId}
                clubId={fixture.clubId}
                name={fixture.name}
                logoVersion={fixture.logoVersion}
                fixture={fixture}
                ours={ours}
                ourFits={ourFits}
                meta={meta}
              />
            ))}
            {extra.map(club => (
              <OpponentCard
                key={club.clubId}
                clubId={club.clubId}
                name={club.name}
                logoVersion={club.logoVersion}
                ours={ours}
                ourFits={ourFits}
                meta={meta}
                onRemove={() => setScouted(current => current.filter(item => item.clubId !== club.clubId))}
              />
            ))}
          </div>
        )}
        <ScoutForm onScout={id => scout({ clubId: id, name: `Club ${id}` })} disabled={full} />
        {recentOpponents.length > 0 && !full && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-muted">Recent opponents:</span>
            {recentOpponents
              .filter(opponent => !fixtureIds.has(opponent.clubId) && !extra.some(club => club.clubId === opponent.clubId))
              .map(opponent => (
                <button
                  key={opponent.clubId}
                  type="button"
                  onClick={() => scout(opponent)}
                  className={`${chipClass} gap-1.5 pl-1 border-chip-line bg-chip text-fg-3 cursor-pointer hover:border-line-hover`}
                >
                  <ClubLogo clubId={opponent.clubId} name={opponent.name} logoVersion={opponent.logoVersion} className="w-4 h-4" />
                  {opponent.name}
                </button>
              ))}
          </div>
        )}
        {full && <p className="m-0 text-xs font-medium text-muted-3">Scouting {MAX_OPPONENTS} clubs by hand at most. Remove one to scout another.</p>}
      </div>

      <details className="text-xs font-medium text-muted">
        <summary className="cursor-pointer font-semibold text-fg-3">How the planner works</summary>
        <ul className="mt-2 mb-0 pl-4 flex flex-col gap-1 list-disc">
          <li>
            The meta is how every formation did against every other in {meta.matches.toLocaleString()} matches on engine {meta.engine}, between teams within{' '}
            {meta.maxOvrDifference} OVR. A pairing with few games is pulled toward how the two formations do overall. Until our own meta, read daily from MFL, reaches{' '}
            {MIN_OWN_GAMES.toLocaleString()} matches, it&apos;s mfl-coach&apos;s.
          </li>
          <li>
            A club&apos;s likely formation is mostly what it played lately, the latest counting most. Formations its squad can&apos;t line up in, such as three up front with no
            wingers, are marked down, using each squad&apos;s best XI in every formation.
          </li>
          <li>
            Your counter is the formation with the most expected points a game against their likely ones in an even match, adjusted for how your squad lines up in it
            (about 0.1 pts/game per OVR across the XI), how much better you did with it than with your other formations, and how much better teams playing it did against
            them than their other opponents did. A strong team wins whatever it plays, so only a formation&apos;s edge over the others counts.
          </li>
          <li>Recent results are your last {OUR_MATCHES} and their last {THEIR_MATCHES} competitive matches. A handful of games only nudges the meta.</li>
        </ul>
      </details>
    </Panel>
  );
};
