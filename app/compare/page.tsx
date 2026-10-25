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
import { PageHeader, Panel, TierText, btnPrimary } from '../../src/components/ui';

interface CompareSlot {
  key: number; // Stable identity so a slot keeps its data and in-flight requests when it is moved
  playerId: string;
  player: MFLPlayer | null;
  isLoading: boolean;
  error: string | null;
  marketValueEstimate: MarketValueEstimate | null;
}

const MIN_SLOTS = 2;
const MAX_SLOTS = 4;

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

const slotControlClass = 'flex-none grid place-items-center w-11 h-11 rounded-xl border border-line-2 bg-panel text-fg-3 transition-colors cursor-pointer hover:border-line-hover hover:text-fg disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-line-2 disabled:hover:text-fg-3';

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

  // Get player IDs from URL search params: player1Id up to player4Id
  const urlPlayerIds = Array.from({ length: MAX_SLOTS }, (_, index) => searchParams.get(`player${index + 1}Id`) || '');
  const urlPlayerId = searchParams.get('playerId'); // Legacy support

  // Slot keys are counted per page instance, alongside the state they identify, so they stay unique
  const nextSlotKeyRef = useRef(0);
  const newSlot = (playerId = '') => createSlot(nextSlotKeyRef.current++, playerId);

  // Players being compared, in display order (left to right): two columns, or as many as the link fills
  const [slots, setSlots] = useState<CompareSlot[]>(() => {
    const ids = [urlPlayerIds[0] || urlPlayerId || '', ...urlPlayerIds.slice(1)];
    const count = Math.max(MIN_SLOTS, ids.reduce((last, id, index) => (id ? index + 1 : last), 0));
    return ids.slice(0, count).map(id => newSlot(id));
  });

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

  // Another column once every one has a player
  const allFilled = slots.every(slot => slot.player);
  const handleAddPlayer = () => {
    if (allFilled && slots.length < MAX_SLOTS) setSlots([...slots, newSlot()]);
  };

  // Remove a player. The slot is emptied where it is, so the other players never move.
  // Only a column beyond the first two goes away entirely: when it is the last one, or once it is already empty.
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

  // Columns stack once two no longer fit side by side; the switch arrows then point up and down.
  // Four players go two by two until all four fit in a row, rather than three and one left over.
  const gridColsClass =
    slots.length > 3 ? 'grid-cols-1 @min-[680px]:grid-cols-2 @min-[1340px]:grid-cols-4'
    : slots.length > 2 ? 'grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))]'
    : 'grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))]';
  const stackedArrowClass =
    slots.length > 3 ? '@max-[679px]:rotate-90' : slots.length > 2 ? '@max-[700px]:rotate-90' : '@max-[860px]:rotate-90';

  return (
    <div className="flex flex-col gap-[22px]">
      <PageHeader
        title="Compare Players"
        subtitle={`Enter player IDs to compare their stats and ratings, up to ${MAX_SLOTS} players side by side`}
        actions={
          // Up here, as below the columns it would sit under every player's matches and sales
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-muted">
              {slots.length} of {MAX_SLOTS} players
            </span>
            {slots.length < MAX_SLOTS && (
              <button
                onClick={handleAddPlayer}
                disabled={!allFilled}
                title={allFilled ? 'Compare another player' : 'Pick a player for every column first'}
                className={`${btnPrimary} h-11 px-5 text-sm`}
              >
                + Add Player
              </button>
            )}
          </div>
        }
      />

      {/* The container is its own element, as container queries only reach what is inside it */}
      <div className="@container">
        <div className={`grid ${gridColsClass} gap-5`}>
          {slots.map((slot, index) => {
            const { player } = slot;
            const playerName = getSlotName(slot, index);
            // Empty columns can only be removed when they are an extra column, beyond the first two
            const canRemove = !!player || slots.length > MIN_SLOTS;
            const suggestions = suggestionsSlotKey === slot.key ? getSuggestions(slot) : [];

            return (
              <div key={slot.key} className="flex flex-col gap-[18px] min-w-0">
                {/* Search Input */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`player${index + 1}`} className="text-xs font-semibold text-muted">
                    Player {index + 1} ID
                  </label>
                  <div className="flex gap-1.5">
                    <div className="relative flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 h-11 pl-3.5 pr-1.5 rounded-xl border border-line-2 bg-panel/90 transition-colors focus-within:border-line-hover">
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
                          className="flex-1 min-w-0 bg-transparent border-0 outline-none font-mono text-[15px] font-medium text-strong"
                        />
                        <button
                          onClick={() => handleSearch(slot)}
                          disabled={slot.isLoading || !slot.playerId.trim()}
                          className="flex-none h-8 px-3.5 rounded-[9px] bg-accent text-accent-fg text-[13px] font-bold whitespace-nowrap cursor-pointer transition-colors hover:bg-[#d8fb74] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {slot.isLoading ? 'Loading...' : 'Search'}
                        </button>
                      </div>

                      {/* Agency player suggestions, closest match first */}
                      {suggestionsSlotKey === slot.key && suggestions.length > 0 && (
                        <ul
                          role="listbox"
                          aria-label={`Agency players for player ${index + 1}`}
                          className="absolute z-20 left-0 right-0 mt-1.5 m-0 p-1 list-none max-h-80 overflow-y-auto rounded-2xl border border-line-2 bg-panel shadow-[0_20px_50px_rgba(0,0,0,.45)]"
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
                              className="px-3 py-2 rounded-xl cursor-pointer transition-colors hover:bg-row-hover"
                            >
                              <div className="flex items-center justify-between gap-2 text-sm text-fg">
                                <span className="truncate font-bold">
                                  {suggestion.metadata.firstName} {suggestion.metadata.lastName}
                                </span>
                                <span className="flex-shrink-0 text-[13px] font-semibold text-fg-3">
                                  {suggestion.metadata.positions?.join(', ')} · <TierText value={suggestion.metadata.overall} />
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-2 text-xs text-muted">
                                <span className="truncate">{suggestion.activeContract?.club?.name || 'No club'}</span>
                                <span className="flex-shrink-0">Age {suggestion.metadata.age} · <span className="font-mono">#{suggestion.id}</span></span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Switch / Remove controls */}
                    {player && (
                      <>
                        <button
                          onClick={() => handleMovePlayer(index, -1)}
                          disabled={index === 0}
                          className={slotControlClass}
                          title="Switch with the player on the left"
                          aria-label={`Move ${playerName} left`}
                        >
                          <svg className={`h-4 w-4 ${stackedArrowClass}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5M11 6l-6 6 6 6" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleMovePlayer(index, 1)}
                          disabled={index === slots.length - 1}
                          className={slotControlClass}
                          title="Switch with the player on the right"
                          aria-label={`Move ${playerName} right`}
                        >
                          <svg className={`h-4 w-4 ${stackedArrowClass}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
                          </svg>
                        </button>
                      </>
                    )}
                    {canRemove && (
                      <button
                        onClick={() => handleRemovePlayer(slot.key)}
                        className={`${slotControlClass} hover:text-danger-ink hover:border-red-500/45`}
                        title={player ? 'Remove player' : 'Remove column'}
                        aria-label={`Remove ${playerName}`}
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6 6 18" />
                        </svg>
                      </button>
                    )}
                  </div>
                  {slot.error && (
                    <p className="m-0 text-sm font-medium text-danger-ink">{slot.error}</p>
                  )}
                </div>

                {/* Player name and profile link */}
                <div className="flex flex-col items-center gap-1 text-center">
                  <h2 className="m-0 font-display text-[22px] font-bold">{playerName}</h2>
                  {player && (
                    <a
                      href={`/players/${player.id}`}
                      className="text-[13px] font-semibold text-accent-ink hover:text-accent-hover transition-colors"
                    >
                      Full Profile →
                    </a>
                  )}
                </div>

                {slot.isLoading ? (
                  <Panel className="flex items-center justify-center h-64 border-dashed border-line-2">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent mx-auto mb-4"></div>
                      <p className="m-0 text-sm font-medium text-muted">Loading player data...</p>
                    </div>
                  </Panel>
                ) : player ? (
                  <>
                    {/* Player Card */}
                    <div className="flex flex-col items-center gap-4">
                      <PlayerImage player={player} />
                      <PlayerStatsGrid player={player} />
                    </div>

                    {/* Position Ratings */}
                    <Panel className="p-[18px] flex flex-col gap-2">
                      <h3 className="m-0 mb-1 font-display text-lg font-bold">Position Ratings</h3>
                      <PositionRatingsDisplay player={player} />
                    </Panel>

                    <PlayerProgressionGraph
                      playerId={player.id.toString()}
                      playerName={playerName}
                      playerPositions={player.metadata.positions}
                    />

                    <PlayerRecentMatches
                      playerId={player.id.toString()}
                      playerName={playerName}
                    />

                    <PlayerSaleHistory
                      playerId={player.id.toString()}
                      playerName={playerName}
                      playerMetadata={player.metadata}
                      marketValueEstimate={slot.marketValueEstimate}
                    />
                  </>
                ) : (
                  <Panel className="flex items-center justify-center h-64 border-dashed border-line-2">
                    <div className="text-center">
                      <p className="m-0 text-sm font-medium text-muted">Enter a player ID to load player data</p>
                    </div>
                  </Panel>
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
      <Panel className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent mx-auto mb-4"></div>
          <p className="m-0 text-sm font-medium text-muted">Loading compare page...</p>
        </div>
      </Panel>
    }>
      <ComparePageContent />
    </Suspense>
  );
};

export default ComparePage;
