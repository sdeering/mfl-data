"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '../contexts/WalletContext';
import { matchesService, type MFLMatch } from '../services/matchesService';
import { clubsService, type MFLClubData } from '../services/clubsService';
import type { ScoutReport } from '../services/scoutService';
import { useScoutReport } from '../hooks/useScoutReport';
import { useFormationMeta } from '../hooks/useFormationMeta';
import {
  MIN_OWN_GAMES,
  likelyRating,
  predictFormations,
  rankFormations,
  splitByMatchDay,
  rankForOutcome,
  isOutcome,
  type Outcome,
  squadFits,
  type FormationFit,
  type FormationMeta,
} from '../utils/formationPlanner';
import { autoFillLineup } from '../utils/squadLineups';
import { addDraftLineup } from '../utils/squadDraft';
import type { MFLPlayer } from '../types/mflApi';
import { Panel, btnSecondary, linkClass } from './ui';
import WalletGate from './WalletGate';
import {
  CounterPanel,
  FormationChangePanel,
  LIKELY_MIX,
  LikelyFormationPanel,
  MatchupPanel,
  OpponentCard,
  RecentResultsPanel,
  capsLabel,
  limeButton,
} from './matches/MatchPrep';
import { AiAnalysisPanel, SquadComparisonPanel } from './matches/MatchAnalysisPanels';
import { TacticsLogPanel } from './matches/TacticsLog';
import { useTacticsLog, type TacticsLogState } from '../hooks/useTacticsLog';
import { compareSquads, findWeaknesses, xiPlayers } from '../utils/squadComparison';

/** Matches of ours the tool reads, and of each opponent's */
const OUR_MATCHES = 15;
const THEIR_MATCHES = 10;
/** Upcoming opponents it can show, the next match day's included */
const MAX_UPCOMING = 5;
/** localStorage key for each of our clubs' aim: win, smash or not lose */
const AIMS_KEY = 'mfldata.matchAims';

/** A club to prepare for: one we play next, or one scouted by its ID. */
interface Opponent {
  clubId: number;
  name: string;
  when: string;
  /** The fixture's match, and its day, for an opponent we play next */
  matchId?: number;
  day?: string;
  scouted?: boolean;
}

const COMPETITION_KINDS: Record<string, string> = { LEAGUE: 'League', CUP: 'Cup' };

const Spinner: React.FC<{ label: string }> = ({ label }) => (
  <Panel className="flex items-center justify-center gap-3 px-6 py-14">
    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent" />
    <span className="text-[15px] font-medium text-muted">{label}</span>
  </Panel>
);

/** An opponent's card, with their division, OVR and likely formation once they are scouted. */
const OpponentChoice: React.FC<{ opponent: Opponent; meta: FormationMeta; selected: boolean; onSelect: () => void; onRemove?: () => void }> = ({
  opponent,
  meta,
  selected,
  onSelect,
  onRemove,
}) => {
  const { report, error, isLoading } = useScoutReport(opponent.clubId, THEIR_MATCHES);
  const fits = useMemo(() => squadFits(report?.players ?? []), [report]);
  const likely = useMemo(() => (report ? predictFormations(report.matches, fits, meta)[0] : null), [report, fits, meta]);
  return (
    <OpponentCard
      clubId={opponent.clubId}
      name={report?.club.name ?? opponent.name}
      logoVersion={report?.club.logoVersion}
      division={report ? report.club.division : undefined}
      when={report?.club.founded === false ? `${opponent.when} · Not founded` : opponent.when}
      ovr={fits.size ? Math.max(...[...fits.values()].map(fit => fit.rating)) : report?.recentOvr ?? null}
      likely={likely}
      isLoading={isLoading}
      error={error}
      selected={selected}
      onSelect={onSelect}
      onRemove={onRemove}
    />
  );
};

const panelRow = 'grid gap-[22px] items-stretch grid-cols-[repeat(auto-fit,minmax(min(100%,560px),1fr))]';

/** Everything about the picked opponent: their likely formation and how often they change it, our counters, the matchup, their results. */
const OpponentPrep: React.FC<{
  opponent: Opponent;
  ourClubId: number;
  ours: ScoutReport | null;
  ourFits: Map<string, FormationFit>;
  ourPlayersById: Map<number, MFLPlayer>;
  meta: FormationMeta;
  pick: string | undefined;
  onPick: (formation: string) => void;
  /** What the user picked to plan against: a formation or LIKELY_MIX, undefined for their likeliest formation */
  against: string | undefined;
  onAgainst: (against: string) => void;
  onOpenSquad: (opponentName: string, formation: string) => void;
  tactics: TacticsLogState;
  /** Whether the connected wallet owns our club, so it can log tactics */
  canLog: boolean;
  /** What our club wants from its matches: win, smash or not lose */
  outcome: Outcome;
  onOutcome: (outcome: Outcome) => void;
}> = ({ opponent, ourClubId, ours, ourFits, ourPlayersById, meta, pick, onPick, against: picked, onAgainst, onOpenSquad, tactics, canLog, outcome, onOutcome }) => {
  const { report, error, isLoading } = useScoutReport(opponent.clubId, THEIR_MATCHES);
  const theirFits = useMemo(() => squadFits(report?.players ?? []), [report]);
  const theirPlayersById = useMemo(() => new Map((report?.players ?? []).map(player => [player.id, player])), [report]);
  const guesses = useMemo(() => (report ? predictFormations(report.matches, theirFits, meta) : []), [report, theirFits, meta]);
  const against = picked ?? guesses[0]?.formation ?? LIKELY_MIX;
  const ranked = useMemo(() => {
    if (!report || !ours) return [];
    const guess = guesses.find(item => item.formation === against);
    // Their strength: their XI in the formation, or the XI their squad will likely field, or without a squad now,
    // the XIs they fielded lately
    return guess
      ? rankFormations([{ ...guess, probability: 1 }], ourFits, ours.matches, report.matches, meta, guess.fit?.rating ?? report.recentOvr)
      : rankFormations(guesses, ourFits, ours.matches, report.matches, meta, likelyRating(guesses) ?? report.recentOvr);
  }, [report, ours, guesses, against, ourFits, meta]);
  // Best first for what we want from the match
  const picks = useMemo(() => rankForOutcome(ranked, outcome), [ranked, outcome]);

  // Our XI against theirs in the formations picked, and their weak spots
  const likeliestFormation = guesses[0]?.formation;
  const comparedAgainst = against === LIKELY_MIX ? likeliestFormation : against;
  const comparedOurs = picks.some(item => item.formation === pick) ? pick : picks[0]?.formation;
  const comparison = useMemo(() => {
    if (!report || !ours || !comparedOurs || !comparedAgainst) return null;
    const ourXi = xiPlayers(comparedOurs, ourFits.get(comparedOurs), ourPlayersById);
    const theirXi = xiPlayers(comparedAgainst, theirFits.get(comparedAgainst), theirPlayersById);
    if (!ourXi.length || !theirXi.length) return null;
    const withCaptain = { ours: ourFits.get(comparedOurs)?.rating ?? null, theirs: theirFits.get(comparedAgainst)?.rating ?? null };
    return { squads: compareSquads(ourXi, theirXi, ours.players, report.players, withCaptain), weaknesses: findWeaknesses(ourXi, theirXi, report.matches) };
  }, [report, ours, comparedOurs, comparedAgainst, ourFits, theirFits, ourPlayersById, theirPlayersById]);

  if (isLoading) return <Spinner label={`Scouting ${opponent.name}…`} />;
  if (error || !report) {
    return (
      <Panel className="px-5 py-4">
        <p className="m-0 text-sm font-semibold text-danger-ink">{error ?? `Couldn't scout ${opponent.name}`}</p>
      </Panel>
    );
  }

  const name = report.club.name;
  const likeliest = guesses[0].formation;
  const theirFormation = against === LIKELY_MIX ? likeliest : against;
  const selected = picks.some(item => item.formation === pick) ? pick! : picks[0]?.formation;
  return (
    <>
      <div className={panelRow}>
        <LikelyFormationPanel name={name} guesses={guesses} matches={report.matches} against={against} onAgainst={onAgainst} />
        {report.matches.length > 0 && <FormationChangePanel name={name} matches={report.matches} likeliest={likeliest} />}
      </div>
      {selected ? (
        <div className={panelRow}>
          <CounterPanel name={name} against={against === LIKELY_MIX ? null : against} picks={picks}
            fits={ourFits}
            playersById={ourPlayersById}
            outcome={outcome}
            onOutcome={onOutcome}
            selected={selected}
            onSelect={onPick}
          />
          <MatchupPanel
            name={name}
            formation={selected}
            theirFormation={theirFormation}
            fit={ourFits.get(selected)}
            playersById={ourPlayersById}
            theirFit={theirFits.get(theirFormation)}
            theirPlayersById={theirPlayersById}
            onOpenSquad={() => onOpenSquad(name, selected)}
          />
        </div>
      ) : (
        <Spinner label="Reading your squad…" />
      )}
      <div className={panelRow}>
        <RecentResultsPanel name={name} matches={report.matches} ourClubId={ourClubId} />
        {comparison && selected && (
          <SquadComparisonPanel name={name} ourFormation={selected} theirFormation={theirFormation} comparison={comparison.squads} weaknesses={comparison.weaknesses} />
        )}
      </div>
      {selected && (
        <AiAnalysisPanel
          name={name}
          request={{
            ourClubId,
            theirClubId: report.club.id,
            ourFormation: selected,
            theirFormation,
            aim: outcome,
            // So the advice is kept for the fixture when the owner asks
            matchId: opponent.matchId,
            walletAddress: canLog ? (tactics.walletAddress ?? undefined) : undefined,
            counters: picks.slice(0, 5).map(item => ({
              formation: item.formation,
              win: item.win,
              draw: item.draw,
              loss: item.loss,
              points: item.score,
              goalsFor: item.goalsFor,
              goalsAgainst: item.goalsAgainst,
            })),
          }}
          onUseFormation={onPick}
          history={tactics.history}
          fixture={opponent.matchId && opponent.day ? { matchId: opponent.matchId, when: opponent.day } : undefined}
          onSaveSettings={canLog ? tactics.save : undefined}
          playersById={ourPlayersById}
          onAdviceSaved={tactics.refresh}
        />
      )}
    </>
  );
};

const MatchesPage: React.FC = () => {
  const router = useRouter();
  const { isConnected, account, isVerified } = useWallet();
  // Only the visitor's own wallet, proved to the server: the page shows their tactics and spends AI analyses
  const walletAddress = isConnected && isVerified ? account : null;
  const [clubs, setClubs] = useState<MFLClubData[]>([]);
  const [clubId, setClubId] = useState<number | null>(null);
  const [isLoadingClubs, setIsLoadingClubs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [upcomingMatches, setUpcomingMatches] = useState<MFLMatch[]>([]);
  const [showLater, setShowLater] = useState(false);
  const [scouted, setScouted] = useState<number[]>([]);
  const [clubQuery, setClubQuery] = useState('');
  const [clubError, setClubError] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  // The counter picked against each opponent, and what was picked to plan against when not their likeliest
  // formation, by club ID
  const [picks, setPicks] = useState<Record<number, string>>({});
  const [plannedAgainst, setPlannedAgainst] = useState<Record<number, string>>({});
  // What each of our clubs wants from its matches, remembered in this browser
  const [aims, setAims] = useState<Record<number, Outcome>>({});
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(AIMS_KEY) ?? '{}');
      if (saved && typeof saved === 'object') {
        setAims(Object.fromEntries(Object.entries(saved).filter(([, aim]) => isOutcome(aim))) as Record<number, Outcome>);
      }
    } catch {
      // No storage, or a bad entry: every club aims to win
    }
  }, []);
  const setAim = (club: number, aim: Outcome) =>
    setAims(current => {
      const next = { ...current, [club]: aim };
      try {
        window.localStorage.setItem(AIMS_KEY, JSON.stringify(next));
      } catch {
        // Kept for this visit only
      }
      return next;
    });
  const planAgainst = (opponentId: number, against: string) => {
    setPlannedAgainst(current => ({ ...current, [opponentId]: against }));
    // Show the best counter to it rather than one picked against something else
    setPicks(current => Object.fromEntries(Object.entries(current).filter(([id]) => Number(id) !== opponentId)));
  };

  const { meta, own } = useFormationMeta();
  const { report: ours, error: ourError } = useScoutReport(clubId, OUR_MATCHES);
  // Logging is for the verified wallet's own clubs, which are the only ones this page shows
  const canLog = !!walletAddress;
  const tactics = useTacticsLog(clubId, canLog ? account : null);
  const ourFits = useMemo(() => squadFits(ours?.players ?? []), [ours]);
  const ourPlayersById = useMemo(() => new Map((ours?.players ?? []).map(player => [player.id, player])), [ours]);

  useEffect(() => {
    if (!walletAddress) return;
    let cancelled = false;
    setIsLoadingClubs(true);
    setError(null);
    clubsService
      .fetchClubsForWallet(walletAddress)
      .then(data => {
        if (cancelled) return;
        // Top division first
        const sorted = [...data].sort((a, b) => (a.club.division || 99) - (b.club.division || 99));
        setClubs(sorted);
        setClubId(current => (sorted.some(item => item.club.id === current) ? current : sorted[0]?.club.id ?? null));
      })
      .catch(() => !cancelled && setError('Failed to load clubs data'))
      .finally(() => !cancelled && setIsLoadingClubs(false));
    return () => {
      cancelled = true;
    };
  }, [walletAddress, retry]);

  useEffect(() => {
    if (!clubId) return;
    let cancelled = false;
    setUpcomingMatches([]);
    matchesService
      .fetchUpcomingMatches(String(clubId))
      .then(matches => !cancelled && setUpcomingMatches(matches))
      .catch(err => console.error('Error fetching upcoming matches:', err));
    return () => {
      cancelled = true;
    };
  }, [clubId]);

  // The clubs we play next in competitions, soonest first
  const fixtures = useMemo(() => {
    const next: (Opponent & { startDate: number; competition: string })[] = [];
    // Leave out a match once it kicks off, even if a cached list still has it as planned, so the next one shows
    const now = Date.now();
    const planned = upcomingMatches.filter(
      match => match.type !== 'FRIENDLY' && match.status !== 'LIVE' && match.status !== 'ENDED' && match.startDate > now,
    );
    for (const match of planned.sort((a, b) => a.startDate - b.startDate)) {
      const home = match.homeSquad?.club?.id === clubId;
      const opponent = home ? match.awaySquad?.club : match.homeSquad?.club;
      if (!opponent || opponent.id === clubId || next.some(fixture => fixture.clubId === opponent.id)) continue;
      const kind = COMPETITION_KINDS[match.competition?.type] ?? match.competition?.name ?? 'Match';
      const day = new Date(match.startDate).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
      next.push({
        clubId: opponent.id,
        name: home ? match.awayTeamName : match.homeTeamName,
        when: `${kind} · ${day} · ${home ? 'Home' : 'Away'}`,
        matchId: match.id,
        day,
        startDate: match.startDate,
        competition: match.competition?.type ?? match.type,
      });
    }
    return next;
  }, [upcomingMatches, clubId]);

  // The next match day's opponents and the next in each other competition (a league and a cup), more at a click,
  // then those scouted
  const { next, later } = splitByMatchDay(fixtures, MAX_UPCOMING);
  const opponents: Opponent[] = [
    ...(showLater ? fixtures.filter(fixture => next.includes(fixture) || later.includes(fixture)) : next),
    ...scouted.filter(id => !fixtures.some(fixture => fixture.clubId === id)).map(id => ({ clubId: id, name: `Club ${id}`, when: `Scouted · Club ID ${id}`, scouted: true })),
  ];
  const selected = opponents.find(opponent => opponent.clubId === selectedId) ?? opponents[0];

  const scout = (id: number) => {
    if (id === clubId) return setClubError("That's your own club");
    setScouted(current => (current.includes(id) ? current : [...current, id]));
    setSelectedId(id);
    setClubQuery('');
    setClubError('');
  };
  const loadClub = () => {
    const query = clubQuery.trim();
    if (!/^\d{1,9}$/.test(query)) return setClubError('Enter a numeric Club ID');
    scout(Number(query));
  };

  // Recent opponents, to scout with a click before the fixtures are out
  const recentOpponents = useMemo(() => {
    const seen = new Set<number>();
    return (ours?.matches ?? []).map(match => match.opponent).filter(opponent => !seen.has(opponent.clubId) && seen.add(opponent.clubId)).slice(0, 8);
  }, [ours]);

  const openSquad = (opponentName: string, formation: string) => {
    if (!walletAddress || !ours) return;
    // The same XI the planner rated, with its best captain
    addDraftLineup(walletAddress, {
      name: `vs ${opponentName}`,
      formation,
      ...autoFillLineup(formation, ours.players),
      captain: ourFits.get(formation)?.captain?.playerId ?? null,
    });
    router.push('/squad-builder');
  };

  if (!walletAddress) {
    return <WalletGate title="Match Prep Tool" description="your clubs' next opponents" ownOnly />;
  }

  return (
    <div className="flex flex-col gap-[22px]">
      <div className="flex items-end justify-between gap-[18px] flex-wrap">
        <div className="flex flex-col gap-1.5">
          <h1 className="m-0 font-display text-[32px] sm:text-[44px] leading-none font-extrabold tracking-[-0.03em] text-fg">Match Prep Tool</h1>
          <span className="text-xs font-semibold text-accent-ink" title="Your wallet signed in with a signature Flow checked: only you see this page">
            ✓ Verified as {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)} · private to you
          </span>
        </div>
        <div className="flex items-end gap-3 flex-wrap">
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted">
            Your club
            <span className="relative block">
              <select
                value={clubId ?? ''}
                onChange={event => setClubId(Number(event.target.value))}
                disabled={clubs.length === 0}
                className="appearance-none h-[42px] min-w-[220px] pl-3.5 pr-9 rounded-xl border border-line-2 bg-field text-fg text-sm font-bold cursor-pointer outline-none"
              >
                {clubs.map(({ club }) => (
                  <option key={club.id} value={club.id}>
                    {club.name} · {clubsService.getDivisionName(club.division)}
                  </option>
                ))}
              </select>
              <svg className="absolute right-3 top-3.5 pointer-events-none stroke-muted" width="14" height="14" viewBox="0 0 24 24" fill="none" strokeWidth={2.4} aria-hidden="true">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </span>
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted">
            Scout an opponent
            <span className="flex gap-2">
              <span className="flex items-center gap-2 h-[42px] w-[220px] px-3.5 rounded-xl bg-field border border-line-3">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="flex-none stroke-muted" strokeWidth={2} aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                <input
                  value={clubQuery}
                  onChange={event => {
                    setClubQuery(event.target.value.replace(/\D/g, ''));
                    setClubError('');
                  }}
                  onKeyDown={event => event.key === 'Enter' && loadClub()}
                  inputMode="numeric"
                  placeholder="Enter Club ID…"
                  className="flex-1 min-w-0 bg-transparent border-0 outline-none text-strong text-sm font-medium"
                />
              </span>
              <button type="button" onClick={loadClub} className={`${limeButton} h-[42px]`}>
                Load
              </button>
            </span>
            {clubError && <span className="text-xs font-semibold text-[#f87171]">{clubError}</span>}
          </label>
        </div>
      </div>

      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 rounded-[22px] border border-red-500/45 bg-red-500/10">
          <p className="m-0 text-sm font-semibold text-danger-ink">{error}</p>
          <button onClick={() => setRetry(count => count + 1)} className={btnSecondary}>
            Try Again
          </button>
        </div>
      )}
      {isLoadingClubs && clubs.length === 0 && <Spinner label="Loading clubs..." />}
      {!isLoadingClubs && !error && clubs.length === 0 && (
        <Panel className="px-6 py-14 text-center">
          <p className="m-0 text-[15px] font-medium text-muted">You don&apos;t have any MFL clubs in this wallet.</p>
        </Panel>
      )}

      {clubId && (
        <>
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-3">
              <span className={capsLabel}>Next opponents</span>
              {later.length > 0 && (
                <button type="button" onClick={() => setShowLater(!showLater)} className={`text-xs font-semibold cursor-pointer ${linkClass}`}>
                  {showLater ? 'Show fewer' : 'Show more'}
                </button>
              )}
            </div>
            {opponents.length > 0 ? (
              <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))]">
                {opponents.map(opponent => (
                  <OpponentChoice
                    key={opponent.clubId}
                    opponent={opponent}
                    meta={meta}
                    selected={opponent.clubId === selected?.clubId}
                    onSelect={() => setSelectedId(opponent.clubId)}
                    onRemove={opponent.scouted ? () => setScouted(current => current.filter(id => id !== opponent.clubId)) : undefined}
                  />
                ))}
              </div>
            ) : (
              <Panel className="flex flex-col gap-3 px-5 py-4">
                <p className="m-0 text-sm font-medium text-muted">
                  No upcoming fixtures yet{ours?.season ? `: ${ours.season}'s schedule isn't out` : ''}. Scout an opponent by Club ID
                  {recentOpponents.length > 0 ? ', or pick a recent one:' : '.'}
                </p>
                {recentOpponents.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {recentOpponents.map(opponent => (
                      <button
                        key={opponent.clubId}
                        type="button"
                        onClick={() => scout(opponent.clubId)}
                        className="inline-flex items-center h-7 px-3 rounded-full border border-chip-line bg-chip text-xs font-bold text-fg-3 cursor-pointer hover:border-[#c6f432]"
                      >
                        {opponent.name}
                      </button>
                    ))}
                  </div>
                )}
              </Panel>
            )}
          </div>

          {ourError && <p className="m-0 text-sm font-semibold text-danger-ink">Couldn&apos;t load your squad: {ourError}</p>}
          {selected && (
            <OpponentPrep
              key={selected.clubId}
              opponent={selected}
              ourClubId={clubId}
              ours={ours}
              ourFits={ourFits}
              ourPlayersById={ourPlayersById}
              meta={meta}
              pick={picks[selected.clubId]}
              onPick={formation => setPicks(current => ({ ...current, [selected.clubId]: formation }))}
              against={plannedAgainst[selected.clubId]}
              onAgainst={against => planAgainst(selected.clubId, against)}
              onOpenSquad={openSquad}
              tactics={tactics}
              canLog={canLog}
              outcome={aims[clubId] ?? 'win'}
              onOutcome={aim => {
                setAim(clubId, aim);
                // The best pick for the new aim, unless one is picked again
                setPicks(current => {
                  const { [selected.clubId]: _dropped, ...rest } = current;
                  return rest;
                });
              }}
            />
          )}

          <TacticsLogPanel
            clubName={clubs.find(item => item.club.id === clubId)?.club.name ?? 'Your club'}
            history={tactics.history}
            isLoading={tactics.isLoading}
            error={tactics.error}
            canEdit={canLog}
            onSave={tactics.save}
            playersById={ourPlayersById}
            onRefresh={tactics.refresh}
          />

          <p className="m-0 text-[11px] font-medium text-muted-3">
            {meta.source === 'mfldata' ? (
              <>Formation meta from {meta.matches.toLocaleString()} MFL matches on engine {meta.engine}, teams within {meta.maxOvrDifference} OVR, updated daily.</>
            ) : (
              <>
                Formation meta from{' '}
                <a href={meta.source} target="_blank" rel="noopener noreferrer" className={linkClass}>
                  mfl-coach.com
                </a>{' '}
                ({meta.matches.toLocaleString()} matches on engine {meta.engine}, teams within {meta.maxOvrDifference} OVR, {meta.fetchedAt})
                {own && <> · our own: {own.games.toLocaleString()} of {MIN_OWN_GAMES.toLocaleString()} matches</>}.
              </>
            )}
          </p>
        </>
      )}
    </div>
  );
};

export default MatchesPage;
