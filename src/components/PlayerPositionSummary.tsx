'use client';

import React, { useState, useEffect } from 'react';
import { fetchPlayerMatches, fetchPlayerSeasonMatches } from '../services/playerMatchesService';
import type { PlayerMatchStats, PositionSummary } from '../types/playerMatches';
import { groupMatchesBySeason, type PlayerSeason } from '../utils/playerSeasons';
import { Panel } from './ui';

const formatDay = (timestamp: number) => new Date(timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

const sectionHeadClass = 'm-0 px-[18px] py-2.5 bg-thead border-y border-line text-[11px] font-bold uppercase tracking-[0.1em] text-muted-2';
const rowClass = 'flex justify-between items-center gap-3 px-[18px] py-3 border-b border-divider last:border-b-0 hover:bg-row-hover transition-colors';
const badgeClass = 'inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-bold';

interface PlayerPositionSummaryProps {
  playerId: string;
  playerName: string;
}

export default function PlayerPositionSummary({ playerId, playerName }: PlayerPositionSummaryProps) {
  const [matches, setMatches] = useState<PlayerMatchStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // The league summary covers whole seasons, which takes more matches than the last 25
  const [seasons, setSeasons] = useState<PlayerSeason[] | null>(null);
  const [seasonsError, setSeasonsError] = useState<string | null>(null);

  useEffect(() => {
    const loadMatches = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetchPlayerMatches(playerId);
        
        if (response.success && response.data.length > 0) {
          setMatches(response.data);
        } else {
          setError(response.error || 'No matches available');
        }
      } catch (err) {
        console.error('Error fetching matches:', err);
        setError('Failed to load matches');
      } finally {
        setIsLoading(false);
      }
    };

    if (playerId) {
      loadMatches();
    }
  }, [playerId]);

  useEffect(() => {
    if (!playerId) return;
    let cancelled = false;
    setSeasons(null);
    setSeasonsError(null);
    fetchPlayerSeasonMatches(playerId).then(response => {
      if (cancelled) return;
      if (response.success) setSeasons(groupMatchesBySeason(response.data, 2));
      else setSeasonsError(response.error || 'Failed to load matches');
    });
    return () => { cancelled = true; };
  }, [playerId]);

  // Calculate position summaries
  const calculatePositionSummaries = (): PositionSummary[] => {
    const positionMap = new Map<string, PlayerMatchStats[]>();
    
    matches.forEach(match => {
      const position = match.stats.position;
      if (!positionMap.has(position)) {
        positionMap.set(position, []);
      }
      positionMap.get(position)!.push(match);
    });

    return Array.from(positionMap.entries()).map(([position, positionMatches]) => {
      const totalRating = positionMatches.reduce((sum, match) => sum + match.stats.rating, 0);
      const totalMinutes = positionMatches.reduce((sum, match) => sum + (match.stats.time / 60), 0);
      const totalGoals = positionMatches.reduce((sum, match) => sum + match.stats.goals, 0);
      const totalAssists = positionMatches.reduce((sum, match) => sum + match.stats.assists, 0);

      return {
        position,
        matches: positionMatches.length,
        averageRating: totalRating / positionMatches.length,
        totalMinutes: Math.round(totalMinutes),
        totalGoals,
        totalAssists,
        averageGoals: totalGoals / positionMatches.length,
        averageAssists: totalAssists / positionMatches.length,
      };
    }).sort((a, b) => b.matches - a.matches); // Sort by number of matches
  };

  const formatRating = (rating: number) => {
    return rating.toFixed(2);
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 8.0) return 'text-rt-cyan';
    if (rating >= 7.0) return 'text-rt-green';
    if (rating >= 6.0) return 'text-warn-ink';
    return 'text-danger-ink';
  };

  // Loading state
  if (isLoading) {
    return (
      <Panel className="w-full p-[18px]">
        <div className="flex items-center justify-center h-48">
          <div data-testid="loading-spinner" className="animate-spin rounded-full h-6 w-6 border-2 border-accent border-t-transparent"></div>
        </div>
      </Panel>
    );
  }

  // Error state
  if (error) {
    return (
      <Panel className="w-full p-[18px]">
        <div className="flex items-center justify-center h-48">
          <div className="text-center text-muted">
            <p className="m-0 text-sm">{error}</p>
          </div>
        </div>
      </Panel>
    );
  }

  // No data state
  if (matches.length === 0) {
    return (
      <Panel className="w-full">
        <div className="px-[18px] py-4">
          <h3 className="m-0 font-display text-lg font-bold">Match Position Ratings</h3>
        </div>
        <div className="flex items-center justify-center h-48 border-t border-line">
          <div className="text-center text-muted">
            <p className="m-0 text-sm">No matches available</p>
          </div>
        </div>
      </Panel>
    );
  }

  const positionSummaries = calculatePositionSummaries();

  // Helper functions for league detection (same as Recent Matches)
  const getDivisionBadge = (competitionName: string): string => {
    const name = competitionName.toLowerCase();
    if (name.includes('flint')) return 'Flint';
    if (name.includes('ice')) return 'Ice';
    if (name.includes('spark')) return 'Spark';
    if (name.includes('stone')) return 'Stone';
    if (name.includes('iron')) return 'Iron';
    if (name.includes('bronze')) return 'Bronze';
    if (name.includes('silver')) return 'Silver';
    if (name.includes('gold')) return 'Gold';
    if (name.includes('platinum')) return 'Platinum';
    if (name.includes('diamond')) return 'Diamond';
    if (name.includes('master')) return 'Master';
    if (name.includes('legendary')) return 'Legendary';
    return '';
  };

  const getDivisionColor = (division: string): string => {
    switch (division.toLowerCase()) {
      case 'flint': return 'bg-orange-600 text-white';
      case 'ice': return 'bg-cyan-400 text-gray-900';
      case 'spark': return 'bg-yellow-400 text-gray-900';
      case 'stone': return 'bg-gray-500 text-white';
      case 'iron': return 'bg-gray-700 text-white';
      case 'bronze': return 'bg-amber-600 text-white';
      case 'silver': return 'bg-gray-400 text-gray-900';
      case 'gold': return 'bg-yellow-500 text-gray-900';
      case 'platinum': return 'bg-blue-400 text-white';
      case 'diamond': return 'bg-purple-500 text-white';
      case 'master': return 'bg-orange-500 text-white';
      case 'legendary': return 'bg-red-600 text-white';
      default: return 'bg-gray-200 text-gray-700';
    }
  };

  // League summaries of a set of matches
  const calculateLeagueSummaries = (seasonMatches: PlayerMatchStats[]) => {
    const leagueMap = new Map<string, PlayerMatchStats[]>();
    
    seasonMatches.forEach(match => {
      // Use match.type instead of competition name for type detection
      const matchType = match.match?.type === 'CUP' ? 'Cup' : 'League';
      const competitionName = match.match?.competition?.name || '';
      
      // Only apply division detection to League competitions
      let division = '';
      if (matchType === 'League') {
        division = getDivisionBadge(competitionName);
      }
      
      // Group by match type (League or Cup) and division
      const leagueKey = `${matchType} ${division}`;
      
      if (!leagueMap.has(leagueKey)) {
        leagueMap.set(leagueKey, []);
      }
      leagueMap.get(leagueKey)!.push(match);
    });

    return Array.from(leagueMap.entries())
      .map(([league, leagueMatches]) => {
        const totalRating = leagueMatches.reduce((sum, match) => sum + match.stats.rating, 0);
        return {
          league,
          matches: leagueMatches.length,
          averageRating: totalRating / leagueMatches.length,
          totalGoals: leagueMatches.reduce((sum, match) => sum + match.stats.goals, 0),
          totalAssists: leagueMatches.reduce((sum, match) => sum + match.stats.assists, 0),
        };
      })
      .sort((a, b) => {
        // Sort by match type first (League before Cup), then by matches count
        const aIsLeague = a.league.startsWith('League');
        const bIsLeague = b.league.startsWith('League');
        if (aIsLeague && !bIsLeague) return -1;
        if (!aIsLeague && bIsLeague) return 1;
        return b.matches - a.matches;
      });
  };

  const seasonLabel = (season: PlayerSeason, index: number) => {
    if (season.isCurrent) return 'This season';
    if (index === 1 && seasons?.[0]?.isCurrent) return 'Last season';
    return `Season from ${formatDay(season.start)}`;
  };

  return (
    <Panel className="w-full overflow-hidden">
      <div className="px-[18px] py-4">
        <h3 className="m-0 font-display text-lg font-bold">Match Position Ratings</h3>
      </div>

      {/* Position Summaries */}
      {positionSummaries.length > 0 && (
        <div>
          <h4 className={sectionHeadClass}>Position Summary (last {matches.length} matches)</h4>
          <div>
            {positionSummaries.map((summary) => (
              <div
                key={summary.position}
                className={rowClass}
              >
                <div className="flex flex-1 min-w-0 items-center gap-3">
                  <span className="grid place-items-center min-w-11 h-[38px] px-1.5 rounded-[10px] border-2 border-line-2 bg-field text-[13px] font-extrabold text-fg">
                    {summary.position}
                  </span>
                  <p className="m-0 text-[13px] text-muted">
                    {summary.matches} matches • {summary.totalGoals} goals • {summary.totalAssists} assists
                  </p>
                </div>
                <div className="text-right">
                  <span className={`font-display text-xl font-extrabold tabular-nums ${getRatingColor(summary.averageRating)}`}>
                    {formatRating(summary.averageRating)}
                  </span>
                  <p className="m-0 text-[11px] text-muted-3">
                    avg rating
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* League Summaries: the last two seasons, each in full */}
      <div>
        <h4 className={sectionHeadClass}>League Summary (last 2 seasons)</h4>
        {seasonsError ? (
          <p className="m-0 px-[18px] py-4 text-sm text-muted">{seasonsError}</p>
        ) : seasons === null ? (
          <div className="flex items-center gap-2 px-[18px] py-4 text-sm text-muted">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-accent border-t-transparent"></div>
            Loading seasons…
          </div>
        ) : seasons.length === 0 ? (
          <p className="m-0 px-[18px] py-4 text-sm text-muted">No league matches in the last two seasons</p>
        ) : (
          <div>
            {seasons.map((season, index) => (
              <div key={season.start} className="border-b border-divider last:border-b-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 px-[18px] pt-3.5 pb-1.5">
                  <h5 className="m-0 text-sm font-bold text-fg">
                    {seasonLabel(season, index)}
                    <span className="ml-2 font-medium text-muted">
                      {formatDay(season.start)} – {season.end ? formatDay(season.end) : 'now'} · {season.matches.length} matches
                    </span>
                  </h5>
                  <p className="m-0 text-[13px] text-muted">
                    {season.leagueMatches} league • {season.cupMatches} cup
                  </p>
                </div>
                <div>
                  {calculateLeagueSummaries(season.matches).map((summary) => {
                    const [matchType, division] = summary.league.split(' ');
                    const divisionColor = getDivisionColor(division);

                    return (
                      <div
                        key={summary.league}
                        className={rowClass}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className={`${badgeClass} ${
                              matchType === 'Cup'
                                ? 'bg-violet-bg text-violet-ink'
                                : 'bg-[rgba(138,230,58,.14)] text-pos-ink'
                            }`}>
                              {matchType}
                            </span>
                            {division && (
                              <span className={`${badgeClass} ${divisionColor}`}>
                                {division}
                              </span>
                            )}
                          </div>
                          <p className="m-0 mt-1 text-[13px] text-muted">
                            {summary.matches} matches • {summary.totalGoals} goals • {summary.totalAssists} assists
                          </p>
                        </div>
                        <div className="text-right">
                          <span className={`font-display text-xl font-extrabold tabular-nums ${getRatingColor(summary.averageRating)}`}>
                            {formatRating(summary.averageRating)}
                          </span>
                          <p className="m-0 text-[11px] text-muted-3">
                            avg rating
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}
