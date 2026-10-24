'use client';

import React, { useState, useEffect } from 'react';
import { fetchPlayerMatches } from '../services/playerMatchesService';
import type { PlayerMatchStats } from '../types/playerMatches';
import { Panel, btnSecondary } from './ui';

const badgeClass = 'inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-bold';
const toggleClass = 'h-8 px-3.5 rounded-full text-xs font-bold cursor-pointer transition-colors';

interface PlayerRecentMatchesProps {
  playerId: string;
  playerName: string;
}

export default function PlayerRecentMatches({ playerId, playerName }: PlayerRecentMatchesProps) {
  const [matches, setMatches] = useState<PlayerMatchStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllMatches, setShowAllMatches] = useState(false);
  const [enabledMatchTypes, setEnabledMatchTypes] = useState<Set<string>>(new Set([]));

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

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getMatchType = (competitionName: string): string => {
    const name = competitionName.toLowerCase();
    if (name.includes('cup') || name.includes('championship') || name.includes('trophy')) {
      return 'Cup';
    }
    return 'League';
  };

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

  const formatMinutes = (seconds: number) => {
    const minutes = Math.round(seconds / 60);
    return `${minutes}m`;
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

  const toggleMatchType = (matchType: string) => {
    console.log('Toggle clicked:', matchType, 'Current state:', Array.from(enabledMatchTypes));
    
    if (matchType === 'All') {
      setEnabledMatchTypes(new Set(['League', 'Cup']));
    } else {
      // If "All" is currently active (both selected), clicking individual toggle should select only that one
      if (enabledMatchTypes.size === 2) {
        console.log('Setting to only:', matchType);
        setEnabledMatchTypes(new Set([matchType]));
      } else {
        // When switching between individual toggles, replace the current selection
        if (enabledMatchTypes.has(matchType)) {
          // If clicking the same toggle, turn it off
          setEnabledMatchTypes(new Set([]));
        } else {
          // If clicking a different toggle, switch to only that one
          setEnabledMatchTypes(new Set([matchType]));
        }
      }
    }
  };

  // Initialize with "All" selected on component mount
  useEffect(() => {
    setEnabledMatchTypes(new Set(['League', 'Cup']));
  }, []);



  // Loading state
  if (isLoading) {
    return (
      <Panel className="w-full p-[18px]">
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-accent border-t-transparent"></div>
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
          <h3 className="m-0 font-display text-lg font-bold">Recent Matches</h3>
        </div>
        <div className="flex items-center justify-center h-48 border-t border-line">
          <div className="text-center text-muted">
            <p className="m-0 text-sm">No matches available</p>
          </div>
        </div>
      </Panel>
    );
  }

  // Filter out friendlies and by match type, then sort by date (most recent first)
  const filteredMatches = matches
    .filter(match => {
      const competitionName = match.match.competition.name.toLowerCase();
      if (competitionName.includes('friendly')) return false;
      
      const matchType = getMatchType(match.match.competition.name);
      return enabledMatchTypes.has(matchType);
    })
    .sort((a, b) => b.match.startDate - a.match.startDate);

  const displayedMatches = showAllMatches ? filteredMatches : filteredMatches.slice(0, 5);

  const toggleButtonClass = (isActive: boolean) =>
    `${toggleClass} ${isActive ? 'bg-fg text-canvas' : 'bg-transparent text-fg-3 hover:text-fg'}`;

  return (
    <Panel className="w-full overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-[18px] py-4">
        <h3 className="m-0 font-display text-lg font-bold">Recent Matches</h3>

        {/* Match Type Toggles */}
        <div className="flex p-[3px] rounded-full bg-field border border-line-3">
          <button
            onClick={() => toggleMatchType('All')}
            className={toggleButtonClass(enabledMatchTypes.size === 2)}
          >
            All
          </button>
          <button
            onClick={() => toggleMatchType('League')}
            className={toggleButtonClass(enabledMatchTypes.has('League') && enabledMatchTypes.size === 1)}
          >
            League
          </button>
          <button
            onClick={() => toggleMatchType('Cup')}
            className={toggleButtonClass(enabledMatchTypes.has('Cup') && enabledMatchTypes.size === 1)}
          >
            Cup
          </button>
        </div>
      </div>

      {/* Recent Matches */}
      <div className="border-t border-line">
        {displayedMatches.map((match) => {
          const matchType = getMatchType(match.match.competition.name);
          const division = getDivisionBadge(match.match.competition.name);
          const divisionColor = getDivisionColor(division);

          return (
            <div
              key={match.id}
              className="flex justify-between items-start gap-3 px-[18px] py-3 border-b border-divider last:border-b-0 hover:bg-row-hover transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="grid place-items-center min-w-9 h-[26px] px-1.5 rounded-lg border border-line-2 bg-field text-xs font-extrabold text-fg">
                    {match.stats.position}
                  </span>
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
                <p className="m-0 mt-1 text-sm font-semibold text-fg-2">
                  {match.match.homeTeamName} vs {match.match.awayTeamName}
                </p>
                <p className="m-0 mt-0.5 text-xs text-muted">
                  {formatDate(match.match.startDate)} • {match.match.competition.name}
                </p>

                {/* Goals and Assists Icons */}
                {(match.stats.goals > 0 || match.stats.assists > 0) && (
                  <div className="flex items-center gap-2 mt-2">
                    {/* Goals */}
                    {match.stats.goals > 0 && (
                      <div className="flex items-center gap-1">
                        {Array.from({ length: match.stats.goals }, (_, i) => (
                          <div key={i} className="w-5 h-5 rounded-full grid place-items-center bg-[rgba(138,230,58,.18)]">
                            <span className="text-[11px] leading-none">⚽</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Assists */}
                    {match.stats.assists > 0 && (
                      <div className="flex items-center gap-1">
                        {Array.from({ length: match.stats.assists }, (_, i) => (
                          <div key={i} className="w-5 h-5 rounded-full grid place-items-center border border-line-2 bg-chip">
                            <span className="text-[11px] leading-none">🥅</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="text-right">
                <span className={`font-display text-xl font-extrabold tabular-nums ${getRatingColor(match.stats.rating)}`}>
                  {formatRating(match.stats.rating)}
                </span>
                <p className="m-0 text-[11px] text-muted-3">
                  rating
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Show More/Less Button */}
      {matches.length > 5 && (
        <div className="flex justify-center px-[18px] py-4 border-t border-divider">
          <button
            onClick={() => setShowAllMatches(!showAllMatches)}
            className={btnSecondary}
          >
            {showAllMatches
              ? `Show Less Matches`
              : `Show ${matches.length - 5} More Matches`
            }
          </button>
        </div>
      )}
    </Panel>
  );
}
