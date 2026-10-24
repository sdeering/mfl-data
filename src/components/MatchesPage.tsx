"use client";

import React, { useState, useEffect } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useRouter } from 'next/navigation';
import { matchesService, MFLMatch } from '../services/matchesService';
import { clubsService } from '../services/clubsService';
import { PageHeader, Panel, Select, btnSecondary, labelClass, linkClass } from './ui';

const chipClass = 'inline-flex items-center h-6 px-2.5 rounded-full border text-[11px] font-bold whitespace-nowrap';

// Lightweight child component to fetch and render formations for a given match
const MatchFormations: React.FC<{ matchId: string }> = ({ matchId }) => {
  const [home, setHome] = useState<string | null>(null);
  const [away, setAway] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [loaded, setLoaded] = useState<boolean>(false);

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
      {home && <span className={`${chipClass} border-chip-line bg-chip text-fg-3`}>Home: {home}</span>}
      {away && <span className={`${chipClass} border-chip-line bg-chip text-fg-3`}>Away: {away}</span>}
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

const TeamName: React.FC<{ name: string; side: 'Home' | 'Away'; isSelected: boolean }> = ({ name, side, isSelected }) => (
  <div className="text-center min-w-[150px]">
    <div className={`text-[15px] font-bold ${isSelected ? 'text-accent-ink' : 'text-fg'}`}>
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
  const { isConnected, account } = useWallet();
  const [clubs, setClubs] = useState<any[]>([]);
  const [selectedClub, setSelectedClub] = useState<any>(null);
  const [pastMatches, setPastMatches] = useState<MFLMatch[]>([]);
  const [upcomingMatches, setUpcomingMatches] = useState<MFLMatch[]>([]);
  const [showAllPast, setShowAllPast] = useState(false);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Add a state to track if we've given enough time for wallet initialization
  const [hasCheckedWallet, setHasCheckedWallet] = useState(false);

  // Check wallet connection with delay to allow initialization
  useEffect(() => {
    const timer = setTimeout(() => {
      setHasCheckedWallet(true);
    }, 1500); // Give 1.5 seconds for wallet to initialize
    
    return () => clearTimeout(timer);
  }, []);

  // Only redirect if we've checked and wallet is still not connected
  useEffect(() => {
    if (hasCheckedWallet && !isConnected) {
      router.push('/');
    }
  }, [hasCheckedWallet, isConnected, router]);

  const fetchClubs = async () => {
    if (!account) return;
    
    console.log('fetchClubs called with account:', account);
    setIsLoading(true);
    setError(null);
    
    try {
      const clubsData = await clubsService.fetchClubsForWallet(account);
      console.log('Clubs data received:', clubsData);
      setClubs(clubsData);
      if (clubsData.length > 0) {
        console.log('Setting selected club to:', clubsData[0]);
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

  // Helper function to determine if the selected club won the match
  const getMatchResult = (match: MFLMatch, clubName: string): 'W' | 'L' | 'D' | null => {
    console.log('getMatchResult called:', {
      matchStatus: match.status,
      clubName,
      homeTeam: match.homeTeamName,
      awayTeam: match.awayTeamName,
      homeScore: match.homeScore,
      awayScore: match.awayScore
    });
    
    if (match.status !== 'FINISHED' && match.status !== 'ENDED') {
      console.log('Match not finished, status:', match.status);
      return null;
    }
    
    const isHomeTeam = match.homeTeamName === clubName;
    const isAwayTeam = match.awayTeamName === clubName;
    
    if (!isHomeTeam && !isAwayTeam) {
      console.log('Club not found in match teams');
      return null;
    }
    
    // Check if it's a draw
    if (match.homeScore === match.awayScore) {
      console.log('Draw detected');
      return 'D';
    }
    
    if (isHomeTeam) {
      const result = match.homeScore > match.awayScore ? 'W' : 'L';
      console.log('Home team result:', result);
      return result;
    } else {
      const result = match.awayScore > match.homeScore ? 'W' : 'L';
      console.log('Away team result:', result);
      return result;
    }
  };

  useEffect(() => {
    console.log('MatchesPage useEffect - isConnected:', isConnected, 'account:', account);
    if (isConnected && account) {
      console.log('Wallet connected, fetching clubs for:', account);
      // Fetch clubs in background - don't block UI
      fetchClubs().catch(err => {
        console.error('Background fetch clubs error:', err);
      });
    } else {
      console.log('Wallet not connected or no account address');
    }
  }, [isConnected, account]);

  useEffect(() => {
    console.log('selectedClub changed:', selectedClub);
    if (selectedClub) {
      console.log('selectedClub.club:', selectedClub.club);
      console.log('selectedClub.club.id:', selectedClub.club.id);
      
      // Use the club ID directly
      const clubId = selectedClub.club.id.toString();
      console.log('Using club ID:', clubId, 'for club:', selectedClub.club.name);
      // Fetch matches in background - don't block UI
      fetchMatches(clubId).catch(err => {
        console.error('Background fetch matches error:', err);
      });
    }
  }, [selectedClub]);

  // Show loading state while checking wallet connection
  if (!hasCheckedWallet) {
    return (
      <div className="flex flex-col gap-[22px]">
        <PageHeader title="MFL Matches" />
        <Panel className="flex flex-col items-center gap-4 px-6 py-16 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
          <p className="m-0 text-[15px] font-medium text-muted">
            Loading...
          </p>
        </Panel>
      </div>
    );
  }

  // Show not connected message only after we've checked
  if (!isConnected) {
    return (
      <div className="flex flex-col gap-[22px]">
        <PageHeader title="MFL Matches" />
        <Panel className="px-6 py-16 text-center">
          <p className="m-0 text-[15px] font-medium text-muted">
            Please connect your wallet to view your matches
          </p>
        </Panel>
      </div>
    );
  }

  const renderMatch = (match: MFLMatch, result: 'W' | 'L' | 'D' | null, showFormations: boolean) => (
    <div key={match.id} className="flex items-center justify-between gap-4 px-[18px] py-4 border-t border-divider hover:bg-row-hover transition-colors">
      <div className="flex-1">
        <div className="flex items-center gap-4">
          {/* Win/Loss/Draw Indicator */}
          {result && (
            <span className={`flex-none grid place-items-center w-14 h-14 rounded-2xl border font-display text-2xl font-extrabold ${RESULT_BADGE[result]}`}>
              {result}
            </span>
          )}

          <TeamName name={match.homeTeamName} side="Home" isSelected={match.homeTeamName === selectedClub?.club.name} />
          <div className="text-center min-w-[120px]">
            <div className="font-display text-2xl font-extrabold tabular-nums text-fg">
              {match.homeScore} - {match.awayScore}
            </div>
            <div className="text-xs font-medium text-muted-3">
              {matchesService.formatMatchDate(match.startDate)}
            </div>
            {/* Formations row (always shown) */}
            {showFormations && (
              <div className="mt-1.5 text-xs font-medium text-muted">
                <MatchFormations matchId={match.id.toString()} />
              </div>
            )}
          </div>
          <TeamName name={match.awayTeamName} side="Away" isSelected={match.awayTeamName === selectedClub?.club.name} />
        </div>
      </div>
      <div className="flex flex-col items-end gap-1.5">
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
        actions={clubs.length > 0 && (
          <label className={labelClass}>
            Select Club
            <Select
              value={selectedClub?.club.id ?? ''}
              onChange={(e) => {
                const clubData = clubs.find(c => c.club.id.toString() === e.target.value);
                if (clubData) setSelectedClub(clubData);
              }}
              className="min-w-[260px]"
            >
              {clubs.map((clubData) => (
                <option key={clubData.club.id} value={clubData.club.id}>
                  {clubData.club.name} · {clubsService.getDivisionName(clubData.club.division)}
                </option>
              ))}
            </Select>
          </label>
        )}
      />

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
                renderMatch(match, getMatchResult(match, selectedClub.club.name), true)
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
