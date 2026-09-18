"use client";

import React, { useState, useEffect, Suspense, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { mflApi } from '../../src/services/mflApi';
import { fetchMarketData } from '../../src/services/marketDataService';
import { calculateMarketValue } from '../../src/utils/marketValueCalculator';
import { fetchPlayerSaleHistory } from '../../src/services/playerSaleHistoryService';
import { fetchPlayerExperienceHistory, processProgressionData } from '../../src/services/playerExperienceService';
import { fetchPlayerMatches } from '../../src/services/playerMatchesService';
import { calculateAllPositionOVRs } from '../../src/utils/ruleBasedPositionCalculator';
import type { MFLPlayer } from '../../src/types/mflApi';
import type { MarketValueEstimate } from '../../src/utils/marketValueCalculator';
import PlayerImage from '../../src/components/PlayerImage';
import PlayerStatsGrid from '../../src/components/PlayerStatsGrid';
import PositionRatingsDisplay from '../../src/components/PositionRatingsDisplay';
import PlayerProgressionGraph from '../../src/components/PlayerProgressionGraph';
import PlayerRecentMatches from '../../src/components/PlayerRecentMatches';
import PlayerSaleHistory from '../../src/components/PlayerSaleHistory';
import { useLoading } from '../../src/contexts/LoadingContext';
import { useWallet } from '../../src/contexts/WalletContext';
import { supabaseDataService } from '../../src/services/clientDataService';
import { rankSimilarPlayers } from '../../src/utils/playerSimilarity';

interface CompareSlot {
  key: number; // Stable identity so a slot keeps its data and in-flight requests when it is moved
  playerId: string;
  player: MFLPlayer | null;
  isLoading: boolean;
  error: string | null;
  marketValueEstimate: MarketValueEstimate | null;
}

const MIN_SLOTS = 2;
const MAX_SLOTS = 3;

const createSlot = (key: number, playerId = ''): CompareSlot => ({
  key,
  playerId,
  player: null,
  isLoading: false,
  error: null,
  marketValueEstimate: null
});

const calculateMarketValueForPlayer = async (player: MFLPlayer): Promise<MarketValueEstimate | null> => {
  try {
    // Validate that player and metadata exist
    if (!player || !player.metadata) {
      console.warn('Player or player metadata not available for market value calculation');
      return null;
    }

    const [marketResponse, historyResponse, progressionResponse, matchesResponse] = await Promise.all([
      fetchMarketData({
        positions: player.metadata.positions,
        ageMin: Math.max(1, player.metadata.age - 1),
        ageMax: player.metadata.age + 1,
        overallMin: Math.max(1, player.metadata.overall - 1),
        overallMax: player.metadata.overall + 1,
        limit: 50
      }),
      fetchPlayerSaleHistory(player.id.toString()),
      fetchPlayerExperienceHistory(player.id.toString()),
      fetchPlayerMatches(player.id.toString())
    ]);

    // Calculate position ratings
    const playerForOVR = {
      id: player.id,
      name: `${player.metadata.firstName} ${player.metadata.lastName}`,
      attributes: {
        PAC: player.metadata.pace,
        SHO: player.metadata.shooting,
        PAS: player.metadata.passing,
        DRI: player.metadata.dribbling,
        DEF: player.metadata.defense,
        PHY: player.metadata.physical,
        GK: player.metadata.goalkeeping || 0
      },
      positions: player.metadata.positions,
      overall: player.metadata.overall
    };
    const positionRatingsResult = calculateAllPositionOVRs(playerForOVR);
    const positionRatings = positionRatingsResult.results;

    if (!marketResponse.success) return null;

    // Convert position ratings to the expected format
    const positionRatingsForMarketValue = Object.entries(positionRatings).reduce((acc, [position, result]) => {
      if (result.success) {
        acc[position] = result.ovr;
      }
      return acc;
    }, {} as { [position: string]: number });

    return calculateMarketValue(
      player.metadata,
      marketResponse.data,
      historyResponse.success ? historyResponse.data : [],
      progressionResponse.success ? processProgressionData(progressionResponse.data) : [],
      positionRatingsForMarketValue,
      player.metadata.retirementYears,
      matchesResponse.success ? matchesResponse.data.length : undefined,
      player.id // Pass the actual player ID
    );
  } catch (error) {
    console.error('Failed to calculate market value:', error);
    return null;
  }
};

const getSlotName = (slot: CompareSlot, index: number) =>
  slot.player ? `${slot.player.metadata.firstName} ${slot.player.metadata.lastName}` : `Player ${index + 1}`;

const MAX_SUGGESTIONS = 50;

const slotControlClass = 'px-2.5 flex items-center rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent';

function ComparePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { setIsLoading: setGlobalLoading } = useLoading();
  const { account } = useWallet();

  // Agency players offered as suggestions under the focused search input
  const [agencyPlayers, setAgencyPlayers] = useState<MFLPlayer[]>([]);
  const [suggestionsSlotKey, setSuggestionsSlotKey] = useState<number | null>(null);

  useEffect(() => {
    if (!account) {
      setAgencyPlayers([]);
      return;
    }
    let cancelled = false;
    supabaseDataService.getAgencyPlayers(account)
      .then(players => { if (!cancelled) setAgencyPlayers(players); })
      .catch(err => console.error('Failed to load agency players for suggestions:', err));
    return () => { cancelled = true; };
  }, [account]);

  // Get player IDs from URL search params
  const urlPlayer1Id = searchParams.get('player1Id');
  const urlPlayer2Id = searchParams.get('player2Id');
  const urlPlayer3Id = searchParams.get('player3Id');
  const urlPlayerId = searchParams.get('playerId'); // Legacy support

  // Slot keys are counted per page instance, alongside the state they identify, so they stay unique
  const nextSlotKeyRef = useRef(0);
  const newSlot = (playerId = '') => createSlot(nextSlotKeyRef.current++, playerId);

  // Players being compared, in display order (left to right)
  const [slots, setSlots] = useState<CompareSlot[]>(() => [
    newSlot(urlPlayer1Id || urlPlayerId || ''),
    newSlot(urlPlayer2Id || ''),
    ...(urlPlayer3Id ? [newSlot(urlPlayer3Id)] : [])
  ]);

  // Latest request number per slot, so a slow response can't overwrite a newer search
  const latestRequestRef = useRef<Record<number, number>>({});
  const hasLoadedFromURL = useRef(false);

  const updateSlot = useCallback((slotKey: number, patch: Partial<CompareSlot>) => {
    setSlots(prev => prev.map(slot => slot.key === slotKey ? { ...slot, ...patch } : slot));
  }, []);

  const fetchPlayer = useCallback(async (slotKey: number, playerId: string) => {
    const id = playerId.trim();
    if (!id) return;

    const requestId = (latestRequestRef.current[slotKey] ?? 0) + 1;
    latestRequestRef.current[slotKey] = requestId;
    const isLatest = () => latestRequestRef.current[slotKey] === requestId;

    updateSlot(slotKey, { isLoading: true, error: null });
    setGlobalLoading(true);

    try {
      const player = await mflApi.getPlayer(id);
      if (!isLatest()) return;
      updateSlot(slotKey, { player, marketValueEstimate: null });

      // Calculate market value for the player
      const marketValueEstimate = await calculateMarketValueForPlayer(player);
      if (isLatest() && marketValueEstimate) {
        updateSlot(slotKey, { marketValueEstimate });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch player data';
      if (isLatest()) updateSlot(slotKey, { error: errorMessage, player: null });
    } finally {
      if (isLatest()) updateSlot(slotKey, { isLoading: false });
      setGlobalLoading(false);
    }
  }, [setGlobalLoading, updateSlot]);

  const updateURL = (nextSlots: CompareSlot[]) => {
    const params = new URLSearchParams();
    nextSlots.forEach((slot, index) => {
      const id = slot.playerId.trim();
      if (id) params.set(`player${index + 1}Id`, id);
    });

    const newURL = params.toString() ? `?${params.toString()}` : '/compare';
    router.replace(newURL, { scroll: false });
  };

  const handleSearch = (slot: CompareSlot) => {
    fetchPlayer(slot.key, slot.playerId);
    updateURL(slots);
  };

  const handleAddPlayer = () => {
    if (slots.length < MAX_SLOTS) setSlots([...slots, newSlot()]);
  };

  // Remove a player. The slot is emptied where it is, so the other players never move.
  // Only a third column goes away entirely: when it is the last one, or once it is already empty.
  const handleRemovePlayer = (slotKey: number) => {
    const index = slots.findIndex(slot => slot.key === slotKey);
    if (index === -1) return;

    const hasExtraColumn = slots.length > MIN_SLOTS;
    const dropColumn = hasExtraColumn && (index === slots.length - 1 || !slots[index].player);
    const nextSlots = dropColumn
      ? slots.filter(slot => slot.key !== slotKey)
      : slots.map(slot => slot.key === slotKey ? newSlot() : slot); // New key, so an in-flight search for the old one is ignored

    delete latestRequestRef.current[slotKey];
    setSlots(nextSlots);
    updateURL(nextSlots);
  };

  // Switch a player with its neighbour (-1 = left, 1 = right)
  const handleMovePlayer = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= slots.length) return;

    const nextSlots = [...slots];
    [nextSlots[index], nextSlots[targetIndex]] = [nextSlots[targetIndex], nextSlots[index]];
    setSlots(nextSlots);
    updateURL(nextSlots);
  };

  // Agency players for a slot's dropdown: closest match to the player in the other column first,
  // narrowed by whatever has been typed (name or ID)
  const getSuggestions = (slot: CompareSlot): MFLPlayer[] => {
    const reference = slots.find(s => s.key !== slot.key && s.player)?.player ?? null;
    const selectedIds = slots.map(s => s.player?.id).filter(Boolean);
    const query = slot.playerId.trim().toLowerCase();
    const isLoadedId = !!slot.player && query === slot.player.id.toString();

    return rankSimilarPlayers(reference, agencyPlayers)
      .filter(p => !selectedIds.includes(p.id))
      .filter(p => !query || isLoadedId ||
        `${p.metadata.firstName} ${p.metadata.lastName}`.toLowerCase().includes(query) ||
        p.id.toString().startsWith(query))
      .slice(0, MAX_SUGGESTIONS);
  };

  const handleSelectSuggestion = (slot: CompareSlot, player: MFLPlayer) => {
    const playerId = player.id.toString();
    setSuggestionsSlotKey(null);
    updateSlot(slot.key, { playerId });
    fetchPlayer(slot.key, playerId);
    updateURL(slots.map(s => s.key === slot.key ? { ...s, playerId } : s));
  };

  const handleKeyDown = (e: React.KeyboardEvent, slot: CompareSlot) => {
    if (e.key === 'Escape') {
      setSuggestionsSlotKey(null);
    } else if (e.key === 'Enter') {
      // A typed name isn't an ID, so Enter picks the top suggestion instead
      const topSuggestion = /^\d+$/.test(slot.playerId.trim()) ? undefined : getSuggestions(slot)[0];
      if (topSuggestion) {
        handleSelectSuggestion(slot, topSuggestion);
      } else {
        setSuggestionsSlotKey(null);
        handleSearch(slot);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent, slot: CompareSlot) => {
    // Prevent the default paste behavior to avoid duplicate values
    e.preventDefault();

    // Only a numeric player ID triggers a search
    const pastedText = e.clipboardData.getData('text').trim();
    if (!/^\d+$/.test(pastedText)) return;

    const nextSlots = slots.map(s => s.key === slot.key ? { ...s, playerId: pastedText } : s);
    setSlots(nextSlots);
    fetchPlayer(slot.key, pastedText);
    updateURL(nextSlots);
  };

  // Load players from URL on component mount only
  useEffect(() => {
    if (hasLoadedFromURL.current) return;
    hasLoadedFromURL.current = true;

    slots.forEach(slot => {
      if (slot.playerId) fetchPlayer(slot.key, slot.playerId);
    });
  }, []); // Empty dependency array - only run on mount

  return (
    <div className="min-h-screen bg-white dark:bg-[#111827]">
              <div className="px-4 lg:px-0 bg-white dark:bg-[#111827] rounded-lg">
        {/* Page Title */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Compare Players</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Enter player IDs to compare their stats and ratings</p>
        </div>

        {/* Search Inputs */}
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          {slots.map((slot, index) => {
            const { player } = slot;
            const playerName = getSlotName(slot, index);
            // Empty columns can only be removed when they are an extra (third) column
            const canRemove = !!player || slots.length > MIN_SLOTS;
            const suggestions = suggestionsSlotKey === slot.key ? getSuggestions(slot) : [];

            return (
              <div key={slot.key} className="flex-1">
                <label htmlFor={`player${index + 1}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Player {index + 1} ID
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1 min-w-0">
                    <input
                      id={`player${index + 1}`}
                      type="text"
                      value={slot.playerId}
                      onChange={(e) => {
                        updateSlot(slot.key, { playerId: e.target.value });
                        setSuggestionsSlotKey(slot.key);
                      }}
                      onFocus={() => setSuggestionsSlotKey(slot.key)}
                      onBlur={() => setSuggestionsSlotKey(current => current === slot.key ? null : current)}
                      onKeyDown={(e) => handleKeyDown(e, slot)}
                      onPaste={(e) => handlePaste(e, slot)}
                      placeholder={agencyPlayers.length > 0 ? 'Enter player ID or pick from your agency...' : 'Enter player ID...'}
                      autoComplete="off"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />

                    {/* Agency player suggestions, closest match first */}
                    {suggestionsSlotKey === slot.key && suggestions.length > 0 && (
                      <ul
                        role="listbox"
                        aria-label={`Agency players for player ${index + 1}`}
                        className="absolute z-20 left-0 right-0 mt-1 max-h-80 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg"
                      >
                        {suggestions.map(suggestion => (
                          <li
                            key={suggestion.id}
                            role="option"
                            aria-selected={false}
                            // mousedown fires before the input's blur, so the list is still open to receive it
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleSelectSuggestion(slot, suggestion);
                            }}
                            className="px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <div className="flex items-center justify-between gap-2 text-sm text-gray-900 dark:text-white">
                              <span className="truncate font-medium">
                                {suggestion.metadata.firstName} {suggestion.metadata.lastName}
                              </span>
                              <span className="flex-shrink-0 text-gray-600 dark:text-gray-300">
                                {suggestion.metadata.positions?.join(', ')} · {suggestion.metadata.overall}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
                              <span className="truncate">{suggestion.activeContract?.club?.name || 'No club'}</span>
                              <span className="flex-shrink-0">Age {suggestion.metadata.age} · #{suggestion.id}</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <button
                    onClick={() => handleSearch(slot)}
                    disabled={slot.isLoading || !slot.playerId.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    {slot.isLoading ? 'Loading...' : 'Search'}
                  </button>

                  {/* Switch / Remove controls (arrows point up/down on small screens where the inputs stack) */}
                  {player && (
                    <>
                      <button
                        onClick={() => handleMovePlayer(index, -1)}
                        disabled={index === 0}
                        className={slotControlClass}
                        title="Switch with the player on the left"
                        aria-label={`Move ${playerName} left`}
                      >
                        <svg className="h-4 w-4 rotate-90 lg:rotate-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleMovePlayer(index, 1)}
                        disabled={index === slots.length - 1}
                        className={slotControlClass}
                        title="Switch with the player on the right"
                        aria-label={`Move ${playerName} right`}
                      >
                        <svg className="h-4 w-4 rotate-90 lg:rotate-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </button>
                    </>
                  )}
                  {canRemove && (
                    <button
                      onClick={() => handleRemovePlayer(slot.key)}
                      className={`${slotControlClass} hover:text-red-600 hover:border-red-300 dark:hover:text-red-400 dark:hover:border-red-700`}
                      title={player ? 'Remove player' : 'Remove column'}
                      aria-label={`Remove ${playerName}`}
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                {slot.error && (
                  <p className="text-red-600 text-sm mt-1">{slot.error}</p>
                )}
              </div>
            );
          })}

          {/* Add Player Button - Shows when player 2 is loaded and there is room for another column */}
          {slots[1].player && slots.length < MAX_SLOTS && (
            <div className="flex items-end">
              <button
                onClick={handleAddPlayer}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors whitespace-nowrap"
              >
                + Add Player
              </button>
            </div>
          )}
        </div>

        {/* Comparison Layout */}
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-[30px]">
          {slots.map((slot, index) => {
            const { player } = slot;
            const playerName = getSlotName(slot, index);

            return (
              <div key={slot.key} className="flex-1">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 text-center">
                  {player ? (
                    <div className="flex flex-col items-center space-y-2">
                      <span>{playerName}</span>
                      <a 
                        href={`/players/${player.id}`}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline transition-colors"
                      >
                        Full Profile
                      </a>
                    </div>
                  ) : (
                    playerName
                  )}
                </h2>

                {slot.isLoading ? (
                  <div className="flex items-center justify-center h-64 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                      <p className="text-gray-500 dark:text-gray-400">Loading player data...</p>
                    </div>
                  </div>
                ) : player ? (
                  <div className="space-y-6">
                    {/* Player Card Column */}
                    <div className="flex flex-col items-center space-y-4 p-[5px]">
                      <PlayerImage player={player} />
                      <div className="w-full max-w-[400px]">
                        <PlayerStatsGrid player={player} />
                      </div>
                    </div>

                    {/* Position Ratings Column */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-[5px] p-[5px]">Position Ratings</h3>
                      <div className="w-full p-[5px]">
                        <PositionRatingsDisplay player={player} />
                      </div>
                    </div>

                    {/* Progression Graph Column */}
                    <div className="w-full">
                      <PlayerProgressionGraph 
                        playerId={player.id.toString()} 
                        playerName={playerName}
                        playerPositions={player.metadata.positions}
                      />
                    </div>

                    {/* Recent Matches Column */}
                    <div className="w-full p-[5px]">
                      <PlayerRecentMatches 
                        playerId={player.id.toString()} 
                        playerName={playerName}
                      />
                    </div>

                    {/* Sale History Column */}
                    <div className="w-full p-[5px]">
                      <PlayerSaleHistory 
                        playerId={player.id.toString()} 
                        playerName={playerName}
                        playerMetadata={player.metadata}
                        marketValueEstimate={slot.marketValueEstimate}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-64 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                    <div className="text-center">
                      <p className="text-gray-500 dark:text-gray-400">Enter a player ID to load player data</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const ComparePage = () => {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white dark:bg-[#111827] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">Loading compare page...</p>
        </div>
      </div>
    }>
      <ComparePageContent />
    </Suspense>
  );
};

export default ComparePage;
