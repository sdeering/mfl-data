"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { matchesService, MFLMatch } from '../services/matchesService';
import { clubsService, type MFLClubData } from '../services/clubsService';
import { useScoutReport } from '../hooks/useScoutReport';
import { formationLabel } from '../utils/squadLineups';
import { PageHeader, Panel, btnSecondary, linkClass } from './ui';
import WalletGate from './WalletGate';
import { ClubLogo } from './matches/ClubLogo';
import { ClubStrip } from './matches/ClubStrip';
import { FormationPlanner, type Fixture } from './matches/FormationPlanner';

/** Upcoming opponents the formation planner can scout, beyond the next match day's */
const MAX_UPCOMING_OPPONENTS = 6;

const chipClass = 'inline-flex items-center h-6 px-2.5 rounded-full border text-[11px] font-bold whitespace-nowrap';

type KnownFormations = { home: string | null; away: string | null };

// Lightweight child component to fetch and render formations for a given match, unless they're already known
const MatchFormations: React.FC<{ matchId: string; known?: KnownFormations }> = ({ matchId, known }) => {
  const [home, setHome] = useState<string | null>(known?.home ?? null);
  const [away, setAway] = useState<string | null>(known?.away ?? null);
  const [loading, setLoading] = useState<boolean>(false);
  const [loaded, setLoaded] = useState<boolean>(!!known);

  useEffect(() => {
    if (loaded) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const formations = await matchesService.fetchMatchFormations(matchId);
        if (!cancelled) {
          setHome(formations.home || null);
          setAway(formations.away || null);
          setLoaded(true);
        }
      } catch {
        if (!cancelled) setLoaded(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [matchId, loaded]);

  if (loading && !loaded) {
    return <span>Loading formations…</span>;
  }

  if (!home && !away) {
    return <span>No formation data</span>;
  }

  return (
    <div className="flex flex-wrap justify-center gap-1.5">
      {home && <span className={`${chipClass} border-chip-line bg-chip text-fg-3`}>Home: {formationLabel(home)}</span>}
      {away && <span className={`${chipClass} border-chip-line bg-chip text-fg-3`}>Away: {formationLabel(away)}</span>}
    </div>
  );
};

const getStatusChip = (status: string) => {
  switch (status.toLowerCase()) {
    case 'live':
      return 'border-red-500/45 bg-red-500/12 text-danger-ink';
    case 'finished':
    case 'ended':
      return 'border-pos-line bg-btn-pos text-pos-ink';
    case 'planned':
    case 'upcoming':
      return 'border-[var(--badge-line)] bg-[var(--badge-bg)] text-accent-soft';
    default:
      return 'border-chip-line bg-chip text-fg-3';
  }
};

const getCompetitionChip = (type: string) => {
  switch (type.toLowerCase()) {
    case 'league':
      return 'border-violet-line bg-violet-bg text-violet-ink';
    case 'cup':
      return 'border-[rgba(255,190,90,.3)] bg-[rgba(255,190,90,.12)] text-warn-ink';
    default:
      return 'border-chip-line bg-chip text-fg-3';
  }
};

const RESULT_BADGE = {
  W: 'border-accent bg-accent text-accent-fg',
  L: 'border-red-500/45 bg-red-500/15 text-danger-ink',
  D: 'border-chip-line bg-chip text-fg-3',
};

const TeamName: React.FC<{ name: string; side: 'Home' | 'Away'; isSelected: boolean; club?: { id: number; logoVersion?: string } }> = ({ name, side, isSelected, club }) => (
  <div className="flex flex-col items-center gap-1 text-center w-24 sm:w-auto sm:min-w-[150px]">
    {club && <ClubLogo clubId={club.id} name={name} logoVersion={club.logoVersion} className="w-9 h-9" />}
    <div className={`text-[13px] sm:text-[15px] font-bold break-words ${isSelected ? 'text-accent-ink' : 'text-fg'}`}>
      {name}
    </div>
    <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-3">
      {side}
    </div>
  </div>
);

const EmptyState: React.FC<{ title: string; message: string }> = ({ title, message }) => (
  <Panel className="flex flex-col items-center gap-2 px-6 py-14 text-center">
    <svg className="w-14 h-14 mb-2 text-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
    <h3 className="m-0 font-display text-lg font-bold text-fg">
      {title}
    </h3>
    <p className="m-0 text-[15px] font-medium text-muted">
      {message}
    </p>
  </Panel>
);

const MatchesPage: React.FC = () => {
  const { isConnected, account, viewedAddress = null } = useWallet();
  // The connected wallet, or one pasted in to look at read-only
  const walletAddress = (isConnected ? account : null) ?? viewedAddress;
  const [clubs, setClubs] = useState<MFLClubData[]>([]);
  const [selectedClub, setSelectedClub] = useState<MFLClubData | null>(null);
  const [pastMatches, setPastMatches] = useState<MFLMatch[]>([]);
  const [upcomingMatches, setUpcomingMatches] = useState<MFLMatch[]>([]);
  const [showAllPast, setShowAllPast] = useState(false);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchClubs = async () => {
    if (!walletAddress) return;
    
    console.log('fetchClubs called with account:', walletAddress);
    setIsLoading(true);
    setError(null);
    
    try {
      // Top division first; clubs with none, such as Arena clubs, last
      const clubsData = [...(await clubsService.fetchClubsForWallet(walletAddress))].sort(
        (a, b) => (a.club.division || 99) - (b.club.division || 99)
      );
      setClubs(clubsData);
      if (clubsData.length > 0) {
        setSelectedClub(clubsData[0]);
      }
    } catch (err) {
      console.error('Error fetching clubs:', err);
      setError('Failed to load clubs data');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMatches = async (clubId: string) => {
    if (!clubId) return;
    
    console.log('fetchMatches called with clubId:', clubId);
    setIsLoadingMatches(true);
    setError(null);
    
    // Clear previous matches immediately to show fresh state
    setPastMatches([]);
    setUpcomingMatches([]);
    
    try {
      // Always use club-specific methods to get matches for the selected club
      console.log('🔍 Fetching matches for club:', clubId);
      
      // Fetch matches in background - don't block UI
      const [pastData, upcomingData] = await Promise.all([
        matchesService.fetchPastMatches(clubId),
        matchesService.fetchUpcomingMatches(clubId)
      ]);
      
      console.log('Past matches for club:', pastData);
      console.log('Upcoming matches for club:', upcomingData);
      
      setPastMatches(pastData);
      setUpcomingMatches(upcomingData);
    } catch (err) {
      console.error('Error fetching matches:', err);
      setError('Failed to load matches data');
    } finally {
      setIsLoadingMatches(false);
    }
  };

  // Win, draw or loss for the selected club, matched by club ID: a club's team name in a match can differ from its club name
  const getMatchResult = (match: MFLMatch, clubId: number): 'W' | 'L' | 'D' | null => {
    if (match.status !== 'FINISHED' && match.status !== 'ENDED') return null;
    const isHomeTeam = match.homeSquad?.club?.id === clubId;
    const isAwayTeam = match.awaySquad?.club?.id === clubId;
    if (!isHomeTeam && !isAwayTeam) return null;
    if (match.homeScore === match.awayScore) return 'D';
    return (isHomeTeam ? match.homeScore > match.awayScore : match.awayScore > match.homeScore) ? 'W' : 'L';
  };

  useEffect(() => {
    console.log('MatchesPage useEffect - wallet:', walletAddress);
    if (walletAddress) {
      console.log('Wallet connected, fetching clubs for:', walletAddress);
      // Fetch clubs in background - don't block UI
      fetchClubs().catch(err => {
        console.error('Background fetch clubs error:', err);
      });
    } else {
      console.log('Wallet not connected or no account address');
    }
  }, [walletAddress]);

  useEffect(() => {
    if (selectedClub) {
      // Fetch matches in background - don't block UI
      fetchMatches(selectedClub.club.id.toString()).catch(err => {
        console.error('Background fetch matches error:', err);
      });
    }
  }, [selectedClub]);

  const selectedClubId = selectedClub?.club.id;

  // The formation planner's read of our recent matches, so their rows needn't ask MFL for formations again
  const { report: ourReport } = useScoutReport(selectedClubId, 15);
  const knownFormations = useMemo(() => {
    const known = new Map<number, KnownFormations>();
    for (const match of ourReport?.matches ?? []) {
      const pastMatch = pastMatches.find(past => past.id === match.id);
      if (!pastMatch) continue;
      const home = pastMatch.homeSquad?.club?.id === selectedClubId;
      known.set(match.id, home ? { home: match.formation, away: match.opponentFormation } : { home: match.opponentFormation, away: match.formation });
    }
    return known;
  }, [ourReport, pastMatches, selectedClubId]);

  // The clubs we play next in competitions, soonest first; the planner shows the next match day's
  const fixtures = useMemo(() => {
    const next: Fixture[] = [];
    const planned = upcomingMatches.filter(match => match.type !== 'FRIENDLY' && match.status !== 'LIVE' && match.status !== 'ENDED');
    for (const match of planned.sort((a, b) => a.startDate - b.startDate)) {
      const home = match.homeSquad?.club?.id === selectedClubId;
      const opponent = home ? match.awaySquad?.club : match.homeSquad?.club;
      if (!opponent || opponent.id === selectedClubId || next.some(fixture => fixture.clubId === opponent.id)) continue;
      next.push({
        clubId: opponent.id,
        name: home ? match.awayTeamName : match.homeTeamName,
        logoVersion: opponent.logoVersion,
        startDate: match.startDate,
        competition: match.competition?.name ?? '',
        home,
      });
      if (next.length === MAX_UPCOMING_OPPONENTS) break;
    }
    return next;
  }, [upcomingMatches, selectedClubId]);

  if (!walletAddress) {
    return <WalletGate title="MFL Matches" description="your clubs' matches" />;
  }

  const renderMatch = (match: MFLMatch, result: 'W' | 'L' | 'D' | null, showFormations: boolean) => (
    <div key={match.id} className="flex flex-wrap items-center justify-between gap-3 sm:gap-4 px-[18px] py-4 border-t border-divider hover:bg-row-hover transition-colors">
      <div className="flex-1">
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Win/Loss/Draw Indicator */}
          {result && (
            <span className={`flex-none grid place-items-center w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl border font-display text-xl sm:text-2xl font-extrabold ${RESULT_BADGE[result]}`}>
              {result}
            </span>
          )}

          <TeamName name={match.homeTeamName} side="Home" isSelected={match.homeSquad?.club?.id === selectedClubId} club={match.homeSquad?.club} />
          <div className="text-center min-w-[88px] sm:min-w-[120px]">
            <div className="font-display text-2xl font-extrabold tabular-nums text-fg">
              {match.homeScore} - {match.awayScore}
            </div>
            <div className="text-xs font-medium text-muted-3">
              {matchesService.formatMatchDate(match.startDate)}
            </div>
            {/* Formations row (always shown) */}
            {showFormations && (
              <div className="mt-1.5 text-xs font-medium text-muted">
                <MatchFormations key={`${match.id}-${knownFormations.has(match.id)}`} matchId={match.id.toString()} known={knownFormations.get(match.id)} />
              </div>
            )}
          </div>
          <TeamName name={match.awayTeamName} side="Away" isSelected={match.awaySquad?.club?.id === selectedClubId} club={match.awaySquad?.club} />
        </div>
      </div>
      <div className="flex md:flex-col items-end gap-1.5">
        <span className={`${chipClass} ${getStatusChip(match.status)}`}>
          {matchesService.formatMatchStatus(match.status)}
        </span>
        <span className={`${chipClass} ${getCompetitionChip(match.competition.type)}`}>
          {match.competition.name}
        </span>
      </div>
    </div>
  );

  const renderShowMore = (showAll: boolean, setShowAll: (value: boolean) => void, total: number) =>
    total > 3 && (
      <div className="px-[18px] py-3 border-t border-divider">
        <button
          onClick={() => setShowAll(!showAll)}
          className={`w-full text-center text-sm font-semibold cursor-pointer ${linkClass}`}
        >
          {showAll ? 'Show Less' : `Show More (${total - 3} more)`}
        </button>
      </div>
    );

  return (
    <div className="flex flex-col gap-[22px]">
      <PageHeader
        title="MFL Matches"
        subtitle={clubs.length > 0 && `${clubs.length} club${clubs.length !== 1 ? 's' : ''} available`}
      />

      {clubs.length > 0 && <ClubStrip clubs={clubs} selectedId={selectedClubId} onSelect={setSelectedClub} />}

      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 rounded-[22px] border border-red-500/45 bg-red-500/10">
          <p className="m-0 text-sm font-semibold text-danger-ink">{error}</p>
          <button
            onClick={() => selectedClub ? fetchMatches(selectedClub.club.id.toString()) : fetchClubs()}
            className={btnSecondary}
          >
            Try Again
          </button>
        </div>
      )}

      {/* Show loading indicator only for clubs section, not blocking entire page */}
      {isLoading && clubs.length === 0 && (
        <Panel className="flex items-center justify-center gap-3 px-6 py-14">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent"></div>
          <span className="text-[15px] font-medium text-muted">Loading clubs...</span>
        </Panel>
      )}

      {!isLoading && clubs.length === 0 && (
        <EmptyState title="No Clubs Found" message="You don't have any MFL clubs in this wallet." />
      )}

      {/* Matches Content */}
      {clubs.length > 0 && selectedClub && (
        <>
          <FormationPlanner key={selectedClub.club.id} clubId={selectedClub.club.id} clubName={selectedClub.club.name} fixtures={fixtures} />

          {/* Show loading indicator only when matches are loading and we have no data yet */}
          {isLoadingMatches && upcomingMatches.length === 0 && pastMatches.length === 0 && (
            <Panel className="flex items-center justify-center gap-3 px-6 py-14">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent"></div>
              <span className="text-[15px] font-medium text-muted">Loading matches...</span>
            </Panel>
          )}

          {/* Upcoming Matches */}
          {upcomingMatches.length > 0 && (
            <Panel className="overflow-hidden">
              <h2 className="m-0 px-[18px] py-4 font-display text-xl font-bold text-fg">
                Upcoming Matches <span className="font-semibold text-muted">({upcomingMatches.length})</span>
              </h2>
              {(showAllUpcoming ? upcomingMatches : upcomingMatches.slice(0, 3)).map((match) => renderMatch(match, null, false))}
              {renderShowMore(showAllUpcoming, setShowAllUpcoming, upcomingMatches.length)}
            </Panel>
          )}

          {/* Past Matches */}
          {pastMatches.length > 0 && (
            <Panel className="overflow-hidden">
              <h2 className="m-0 px-[18px] py-4 font-display text-xl font-bold text-fg">
                Recent Matches <span className="font-semibold text-muted">({pastMatches.length})</span>
              </h2>
              {(showAllPast ? pastMatches : pastMatches.slice(0, 3)).map((match) =>
                renderMatch(match, getMatchResult(match, selectedClub.club.id), true)
              )}
              {renderShowMore(showAllPast, setShowAllPast, pastMatches.length)}
            </Panel>
          )}

          {/* No Matches - only show if not loading and no data */}
          {!isLoadingMatches && upcomingMatches.length === 0 && pastMatches.length === 0 && (
            <EmptyState title="No Matches Found" message={`No matches found for ${selectedClub.club.name}.`} />
          )}
        </>
      )}
    </div>
  );
};

export default MatchesPage;
