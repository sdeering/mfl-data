"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { mflApi } from '../services/mflApi';
import { getPlayerMarketValue, type MarketValueCalculationResult } from '../services/marketValueService';
import { fetchPlayerExperienceHistory, processProgressionData, getMintSnapshot, MFL_HISTORY_START, type MintSnapshot } from '../services/playerExperienceService';
import { fetchPlayerMatches } from '../services/playerMatchesService';
import { calculateAllPositionOVRs } from '../utils/ruleBasedPositionCalculator';
import { isRetiredPlayer } from '../utils/appSettings';
import type { MFLPlayer } from '../types/mflApi';
import type { MarketValueEstimate } from '../utils/marketValueCalculator';
import PlayerImage from './PlayerImage';
import PlayerStats from './PlayerStats';
import PlayerStatsGrid from './PlayerStatsGrid';
import PositionRatingsDisplay from './PositionRatingsDisplay';
import PlayerProgressionGraph from './PlayerProgressionGraph';
import PlayerSaleHistory from './PlayerSaleHistory';
import PlayerPositionSummary from './PlayerPositionSummary';
import PlayerRecentMatches from './PlayerRecentMatches';
import { useLoading } from '../contexts/LoadingContext';
// Direct supabase import removed - using API routes instead
import { useWallet } from '../contexts/WalletContext';
import { Panel, btnPrimary, btnSecondary, linkClass } from './ui';

interface PlayerResultsPageProps {
  propPlayerId?: string;
  initialPlayer?: MFLPlayer | null;
  initialError?: string | null;
}

const formatMintDate = (timestamp: number) =>
  new Date(timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const externalLinkClass =
  'flex items-center gap-2 h-[42px] px-5 rounded-full border border-line-2 bg-panel text-fg-2 text-sm font-semibold whitespace-nowrap cursor-pointer transition-colors hover:border-accent-ink hover:text-accent-ink';

// Function to add player to recent searches
const addToRecentSearches = (player: MFLPlayer) => {
  try {
    const recentSearches = JSON.parse(localStorage.getItem('mfl-recent-searches') || '[]');
    
    // Create new search entry
    const newSearch = {
      id: player.id.toString(),
      name: `${player.metadata.firstName} ${player.metadata.lastName}`,
      overall: player.metadata.overall,
      positions: player.metadata.positions,
      timestamp: Date.now()
    };
    
    // Remove existing entry if it exists (to avoid duplicates)
    const filteredSearches = recentSearches.filter((search: { id: string }) => search.id !== newSearch.id);
    
    // Add new search to the beginning
    const updatedSearches = [newSearch, ...filteredSearches];
    
    // Keep only the last 20 searches
    const limitedSearches = updatedSearches.slice(0, 20);
    
    localStorage.setItem('mfl-recent-searches', JSON.stringify(limitedSearches));
  } catch (error) {
    console.error('Failed to save to recent searches:', error);
  }
};

const PlayerResultsPage: React.FC<PlayerResultsPageProps> = ({ propPlayerId, initialPlayer, initialError }) => {
  const searchParams = useSearchParams();
  const { account } = useWallet();
  const [player, setPlayer] = useState<MFLPlayer | null>(initialPlayer || null);
  const [marketValueEstimate, setMarketValueEstimate] = useState<MarketValueEstimate | null>(null);
  const [isCalculatingMarketValue, setIsCalculatingMarketValue] = useState(false);
  const [progressionData, setProgressionData] = useState<any[] | null>(null);
  const [matchCount, setMatchCount] = useState<number | undefined>(undefined);
  // Start with loading=true if we have a propPlayerId but no initial data
  // (searchParams will be checked in useEffect)
  const [isLoading, setIsLoading] = useState(!!propPlayerId && !initialPlayer);
  const [error, setError] = useState<string | null>(initialError || null);
  // Track loading state for sub-queries
  const [loadingStates, setLoadingStates] = useState({
    playerData: false,
    marketValue: false,
    matches: false,
    positionRatings: false,
  });
  const { setIsLoading: setGlobalLoading } = useLoading();
  const hasFetchedRef = useRef<string | null>(null); // Track which playerId we've fetched

  // ?view=mint shows the player's stats as they were when first minted.
  // searchParams is null outside the app router (e.g. in tests)
  const isMintView = searchParams?.get('view') === 'mint';
  // The INITIAL entry of the player's history; null when MFL has none
  const [mint, setMint] = useState<{ playerId: number; snapshot: MintSnapshot | null } | null>(null);
  const mintSnapshot = mint && mint.playerId === player?.id ? mint.snapshot : undefined;
  const isLoadingMint = isMintView && !!player && mintSnapshot === undefined;
  // A snapshot from MFL's backfill is the earliest record, which may postdate the mint
  const isBackfilledMint = !!mintSnapshot && mintSnapshot.date < MFL_HISTORY_START;

  useEffect(() => {
    if (!isMintView || !player || mint?.playerId === player.id) return;

    let cancelled = false;
    fetchPlayerExperienceHistory(player.id.toString()).then(response => {
      if (cancelled) return;
      setMint({ playerId: player.id, snapshot: response.success ? getMintSnapshot(response.data) : null });
    });
    return () => {
      cancelled = true;
    };
  }, [isMintView, player, mint?.playerId]);

  // The player as shown: as minted in the mint view, otherwise as they are now
  const displayPlayer = useMemo(() => {
    if (!player || !isMintView || !mintSnapshot) return player;

    const values = mintSnapshot.values;
    return {
      ...player,
      metadata: {
        ...player.metadata,
        age: values.age ?? player.metadata.age,
        overall: values.overall ?? player.metadata.overall,
        pace: values.pace ?? player.metadata.pace,
        shooting: values.shooting ?? player.metadata.shooting,
        passing: values.passing ?? player.metadata.passing,
        dribbling: values.dribbling ?? player.metadata.dribbling,
        defense: values.defense ?? player.metadata.defense,
        physical: values.physical ?? player.metadata.physical,
        goalkeeping: values.goalkeeping ?? player.metadata.goalkeeping,
        // A new mint is nowhere near retirement
        retirementYears: undefined,
      },
    };
  }, [player, isMintView, mintSnapshot]);
  
  // Track modified attributes for training simulation
  const [modifiedAttributes, setModifiedAttributes] = useState<{
    pace?: number;
    shooting?: number;
    passing?: number;
    dribbling?: number;
    defense?: number;
    physical?: number;
  }>({});
  
  // Reset modified attributes when player changes
  useEffect(() => {
    setModifiedAttributes({});
  }, [player?.id]);
  
  // Create modified player object for position ratings
  const modifiedPlayer = useMemo(() => {
    if (!displayPlayer) return null;
    
    if (Object.keys(modifiedAttributes).length === 0) {
      return displayPlayer;
    }
    
    return {
      ...displayPlayer,
      metadata: {
        ...displayPlayer.metadata,
        pace: modifiedAttributes.pace ?? displayPlayer.metadata.pace,
        shooting: modifiedAttributes.shooting ?? displayPlayer.metadata.shooting,
        passing: modifiedAttributes.passing ?? displayPlayer.metadata.passing,
        dribbling: modifiedAttributes.dribbling ?? displayPlayer.metadata.dribbling,
        defense: modifiedAttributes.defense ?? displayPlayer.metadata.defense,
        physical: modifiedAttributes.physical ?? displayPlayer.metadata.physical,
      }
    };
  }, [displayPlayer, modifiedAttributes]);


  const calculateMarketValueForPlayer = useCallback(async (player: MFLPlayer) => {
    // Validate that player and metadata exist
    if (!player || !player.metadata) {
      console.warn('Player or player metadata not available for market value calculation');
      setIsCalculatingMarketValue(false);
      return;
    }

    // Set a timeout to ensure we don't hang forever
    // Increased to 95 seconds to match the Promise.race timeout (90s) with a small buffer
    const timeoutId = setTimeout(() => {
      console.warn('⚠️ Market value calculation timeout - forcing state to false');
      setIsCalculatingMarketValue(false);
      setLoadingStates(prev => ({ ...prev, marketValue: false, matches: false }));
    }, 95000); // 95 second timeout (matches Promise.race timeout with buffer)

    try {
      console.log('🔍 Checking market value for player:', player.id);
      
      // Use the centralized market value calculation service with timeout
      const calculationPromise = getPlayerMarketValue(
        player.id.toString(),
        account || 'anonymous',
        false // Use cached value if available
      );

      // Race the calculation against a timeout
      // Increased to 90 seconds to allow for slow API calls and database queries
      const timeoutPromise = new Promise<MarketValueCalculationResult>((_, reject) => {
        setTimeout(() => reject(new Error('Market value calculation timeout')), 90000); // 90 second timeout
      });

      // Check if result comes back quickly (likely from cache) - only show "Calculating..." if it takes longer
      const startTime = Date.now();
      const quickCheckPromise = Promise.race([
        calculationPromise,
        new Promise<MarketValueCalculationResult>((resolve) => {
          setTimeout(() => resolve({ success: false, error: 'still_loading' }), 1000); // 1 second threshold (database queries can take 200-500ms)
        })
      ]);

      let result;
      const quickResult = await quickCheckPromise;
      
      if (quickResult.success) {
        // Got valid result quickly (likely from cache) - don't show "Calculating..."
        result = quickResult;
        const duration = Date.now() - startTime;
        console.log(`✅ Market value loaded quickly (${duration}ms, likely from cache): $${result.marketValue || 0}`);
      } else if (quickResult.error === 'still_loading') {
        // Taking longer than 1 second - likely a real calculation, show "Calculating..."
        console.log('🔄 Market value calculation taking longer than 1s, showing "Calculating..."');
        setIsCalculatingMarketValue(true);
        setLoadingStates(prev => ({ ...prev, marketValue: true }));
        
        try {
          result = await Promise.race([calculationPromise, timeoutPromise]);
        } catch (timeoutError) {
          console.error('⏰ Market value calculation timed out:', timeoutError);
          result = { success: false, error: 'Calculation timed out. The calculation may still be running in the background.' };
          // Ensure state is cleaned up on timeout
          setIsCalculatingMarketValue(false);
          setLoadingStates(prev => ({ ...prev, marketValue: false }));
        }
      } else {
        // Got an error result quickly
        result = quickResult;
        console.error('❌ Market value check returned error:', quickResult.error);
      }

      if (result.success && result.details) {
        // Convert the result to the expected format for the component
        const estimate: MarketValueEstimate = {
          estimatedValue: result.marketValue!,
          confidence: result.confidence!,
          breakdown: result.details.breakdown,
          details: result.details.details
        };
        
        setMarketValueEstimate(estimate);
        console.log('✅ Market value calculated:', estimate.estimatedValue);
      } else {
        console.error('Failed to calculate market value:', result.error);
        // Still set estimate to null/undefined so UI doesn't show "Calculating..." forever
        setMarketValueEstimate(null);
      }
      
      setLoadingStates(prev => ({ ...prev, marketValue: false }));

      // Fetch progression and match data for tags (non-blocking, don't block UI)
      setLoadingStates(prev => ({ ...prev, matches: true }));
      try {
        const [progressionResponse, matchesResponse] = await Promise.all([
          fetchPlayerExperienceHistory(player.id.toString()),
          fetchPlayerMatches(player.id.toString())
        ]);

        if (progressionResponse.success) {
          setProgressionData(processProgressionData(progressionResponse.data));
        }
        if (matchesResponse.success) {
          setMatchCount(matchesResponse.data.length);
        }
      } catch (fetchError) {
        console.warn('⚠️ Error fetching progression/matches (non-critical):', fetchError);
      } finally {
        setLoadingStates(prev => ({ ...prev, matches: false }));
      }
    } catch (error) {
      console.error('❌ Failed to calculate market value:', error);
      setMarketValueEstimate(null); // Clear estimate on error
      setLoadingStates(prev => ({ ...prev, marketValue: false, matches: false }));
    } finally {
      clearTimeout(timeoutId);
      // Always set calculating to false, even on error or timeout
      setIsCalculatingMarketValue(false);
      console.log('✅ Market value calculation complete (isCalculatingMarketValue set to false)');
    }
  }, [account]);

  const fetchPlayerData = useCallback(async (playerId: string) => {
    setIsLoading(true);
    setGlobalLoading(true);
    setError(null);
    setLoadingStates({
      playerData: true,
      marketValue: false,
      matches: false,
      positionRatings: false,
    });
    
    try {
      console.log('🔍 Fetching player data for ID:', playerId);
      
      // Create an AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 30000); // 30 second timeout
      
      // Fetch player data from our API route (server-side)
      const response = await fetch(`/api/player/${playerId}`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      const data = await response.json();
      
      console.log('📥 API Response status:', response.status, 'success:', data.success);
      
      if (!response.ok || !data.success) {
        console.error('❌ API Error:', data.error);
        throw new Error(data.error || 'Failed to fetch player data');
      }
      
      const player = data.data;
      console.log('✅ Player data received:', player?.id, player?.metadata?.firstName, player?.metadata?.lastName);
      
      if (!player) {
        throw new Error('Player data is null or undefined');
      }
      
      // Validate player structure
      if (!player.metadata) {
        console.error('❌ Player data missing metadata:', player);
        throw new Error('Invalid player data: missing metadata');
      }
      
      setPlayer(player);
      setLoadingStates(prev => ({ ...prev, playerData: false }));
      
      // Add player to recent searches when successfully loaded
      addToRecentSearches(player);
      
      // Show player info immediately (non-blocking)
      setIsLoading(false);
      setGlobalLoading(false);
      
      // Calculate market value in background (non-blocking)
      calculateMarketValueForPlayer(player)
        .catch((err) => {
          console.error('⚠️ Market value calculation failed (non-blocking):', err);
        });
    } catch (err) {
      console.error('❌ Error in fetchPlayerData:', err);
      let errorMessage = 'Failed to fetch player data';
      
      if (err instanceof Error) {
        // Check if it's an AbortError (timeout)
        if (err.name === 'AbortError') {
          errorMessage = 'Request timed out. The server may be slow or the player ID may not exist. Please try again.';
        } 
        // Check if it's an HTTP 400 error (likely a name search)
        else if (err.message.includes('HTTP 400')) {
          // Check if the search query looks like a name (contains letters) vs an ID (numbers only)
          const isLikelyName = /[a-zA-Z]/.test(playerId);
          if (isLikelyName) {
            errorMessage = 'Player name search is not supported yet. Please search by Player ID (numbers only).';
          } else {
            errorMessage = 'Invalid Player ID. Please enter a valid numeric Player ID.';
          }
        } else {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
      setLoadingStates({
        playerData: false,
        marketValue: false,
        matches: false,
        positionRatings: false,
      });
      setIsLoading(false);
      setGlobalLoading(false);
    }
    // Note: Don't set isLoading to false in finally block if sub-queries are still running
    // The sub-queries will handle setting isLoading to false when they complete
  }, [setGlobalLoading, calculateMarketValueForPlayer]);

  // Debug: Monitor isCalculatingMarketValue state changes
  useEffect(() => {
    console.log('🔍 isCalculatingMarketValue state changed:', isCalculatingMarketValue);
  }, [isCalculatingMarketValue]);

  // Initialize player data on component mount - only run once per playerId
  useEffect(() => {
    const currentPlayerId = propPlayerId || searchParams.get('playerId');
    
    // Only fetch if we have a playerId and haven't fetched it yet
    if (currentPlayerId && currentPlayerId !== hasFetchedRef.current) {
      console.log('🎯 Initializing player page with ID:', currentPlayerId);
      hasFetchedRef.current = currentPlayerId;
      setIsLoading(true);
      fetchPlayerData(currentPlayerId);
    }
    // Only re-run if propPlayerId changes - we ignore searchParams to avoid infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propPlayerId]);


  // Loading state - only show while fetching initial player data (or its mint stats)
  if ((isLoading && loadingStates.playerData) || isLoadingMint) {
    return (
      <Panel className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent mx-auto mb-4"></div>
          <p className="m-0 text-sm font-medium text-muted">{isLoadingMint ? 'Loading mint stats...' : 'Loading player data...'}</p>
        </div>
      </Panel>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex justify-center">
        <Panel className="w-full max-w-md px-6 py-8 text-center">
          <div className="mb-6">
            <svg className="w-14 h-14 text-danger-ink mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <h2 className="m-0 mb-2 font-display text-2xl font-bold">Search Error</h2>
            <p className="m-0 text-sm text-muted">{error}</p>
          </div>

          <div className="flex flex-col gap-2.5">
            <button
              onClick={() => window.location.href = '/'}
              className={`${btnPrimary} w-full`}
            >
              Back to Search
            </button>
            <button
              onClick={() => window.location.reload()}
              className={`${btnSecondary} w-full`}
            >
              Try Again
            </button>
          </div>

          {error.includes('Player name search') && (
            <div className="mt-6 p-4 rounded-2xl border border-line bg-inset text-left">
              <h3 className="m-0 mb-2 text-sm font-bold text-fg">How to find a Player ID:</h3>
              <ul className="m-0 p-0 list-none text-sm text-muted space-y-1">
                <li>• Visit <a href="https://app.playmfl.com" target="_blank" rel="noopener noreferrer" className={linkClass}>app.playmfl.com</a></li>
                <li>• Search for the player you want</li>
                <li>• Copy the Player ID from the URL or player page</li>
                <li>• Paste the ID here to search</li>
              </ul>
            </div>
          )}
        </Panel>
      </div>
    );
  }

  // The mint view shows the player as they started, so it is never retired
  const isRetired = !!player && !isMintView && isRetiredPlayer(player);

  return (
    <div className="flex flex-col gap-[22px]">
      {player && displayPlayer ? (
        <>
          {isRetired && (
            <div role="status" className="flex items-center gap-3.5 px-4 py-3.5 rounded-2xl border border-red-500/45 bg-red-500/12">
              <span className="flex-none grid place-items-center w-10 h-10 rounded-xl bg-red-500/20 text-danger-ink" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="5" width="18" height="16" rx="2" />
                  <path d="M16 3v4M8 3v4M3 10h18M10 14l4 4M14 14l-4 4" />
                </svg>
              </span>
              <div className="flex flex-col gap-0.5">
                <p className="m-0 font-display text-lg font-bold text-danger-ink">Retired</p>
                <p className="m-0 text-sm text-fg-2">
                  {player.metadata.firstName} {player.metadata.lastName}&apos;s career is over. Retired players stay in their agency but can no longer sign a contract.
                </p>
              </div>
            </div>
          )}

          {/* Mint view notice */}
          {isMintView && (
            <div className="px-4 py-3 rounded-2xl border border-violet-line bg-violet-bg text-sm text-violet-ink-2 flex flex-wrap items-center justify-between gap-3">
              {mintSnapshot && isBackfilledMint ? (
                <div>
                  <p className="m-0 font-semibold">Viewing this player&apos;s earliest recorded stats, from {formatMintDate(mintSnapshot.date)}</p>
                  <p className="m-0 mt-1 text-violet-ink">
                    MFL only started recording stat history in November 2024, so a player minted before then may have changed between its mint and this record.
                  </p>
                </div>
              ) : mintSnapshot ? (
                <p className="m-0 font-semibold">Viewing this player as minted on {formatMintDate(mintSnapshot.date)}</p>
              ) : (
                <p className="m-0 font-semibold">MFL has no mint record for this player, so these are its current stats.</p>
              )}
              <Link
                href={`/players/${player.id}`}
                className="inline-flex items-center h-9 px-4 rounded-full bg-violet-ink text-violet-bg text-[13px] font-bold whitespace-nowrap transition-opacity hover:opacity-90"
              >
                View current player
              </Link>
            </div>
          )}

          {/* Row 1 - Player information, card and position ratings (the card comes first once they stack) */}
          <div key={`player-${player.id}`} className="@container grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-6 items-start">
            {/* Player Information */}
            <Panel className="px-[18px] py-2">
              {isMintView && mintSnapshot ? (
                <PlayerStats
                  player={displayPlayer}
                  mintedOn={`${isBackfilledMint ? 'By ' : ''}${formatMintDate(mintSnapshot.date)}`}
                />
              ) : (
                <PlayerStats
                  player={player!}
                  marketValueEstimate={marketValueEstimate}
                  progressionData={progressionData}
                  matchCount={matchCount}
                  isCalculatingMarketValue={isCalculatingMarketValue}
                />
              )}
            </Panel>

            {/* Player Card */}
            <div className="flex flex-col items-center gap-4 @max-[664px]:order-first">
              {isRetired ? (
                <div className="relative">
                  <div className="grayscale opacity-75">
                    <PlayerImage player={displayPlayer} />
                  </div>
                  <span className="absolute left-1/2 top-[44%] -translate-x-1/2 -rotate-12 px-4 py-1.5 rounded-lg border-2 border-red-400 bg-red-600/90 font-display text-xl font-extrabold uppercase tracking-[0.12em] text-white shadow-[0_10px_30px_rgba(0,0,0,.5)]">
                    Retired
                  </span>
                </div>
              ) : (
                <PlayerImage player={displayPlayer} />
              )}
              {/* Keyed by view so training changes don't carry between current and mint */}
              <PlayerStatsGrid
                key={isMintView ? 'mint' : 'current'}
                player={displayPlayer}
                onAttributesChange={setModifiedAttributes}
              />
            </div>

            {/* Position Ratings */}
            <Panel className="p-[18px] flex flex-col gap-2">
              <h3 className="m-0 mb-1 font-display text-lg font-bold">Position Ratings</h3>
              <PositionRatingsDisplay player={modifiedPlayer || displayPlayer} showMatchRatings={!isMintView} />
            </Panel>
          </div>

          {/* Row 2 - External links and the mint view toggle */}
          {player!.id && (
            <div className="flex justify-center gap-2.5 flex-wrap">
              <button
                onClick={() => window.open(`https://app.playmfl.com/players/${player!.id}`, '_blank')}
                className={externalLinkClass}
              >
                <span>mfl.com</span>
                <span aria-hidden="true">↗</span>
              </button>
              <button
                onClick={() => window.open(`https://mfl-assistant.com/search?q=${encodeURIComponent(`${player!.metadata.firstName} ${player!.metadata.lastName}`)}`, '_blank')}
                className={externalLinkClass}
              >
                <span>mfl-assistant.com</span>
                <span aria-hidden="true">↗</span>
              </button>
              <Link
                href={isMintView ? `/players/${player.id}` : `/players/${player.id}?view=mint`}
                className={externalLinkClass}
              >
                {isMintView ? 'View current player' : 'View player mint'}
              </Link>
            </div>
          )}

          {/* Row 3 - Progression Graph (Full width) */}
          <PlayerProgressionGraph
            playerId={player.id.toString()}
            playerName={`${player.metadata.firstName} ${player.metadata.lastName}`}
            playerPositions={player.metadata.positions}
            asOf={isMintView && mintSnapshot ? mintSnapshot.date : undefined}
          />

          {/* Row 4 - Sale History, Position Summary, and Recent Matches (Three columns).
              All of it comes after the mint, so the mint view leaves it out */}
          {!isMintView && (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,360px),1fr))] gap-6 items-start">
            <PlayerSaleHistory
              playerId={player.id.toString()}
              playerName={`${player.metadata.firstName} ${player.metadata.lastName}`}
              playerMetadata={player.metadata}
              marketValueEstimate={marketValueEstimate}
            />

            <PlayerPositionSummary
              playerId={player.id.toString()}
              playerName={`${player.metadata.firstName} ${player.metadata.lastName}`}
            />

            <PlayerRecentMatches
              playerId={player.id.toString()}
              playerName={`${player.metadata.firstName} ${player.metadata.lastName}`}
            />
          </div>
          )}
        </>
      ) : (
        <Panel className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="m-0 text-muted">No player data available</p>
            <p className="m-0 text-sm text-muted-3 mt-2">Debug: player={player ? 'exists' : 'null'}</p>
          </div>
        </Panel>
      )}
    </div>
  );
};

export default PlayerResultsPage;
