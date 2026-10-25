'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '../contexts/WalletContext';
import { supabaseDataService } from '../services/clientDataService';
import { getSquads, saveSquad, updateSquad, deleteSquad, renameSquad, reorderSquads, SavedSquad } from '../services/squadService';
import type { MFLPlayer } from '../types/mflApi';
import {
  BENCH_SIZE,
  FORMATIONS,
  FORMATION_NAMES,
  autoFillFromSquad,
  formationLabel,
  Lineup,
  SlotRef,
  assignPlayer,
  autoFillLineup,
  bestFreeSlot,
  changeFormation,
  defaultLineups,
  emptyBench,
  emptyReserves,
  emptyXi,
  fitSlots,
  fromSavedSquad,
  keepCaptain,
  lineupPlayerIds,
  nextLineupName,
  removePlayer,
  RESERVES_SIZE,
  savedSquadPlayerIds,
  SQUAD_SIZE,
  toSavedSquad,
  toggleCaptain,
  XI_SIZE,
} from '../utils/squadLineups';
import { currentSeason } from '../utils/playerSeasons';
import { isRetiringThisSeason } from '../utils/appSettings';
import { useToast, ToastContainer } from './Toast';
import WalletGate from './WalletGate';
import { PageHeader, Panel, Select, btnDanger, btnPill, btnPrimary } from './ui';
import PlayerPool, { POOL_PAGE_SIZE, PoolUse } from './squadBuilder/PlayerPool';
import { DEFAULT_POOL_FILTERS, PoolFilters, filterPool } from './squadBuilder/poolFilters';
import SquadAnalysis, { SquadGroup } from './squadBuilder/SquadAnalysis';
import { LineupBench, LineupPitch } from './squadBuilder/LineupPitch';
import LineupPanel from './squadBuilder/LineupPanel';
import SquadStatsTable, { lineupCsv, lineupRows } from './squadBuilder/SquadStatsTable';
import { LoadSquadModal, SaveSquadModal } from './squadBuilder/SquadModals';
import { CloseIcon, DragHandlers } from './squadBuilder/shared';

const spinnerClass = 'rounded-full border-2 border-accent border-t-transparent animate-spin';

// The squad being built is kept per wallet in the browser, so a refresh or a visit later carries on from it
const draftKey = (wallet: string) => `mfl-data-squad-builder:${wallet.toLowerCase()}`;

interface Draft {
  name: string;
  lineups: Lineup[];
  active: number;
}

function loadDraft(wallet: string): Draft | null {
  try {
    const draft = JSON.parse(window.localStorage.getItem(draftKey(wallet)) || 'null');
    const valid =
      Array.isArray(draft?.lineups) &&
      draft.lineups.length > 0 &&
      draft.lineups.every((lineup: Lineup) => FORMATIONS[lineup.formation] && Array.isArray(lineup.xi) && Array.isArray(lineup.bench));
    if (!valid) return null;
    return { name: typeof draft.name === 'string' ? draft.name : '', lineups: draft.lineups, active: Number(draft.active) || 0 };
  } catch {
    return null;
  }
}

function saveDraft(wallet: string, draft: Draft) {
  try {
    window.localStorage.setItem(draftKey(wallet), JSON.stringify(draft));
  } catch {
    // A convenience: without it the builder starts afresh next time
  }
}

/** Compares lineups with what was last saved under a name, so auto-save only sends real changes. */
const savedKey = (name: string, lineups: Lineup[]) =>
  JSON.stringify([
    name,
    lineups.map(({ name: lineupName, formation, xi, bench, reserves, captain }) => [lineupName, formation, xi, bench, reserves, captain]),
  ]);

const fileSafe = (text: string) => text.trim().replace(/[^a-z0-9_-]+/gi, '_') || 'squad';

export default function SquadBuilderPage() {
  const router = useRouter();
  const { isConnected, account, viewedAddress = null, isReady = true } = useWallet();
  // The connected wallet, or one pasted in to look at read-only (squads are only saved for your own)
  const walletAddress = (isConnected ? account : null) ?? viewedAddress;
  const isViewing = !(isConnected && account) && !!viewedAddress;
  const ownWallet = isViewing ? null : account;

  const [players, setPlayers] = useState<MFLPlayer[]>([]);
  // Players in a loaded squad as they were saved, for any no longer in the agency
  const [snapshots, setSnapshots] = useState<MFLPlayer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Which wallet the lineups were set up for, so a wallet switch never saves one wallet's squad as another's
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const [lineups, setLineups] = useState<Lineup[]>([]);
  const [active, setActive] = useState(0);
  const [squadName, setSquadName] = useState('');
  const [selected, setSelected] = useState<SlotRef | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  const dragged = useRef<number | null>(null);
  const panelRef = useRef<HTMLElement>(null);

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<PoolFilters>(DEFAULT_POOL_FILTERS);
  // The list follows the sliders a moment after they stop moving
  const [appliedFilters, setAppliedFilters] = useState<PoolFilters>(DEFAULT_POOL_FILTERS);
  const [poolPage, setPoolPage] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [statsGroup, setStatsGroup] = useState<SquadGroup | null>(null);
  const [pickQuery, setPickQuery] = useState('');

  const [savedSquads, setSavedSquads] = useState<SavedSquad[]>([]);
  const [isLoadingSquads, setIsLoadingSquads] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [pendingName, setPendingName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const lastSaved = useRef<string | null>(null);
  const { toasts, removeToast, success, error: showError, warning, info } = useToast();

  // The agency's players, then the squad left last time (or the best XI in two formations to start)
  useEffect(() => {
    if (!walletAddress) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    supabaseDataService
      // A viewed wallet may not be stored yet, so it is loaded from MFL when it isn't
      .getAgencyPlayers(walletAddress, { loadFromMfl: isViewing })
      .then(agency => {
        if (cancelled) return;
        const owned = new Set(agency.map(player => player.id));
        const draft = loadDraft(walletAddress);
        // Drafts left before lineups had reserves or captains have none
        const keep = (ids: unknown, size: number) => fitSlots(ids, size).map(id => (id !== null && owned.has(id) ? id : null));
        const restored = draft
          ? draft.lineups.map((lineup, index) =>
              keepCaptain({
                ...lineup,
                id: lineup.id ?? index + 1,
                xi: keep(lineup.xi, XI_SIZE),
                bench: keep(lineup.bench, BENCH_SIZE),
                reserves: keep(lineup.reserves, RESERVES_SIZE),
                captain: typeof lineup.captain === 'number' ? lineup.captain : null,
              })
            )
          : defaultLineups(agency);
        setPlayers(agency);
        setSnapshots([]);
        setLineups(restored);
        setActive(Math.min(draft?.active ?? 0, restored.length - 1));
        setSquadName(draft?.name ?? '');
        setSelected(null);
        lastSaved.current = draft?.name ? savedKey(draft.name, restored) : null;
        setLoadedFor(walletAddress);
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load agency players');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [walletAddress, isViewing]);

  useEffect(() => {
    if (!ownWallet) {
      setSavedSquads([]);
      return;
    }
    setIsLoadingSquads(true);
    getSquads(ownWallet)
      .then(setSavedSquads)
      .catch(err => showError('Load Failed', err instanceof Error ? err.message : 'Failed to load saved squads. Please try again.'))
      .finally(() => setIsLoadingSquads(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownWallet]);

  const playersById = useMemo(() => new Map([...snapshots, ...players].map(player => [player.id, player])), [snapshots, players]);
  const activeIndex = Math.min(active, Math.max(0, lineups.length - 1));
  const lineup = lineups[activeIndex] as Lineup | undefined;

  useEffect(() => {
    if (!walletAddress || loadedFor !== walletAddress || lineups.length === 0) return;
    saveDraft(walletAddress, { name: squadName, lineups, active: activeIndex });
  }, [walletAddress, loadedFor, lineups, activeIndex, squadName]);

  const persistSquad = async (name: string): Promise<boolean> => {
    if (!ownWallet) return false;
    const { formationId, players: data } = toSavedSquad(lineups, playersById);
    setIsSaving(true);
    try {
      const existing = savedSquads.find(squad => squad.squad_name.toLowerCase() === name.toLowerCase());
      if (existing) await updateSquad(existing.id, ownWallet, name, formationId, data);
      else await saveSquad(ownWallet, name, formationId, data);
      lastSaved.current = savedKey(name, lineups);
      setSavedSquads(await getSquads(ownWallet));
      return true;
    } catch (err) {
      showError('Save Failed', err instanceof Error ? err.message : 'Failed to save squad', 2000);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // A squad that has a name saves itself a moment after each change
  useEffect(() => {
    const name = squadName.trim();
    if (!ownWallet || !name || loadedFor !== walletAddress || !lineups.some(l => lineupPlayerIds(l).length > 0)) return;
    if (savedKey(name, lineups) === lastSaved.current) return;
    const timer = window.setTimeout(() => persistSquad(name), 800);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownWallet, squadName, lineups, loadedFor, walletAddress]);

  // Below the pitch on narrower screens, the picker is scrolled to when a position is picked
  useEffect(() => {
    const panel = panelRef.current;
    if (!selected || !panel) return;
    const { top, bottom } = panel.getBoundingClientRect();
    if (top > window.innerHeight - 120 || bottom < 0) panel.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, [selected]);

  const otherSquads = useMemo(() => {
    const names = new Map<number, string[]>();
    savedSquads.forEach(squad => {
      if (squad.squad_name === squadName) return;
      savedSquadPlayerIds(squad).forEach(id => names.set(id, [...(names.get(id) ?? []), squad.squad_name]));
    });
    return names;
  }, [savedSquads, squadName]);

  useEffect(() => {
    const timer = window.setTimeout(() => setAppliedFilters(filters), 200);
    return () => window.clearTimeout(timer);
  }, [filters]);

  const poolPlayers = useMemo(() => {
    const picked = new Set(lineup ? lineupPlayerIds(lineup) : []);
    return filterPool(players, search, appliedFilters, player => picked.has(player.id) || otherSquads.has(player.id));
  }, [players, search, appliedFilters, lineup, otherSquads]);

  if (isReady && !walletAddress) {
    return <WalletGate title="Squad Builder" description="your players and build squads from them" />;
  }

  if (!isReady || isLoading) {
    return (
      <Panel className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <div className={`w-8 h-8 ${spinnerClass}`}></div>
        <p className="m-0 text-sm font-medium text-muted">{!isReady ? 'Checking wallet connection...' : 'Loading squad builder...'}</p>
      </Panel>
    );
  }

  if (error || !lineup) {
    return (
      <Panel className="flex flex-col items-center gap-5 max-w-md mx-auto px-6 py-12 text-center">
        <div className="flex flex-col gap-2">
          <h2 className="m-0 font-display text-2xl font-bold text-fg">Error</h2>
          <p className="m-0 text-sm text-muted">{error ?? 'The squad builder could not start.'}</p>
        </div>
        <div className="flex flex-col gap-2.5 w-full">
          <button onClick={() => window.location.reload()} className={`${btnPrimary} w-full`}>
            Try Again
          </button>
          <button onClick={() => router.push('/')} className={`${btnPill} w-full`}>
            Back to Home
          </button>
        </div>
      </Panel>
    );
  }

  const updateLineup = (change: (current: Lineup) => Lineup) => setLineups(all => all.map((l, i) => (i === activeIndex ? change(l) : l)));
  const assign = (playerId: number, slot: SlotRef) => updateLineup(current => assignPlayer(current, playerId, slot));
  const remove = (playerId: number) => updateLineup(current => removePlayer(current, playerId));
  const toggleCaptainOf = (playerId: number) => updateLineup(current => toggleCaptain(current, playerId));

  const select = (slot: SlotRef) => {
    setSelected(current => (current?.type === slot.type && current.index === slot.index ? null : slot));
    setPickQuery('');
  };

  const place = (player: MFLPlayer) => {
    if (selected) {
      assign(player.id, selected);
      setSelected(null);
      return;
    }
    if (lineupPlayerIds(lineup).includes(player.id)) return;
    const slot = bestFreeSlot(lineup, player);
    if (slot) assign(player.id, slot);
    else info('Squad full', `The squad has its ${SQUAD_SIZE} players. Remove one to make room.`, 2500);
  };

  const drag: DragHandlers = {
    start: playerId => e => {
      dragged.current = playerId;
      try {
        e.dataTransfer.setData('text/plain', String(playerId));
        e.dataTransfer.effectAllowed = 'move';
      } catch {
        // Some browsers refuse data on drag start; the ref still carries the player
      }
    },
    end: () => {
      dragged.current = null;
      setOverKey(null);
    },
    over: key => e => {
      e.preventDefault();
      setOverKey(key);
    },
    leave: key => () => setOverKey(current => (current === key ? null : current)),
    drop: slot => e => {
      e.preventDefault();
      e.stopPropagation();
      const playerId = dragged.current ?? (Number(e.dataTransfer.getData('text/plain')) || null);
      dragged.current = null;
      setOverKey(null);
      if (playerId !== null && playersById.has(playerId)) assign(playerId, slot);
    },
    overKey,
  };

  const whereIs = (player: MFLPlayer): PoolUse | null => {
    if (lineup.xi.includes(player.id)) return { label: 'XI' };
    if (lineup.bench.includes(player.id)) return { label: 'Bench' };
    if (lineup.reserves.includes(player.id)) return { label: 'Reserves', title: 'Out of the matchday squad' };
    const squads = otherSquads.get(player.id);
    return squads ? { label: 'Other squad', title: `In ${squads.join(', ')}` } : null;
  };

  const addLineup = () => {
    setLineups(all => [
      ...all,
      { ...lineup, id: Date.now(), name: nextLineupName(all), xi: [...lineup.xi], bench: [...lineup.bench], reserves: [...lineup.reserves] },
    ]);
    setActive(lineups.length);
    setSelected(null);
  };

  const deleteLineup = (index: number) => {
    setLineups(all => all.filter((_, i) => i !== index));
    setActive(Math.max(0, Math.min(activeIndex >= index ? activeIndex - 1 : activeIndex, lineups.length - 2)));
    setSelected(null);
  };

  const clearSquad = () => {
    setLineups(all => all.map(l => ({ ...l, xi: emptyXi(), bench: emptyBench(), reserves: emptyReserves(), captain: null })));
    setSquadName('');
    setSnapshots([]);
    setSelected(null);
    lastSaved.current = null;
  };

  const handleSave = async () => {
    const name = squadName.trim();
    if (!name) {
      setPendingName('');
      setShowSaveModal(true);
      return;
    }
    if (await persistSquad(name)) success('Squad Saved', `"${name}" is saved.`, 2000);
  };

  const confirmSaveName = async () => {
    const name = pendingName.trim();
    if (!name) return;
    setShowSaveModal(false);
    setSquadName(name);
    if (await persistSquad(name)) success('Squad Saved', `"${name}" is saved.`, 2000);
  };

  const handleLoad = (squad: SavedSquad) => {
    const { lineups: loaded, players: saved, dropped } = fromSavedSquad(squad);
    if (loaded.length === 0) {
      showError('Load Failed', 'That squad has no lineups the builder can show.', 2500);
      return;
    }
    setSnapshots(saved);
    setLineups(loaded);
    setActive(0);
    setSelected(null);
    setSquadName(squad.squad_name);
    lastSaved.current = savedKey(squad.squad_name, loaded);
    setShowLoadModal(false);
    if (dropped > 0) warning('Squad Full', `${dropped} of the squad's players didn't fit in its ${SQUAD_SIZE} and were left out.`, 4000);
  };

  const handleDelete = async (squad: SavedSquad) => {
    if (!ownWallet) return;
    if (!confirm(`Are you sure you want to delete "${squad.squad_name}"? This action cannot be undone.`)) return;
    setDeletingId(squad.id);
    try {
      await deleteSquad(squad.id, ownWallet);
      setSavedSquads(await getSquads(ownWallet));
      success('Squad Deleted', `"${squad.squad_name}" has been deleted.`, 2000);
      // The lineups stay on screen as a new, unsaved squad
      if (squad.squad_name === squadName) {
        setSquadName('');
        lastSaved.current = null;
      }
    } catch (err) {
      showError('Delete Failed', err instanceof Error ? err.message : 'Failed to delete the squad. Please try again.', 2000);
    } finally {
      setDeletingId(null);
    }
  };

  const handleRename = async (squad: SavedSquad, name: string): Promise<boolean> => {
    const newName = name.trim();
    if (!ownWallet || !newName) return false;
    if (newName === squad.squad_name) return true;
    try {
      await renameSquad(squad, ownWallet, newName);
      setSavedSquads(await getSquads(ownWallet));
      // The squad on screen carries on saving under its new name, with any changes not yet saved still to save
      if (squad.squad_name === squadName) {
        if (lastSaved.current === savedKey(squadName, lineups)) lastSaved.current = savedKey(newName, lineups);
        setSquadName(newName);
      }
      success('Squad Renamed', `"${squad.squad_name}" is now "${newName}".`, 2000);
      return true;
    } catch (err) {
      showError('Rename Failed', err instanceof Error ? err.message : 'Failed to rename the squad. Please try again.', 2500);
      return false;
    }
  };

  const handleReorder = async (ordered: SavedSquad[]) => {
    if (!ownWallet) return;
    setSavedSquads(ordered);
    try {
      await reorderSquads(ownWallet, ordered.map(squad => squad.id));
    } catch (err) {
      showError('Reorder Failed', err instanceof Error ? err.message : 'Failed to save the order. Please try again.', 2500);
      // Back to the order as it is saved
      try {
        setSavedSquads(await getSquads(ownWallet));
      } catch {
        // The failure is already shown
      }
    }
  };

  const handleExport = () => {
    const blob = new Blob([lineupCsv(lineup, playersById)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileSafe(squadName || 'squad')}_${fileSafe(lineup.name)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const season = currentSeason(players);
  const savedSquad = savedSquads.find(squad => squad.squad_name === squadName);
  const hasPlayers = lineups.some(l => lineupPlayerIds(l).length > 0);

  return (
    <div className="flex flex-col gap-[18px]">
      <PageHeader
        title="Squad Builder"
        subtitle={
          isViewing ? (
            <>
              Viewing <span className="font-mono text-sm text-fg-2">{walletAddress}</span> read-only · connect your wallet to save squads
            </>
          ) : squadName ? (
            <>
              <span className="font-semibold text-fg-2">{squadName}</span> · changes save automatically
            </>
          ) : undefined
        }
        actions={
          <>
            {ownWallet && (
              <button type="button" className={btnPill} onClick={() => setShowLoadModal(true)}>
                Load Squad
              </button>
            )}
            {ownWallet && (
              <button type="button" className={btnPrimary} onClick={handleSave} disabled={isSaving || !hasPlayers}>
                {isSaving && <span className="inline-block w-3 h-3 rounded-full border-2 border-accent-fg border-t-transparent animate-spin" aria-hidden="true"></span>}
                {isSaving ? 'Saving…' : 'Save Squad'}
              </button>
            )}
            <button type="button" className={btnPill} onClick={clearSquad}>
              Clear Squad
            </button>
            {ownWallet && savedSquad && (
              <button type="button" className={btnDanger} onClick={() => handleDelete(savedSquad)}>
                Delete Squad
              </button>
            )}
          </>
        }
      />

      <div className="grid gap-[18px] items-start [grid-template-areas:'pool'_'center'_'panel'] min-[64rem]:grid-cols-[300px_minmax(0,1fr)] min-[64rem]:[grid-template-areas:'pool_center'_'pool_panel'] min-[76rem]:grid-cols-[300px_minmax(0,1fr)_300px] min-[76rem]:[grid-template-areas:'pool_center_panel'] min-[90rem]:grid-cols-[330px_minmax(0,1fr)_330px]">
        <PlayerPool
          players={poolPlayers}
          totalCount={players.length}
          search={search}
          onSearch={value => {
            setSearch(value);
            setPoolPage(0);
          }}
          showFilters={showFilters}
          onToggleFilters={() => setShowFilters(shown => !shown)}
          filters={filters}
          onFilters={next => {
            setFilters(next);
            setPoolPage(0);
          }}
          // Placing a player leaves the list on its page, unless hiding them empties the last one
          page={Math.min(poolPage, Math.max(0, Math.ceil(poolPlayers.length / POOL_PAGE_SIZE) - 1))}
          onPage={setPoolPage}
          season={season}
          whereIs={whereIs}
          onPlace={place}
          onDropBack={playerId => {
            if (lineupPlayerIds(lineup).includes(playerId)) remove(playerId);
          }}
          drag={drag}
          draggedId={() => dragged.current}
        />

        <div className="[grid-area:center] min-w-0 flex flex-col gap-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1 p-1 rounded-full border border-line bg-panel" aria-label="Lineups">
              {lineups.map((l, index) => {
                const isActive = index === activeIndex;
                return (
                  <div key={l.id} className={`flex items-center rounded-full ${isActive ? 'bg-accent text-accent-fg' : 'text-fg-3'}`}>
                    <button
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => {
                        setActive(index);
                        setSelected(null);
                      }}
                      className="flex items-center gap-2 h-[34px] pl-3.5 pr-1.5 text-[13px] font-bold whitespace-nowrap cursor-pointer"
                    >
                      {l.name}
                      <span className="font-mono text-xs font-semibold opacity-75">{formationLabel(l.formation)}</span>
                    </button>
                    {lineups.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => deleteLineup(index)}
                        title="Remove formation"
                        aria-label={`Remove ${l.name}`}
                        className="w-[26px] h-[26px] mr-1 rounded-full grid place-items-center opacity-60 hover:opacity-100 cursor-pointer"
                      >
                        <CloseIcon />
                      </button>
                    ) : (
                      <span className="w-2.5" />
                    )}
                  </div>
                );
              })}
              <button
                type="button"
                onClick={addLineup}
                className="h-[34px] px-3.5 rounded-full border border-dashed border-line-2 text-fg-3 text-[13px] font-bold whitespace-nowrap cursor-pointer transition-colors hover:border-line-hover"
              >
                + Add formation
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 ml-auto">
              <label className="flex items-center gap-2 text-xs font-semibold text-muted">
                Formation
                <Select
                  value={lineup.formation}
                  onChange={e => {
                    const formation = e.target.value;
                    updateLineup(current => changeFormation(current, formation, playersById));
                    setSelected(null);
                  }}
                  className="font-mono font-bold"
                >
                  {FORMATION_NAMES.map(name => (
                    <option key={name} value={name}>
                      {formationLabel(name)}
                    </option>
                  ))}
                </Select>
              </label>
              <button
                type="button"
                onClick={() => {
                  // New players come from those the list shows. Hiding selected players leaves the squad's own in, as they are what it rebuilds.
                  const shown = filterPool(players, search, filters, player => otherSquads.has(player.id));
                  // The players already in the squad's lineups go first, less any the retiring filter hides
                  const squad = [...new Set(lineups.flatMap(lineupPlayerIds))]
                    .map(id => playersById.get(id))
                    .filter((player): player is MFLPlayer => !!player && !(filters.hideRetiring && isRetiringThisSeason(player)));
                  if (squad.length === 0 && shown.length === 0) {
                    info('No Players', 'No players match the search and filters.', 2500);
                    return;
                  }
                  // The captain keeps the armband if they still start
                  updateLineup(current =>
                    keepCaptain({
                      ...current,
                      ...(squad.length > 0 ? autoFillFromSquad(current.formation, squad, shown) : autoFillLineup(current.formation, shown)),
                    })
                  );
                  setSelected(null);
                }}
                title="Fills the lineup from the squad's players, and from the players the list shows for any position they can't play"
                className="inline-flex items-center justify-center h-10 px-4 rounded-full border border-pos-line bg-btn-pos text-pos-ink text-[13px] font-bold whitespace-nowrap cursor-pointer transition-colors hover:border-pos-ink"
              >
                Auto-fill best XI
              </button>
              <button
                type="button"
                onClick={() => {
                  updateLineup(current => ({ ...current, xi: emptyXi(), bench: emptyBench(), reserves: emptyReserves(), captain: null }));
                  setSelected(null);
                }}
                className={btnPill}
              >
                Clear
              </button>
            </div>
          </div>

          <LineupPitch
            lineup={lineup}
            playersById={playersById}
            selected={selected}
            onSelect={select}
            onRemove={remove}
            onToggleCaptain={toggleCaptainOf}
            drag={drag}
          />
          <LineupBench lineup={lineup} playersById={playersById} selected={selected} onSelect={select} onRemove={remove} drag={drag} />
        </div>

        <LineupPanel
          panelRef={panelRef}
          lineup={lineup}
          players={players}
          playersById={playersById}
          selected={selected}
          onSelect={select}
          onToggleCaptain={toggleCaptainOf}
          onClose={() => setSelected(null)}
          onPick={player => {
            if (!selected) return;
            assign(player.id, selected);
            setSelected(null);
          }}
          query={pickQuery}
          onQuery={setPickQuery}
        />
      </div>

      <div className="flex flex-col gap-3">
        <SquadAnalysis players={lineupRows(lineup, playersById).map(row => row.player)} group={statsGroup} onGroup={setStatsGroup} season={season} />
        <SquadStatsTable lineup={lineup} playersById={playersById} group={statsGroup} season={season} onExport={handleExport} />
      </div>

      {showSaveModal && (
        <SaveSquadModal name={pendingName} onName={setPendingName} onSave={confirmSaveName} onCancel={() => setShowSaveModal(false)} isSaving={isSaving} />
      )}
      {showLoadModal && (
        <LoadSquadModal
          squads={savedSquads}
          isLoading={isLoadingSquads}
          deletingId={deletingId}
          onLoad={handleLoad}
          onDelete={handleDelete}
          onRename={handleRename}
          onReorder={handleReorder}
          onClose={() => setShowLoadModal(false)}
        />
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
