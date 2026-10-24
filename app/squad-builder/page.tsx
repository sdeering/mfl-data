'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import * as Slider from '@radix-ui/react-slider';
import { useRouter } from 'next/navigation';
import type { MFLPosition } from '../../src/types/positionOvr';
import { calculateAllPositionOVRs as rbCalculateAllPositionOVRs, calculatePositionOVR as rbCalculatePositionOVR } from '../../src/utils/ruleBasedPositionCalculator';
import { useWallet } from '../../src/contexts/WalletContext';
import { supabaseDataService } from '../../src/services/clientDataService';
import { MFLPlayer } from '../../src/types/mflApi';
import { getSquads, saveSquad, updateSquad, deleteSquad, loadSquad, SavedSquad } from '../../src/services/squadService';
import { useToast, ToastContainer } from '../../src/components/Toast';
import RetirementIcon from '../../src/components/RetirementIcon';
import {
  PageHeader,
  Panel,
  TierBadge,
  TierText,
  PositionChip,
  KpiTile,
  Select,
  SortArrow,
  btnPrimary,
  btnSecondary,
  btnPill,
  btnDanger,
  fieldClass,
  labelClass,
  tableClass,
  theadRowClass,
  thClass,
  sortableThClass,
  rowClass,
  tdClass,
} from '../../src/components/ui';
import { getTierColors } from '../../src/utils/tierColors';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Types for squad builder
interface Formation {
  id: string;
  name: string;
  positions: string[];
  layout: { [key: string]: { x: number; y: number } };
}

// Position rating calculation function
function calculatePositionRating(player: MFLPlayer, position: string): number {
  const positionKey = position.replace(/[0-9]+$/, '');
  const { pace, shooting, passing, dribbling, defense, physical, goalkeeping, overall } = player.metadata;
  const positions = player.metadata.positions;
  const primaryPosition = positions[0];
  
  // Position attribute weights (simplified version)
  const positionWeights: { [key: string]: { [key: string]: number } } = {
    'ST': { shooting: 0.4, pace: 0.3, physical: 0.2, dribbling: 0.1 },
    'CF': { shooting: 0.35, passing: 0.25, pace: 0.2, dribbling: 0.2 },
    'CAM': { passing: 0.4, dribbling: 0.3, shooting: 0.2, pace: 0.1 },
    'RW': { pace: 0.4, dribbling: 0.3, passing: 0.2, shooting: 0.1 },
    'LW': { pace: 0.4, dribbling: 0.3, passing: 0.2, shooting: 0.1 },
    'RM': { pace: 0.35, passing: 0.3, dribbling: 0.25, defense: 0.1 },
    'LM': { pace: 0.35, passing: 0.3, dribbling: 0.25, defense: 0.1 },
    'CM': { passing: 0.35, dribbling: 0.25, defense: 0.25, pace: 0.15 },
    'CDM': { defense: 0.4, passing: 0.3, physical: 0.2, pace: 0.1 },
    'RWB': { pace: 0.35, defense: 0.3, passing: 0.25, dribbling: 0.1 },
    'LWB': { pace: 0.35, defense: 0.3, passing: 0.25, dribbling: 0.1 },
    'RB': { defense: 0.4, pace: 0.3, passing: 0.2, physical: 0.1 },
    'LB': { defense: 0.4, pace: 0.3, passing: 0.2, physical: 0.1 },
    'CB': { defense: 0.5, physical: 0.3, passing: 0.15, pace: 0.05 },
    'GK': { goalkeeping: 1.0 }
  };

  // If it's the primary position, return the overall rating
  if (primaryPosition === positionKey) {
    return overall;
  }

  // Calculate rating based on position weights
  const weights = positionWeights[positionKey];
  if (!weights) return 0;

  let rating = 0;
  for (const [attribute, weight] of Object.entries(weights)) {
    switch (attribute) {
      case 'pace': rating += pace * weight; break;
      case 'shooting': rating += shooting * weight; break;
      case 'passing': rating += passing * weight; break;
      case 'dribbling': rating += dribbling * weight; break;
      case 'defense': rating += defense * weight; break;
      case 'physical': rating += physical * weight; break;
      case 'goalkeeping': rating += goalkeeping * weight; break;
    }
  }

  // Apply small familiarity adjustment but keep value bounded
  const familiarityPenalty = positions.includes(position as any) ? 0 : -5;
  return Math.max(0, Math.round(rating + familiarityPenalty));
}

// Squad statistics calculation functions
function calculateSquadStats(squad: Squad, players: MFLPlayer[]) {
  const squadPlayers = Object.values(squad.players);
  const totalPlayers = squadPlayers.length;
  
  if (totalPlayers === 0) {
    return {
      averageOverall: 0,
      totalPlayers: 0,
      top11Average: 0,
      top16Average: 0,
      chemistry: 0,
      formationEffectiveness: 0,
      positionCoverage: 0,
      stats: {
        pace: 0,
        shooting: 0,
        passing: 0,
        dribbling: 0,
        defense: 0,
        physical: 0
      }
    };
  }

  // Calculate average overall rating
  const totalOverall = squadPlayers.reduce((sum, squadPlayer) => {
    return sum + (squadPlayer?.player.metadata.overall || 0);
  }, 0);
  const averageOverall = totalOverall / totalPlayers;

  // Calculate top 11 players average
  const sortedPlayers = squadPlayers
    .map(sp => sp?.player.metadata.overall || 0)
    .sort((a, b) => b - a); // Sort descending
  const top11Players = sortedPlayers.slice(0, 11);
  const top11Average = top11Players.length > 0 
    ? top11Players.reduce((sum, rating) => sum + rating, 0) / top11Players.length
    : 0;

  // Calculate top 16 players average
  const top16Players = sortedPlayers.slice(0, 16);
  const top16Average = top16Players.length > 0 
    ? top16Players.reduce((sum, rating) => sum + rating, 0) / top16Players.length
    : 0;

  // Calculate average stats (chemistry removed per spec) - exclude goalkeepers
  const outfieldPlayers = squadPlayers.filter(p => !p?.player.metadata.positions?.includes('GK'));
  const outfieldPlayerCount = outfieldPlayers.length;
  
  const stats = outfieldPlayerCount > 0 ? {
    pace: Math.round(outfieldPlayers.reduce((sum, p) => sum + (p?.player.metadata.pace || 0), 0) / outfieldPlayerCount),
    shooting: Math.round(outfieldPlayers.reduce((sum, p) => sum + (p?.player.metadata.shooting || 0), 0) / outfieldPlayerCount),
    passing: Math.round(outfieldPlayers.reduce((sum, p) => sum + (p?.player.metadata.passing || 0), 0) / outfieldPlayerCount),
    dribbling: Math.round(outfieldPlayers.reduce((sum, p) => sum + (p?.player.metadata.dribbling || 0), 0) / outfieldPlayerCount),
    defense: Math.round(outfieldPlayers.reduce((sum, p) => sum + (p?.player.metadata.defense || 0), 0) / outfieldPlayerCount),
    physical: Math.round(outfieldPlayers.reduce((sum, p) => sum + (p?.player.metadata.physical || 0), 0) / outfieldPlayerCount)
  } : {
    pace: 0,
    shooting: 0,
    passing: 0,
    dribbling: 0,
    defense: 0,
    physical: 0
  };

  // Chemistry removed
  const chemistry = 0;

  // Calculate formation effectiveness (based on how well players fit the formation)
  const formationPositions = squad.formation.positions;
  const filledPositions = Object.keys(squad.players).length;
  const formationEffectiveness = Math.round((filledPositions / formationPositions.length) * 100);

  // Calculate position coverage
  const positionCoverage = Math.round((filledPositions / formationPositions.length) * 100);

  return {
    averageOverall,
    totalPlayers,
    top11Average,
    top16Average,
    chemistry,
    formationEffectiveness,
    positionCoverage,
    stats
  };
}

// Validation function for player position compatibility
function validatePlayerPosition(player: MFLPlayer, position: string) {
  const playerPositions = player.metadata.positions;
  const basePosition = position.replace(/[0-9]+$/, '');
  const positionRating = calculatePositionRating(player, basePosition as any);
  const overall = player.metadata.overall;

  const isGoalkeeper = playerPositions.includes('GK');
  const isGoalkeeperPosition = basePosition === 'GK';
  if (isGoalkeeper && !isGoalkeeperPosition) return { isValid: false, reason: 'Goalkeeper cannot play outfield' };
  if (!isGoalkeeper && isGoalkeeperPosition) return { isValid: false, reason: 'Outfield player cannot play goalkeeper' };

  // Relaxed: allow any outfield position (spec: remove validation), keep GK restriction
  return { isValid: true, reason: 'Allowed (validation relaxed)' };
}

// Validation removed per spec

// Calculate formation effectiveness for any formation
function calculateFormationEffectiveness(squad: Squad, formation: Formation, allPlayers: MFLPlayer[]) {
  const squadPlayers = Object.values(squad.players);
  
  if (squadPlayers.length === 0) return 0;
  
  let totalEffectiveness = 0;
  let playerCount = 0;
  
  // Calculate effectiveness for each position in the formation
  formation.positions.forEach(position => {
    const playerInPosition = squad.players[position];
    if (playerInPosition) {
      const positionRating = calculatePositionRating(playerInPosition.player, position as any);
      const playerPositions = playerInPosition.player.metadata.positions;
      
      // Bonus for natural position
      let effectiveness = positionRating;
      if (playerPositions.includes(position as any)) {
        effectiveness += 15; // Bonus for natural position
      }
      
      // Cap at 100
      effectiveness = Math.min(effectiveness, 100);
      
      totalEffectiveness += effectiveness;
      playerCount++;
    } else {
      // Penalty for empty position
      totalEffectiveness += 0;
      playerCount++;
    }
  });
  
  // Calculate average effectiveness
  const averageEffectiveness = playerCount > 0 ? totalEffectiveness / playerCount : 0;
  
  // Apply formation-specific bonuses based on squad strengths
  const stats = calculateSquadStats(squad, allPlayers);
  let formationBonus = 0;
  
  // Formation-specific bonuses
  switch (formation.id) {
    case '433-attack':
      // Attacking formation benefits from pace and shooting
      formationBonus = (stats.stats.pace + stats.stats.shooting) / 20;
      break;
    case '532':
      // Defensive formation benefits from defense and physical
      formationBonus = (stats.stats.defense + stats.stats.physical) / 20;
      break;
    case '4231':
      // Possession formation benefits from passing and dribbling
      formationBonus = (stats.stats.passing + stats.stats.dribbling) / 20;
      break;
    case '442':
      // Balanced formation gets small bonus for balanced stats
      const balance = Math.min(stats.stats.pace, stats.stats.shooting, stats.stats.passing, stats.stats.defense);
      formationBonus = balance / 25;
      break;
    case '352':
      // Wing-back formation benefits from pace and passing
      formationBonus = (stats.stats.pace + stats.stats.passing) / 20;
      break;
    default:
      formationBonus = 0;
  }
  
  const finalEffectiveness = Math.min(Math.round(averageEffectiveness + formationBonus), 100);
  return Math.max(finalEffectiveness, 0);
}

interface SquadPlayer {
  player: MFLPlayer;
  position: string;
}

interface Squad {
  id?: string;
  name: string;
  formation: Formation;
  players: { [position: string]: SquadPlayer };
  createdAt?: string;
  updatedAt?: string;
}

// Available formations
const FORMATIONS: Formation[] = [
  {
    id: '4-4-2',
    name: '4-4-2',
    positions: ['GK', 'LB', 'CB1', 'CB2', 'RB', 'LM', 'CM1', 'CM2', 'RM', 'ST1', 'ST2'],
    layout: {
      'GK': { x: 50, y: 90 },
      'LB': { x: 20, y: 70 },
      'CB1': { x: 35, y: 70 },
      'CB2': { x: 65, y: 70 },
      'RB': { x: 80, y: 70 },
      'LM': { x: 20, y: 50 },
      'CM1': { x: 40, y: 50 },
      'CM2': { x: 60, y: 50 },
      'RM': { x: 80, y: 50 },
      'ST1': { x: 40, y: 20 },
      'ST2': { x: 60, y: 20 }
    }
  },
  {
    id: '4-3-3',
    name: '4-3-3',
    positions: ['GK', 'LB', 'CB1', 'CB2', 'RB', 'CDM', 'CM1', 'CM2', 'LW', 'ST', 'RW'],
    layout: {
      'GK': { x: 50, y: 90 },
      'LB': { x: 20, y: 70 },
      'CB1': { x: 35, y: 70 },
      'CB2': { x: 65, y: 70 },
      'RB': { x: 80, y: 70 },
      'CDM': { x: 50, y: 60 },
      'CM1': { x: 35, y: 50 },
      'CM2': { x: 65, y: 50 },
      'LW': { x: 20, y: 20 },
      'ST': { x: 50, y: 20 },
      'RW': { x: 80, y: 20 }
    }
  },
  {
    id: '3-5-2',
    name: '3-5-2',
    positions: ['GK', 'CB1', 'CB2', 'CB3', 'LWB', 'CDM', 'CM1', 'CM2', 'RWB', 'ST1', 'ST2'],
    layout: {
      'GK': { x: 50, y: 90 },
      'CB1': { x: 30, y: 70 },
      'CB2': { x: 50, y: 70 },
      'CB3': { x: 70, y: 70 },
      'LWB': { x: 15, y: 50 },
      'CDM': { x: 50, y: 60 },
      'CM1': { x: 35, y: 50 },
      'CM2': { x: 65, y: 50 },
      'RWB': { x: 85, y: 50 },
      'ST1': { x: 40, y: 20 },
      'ST2': { x: 60, y: 20 }
    }
  }
];

const spinnerClass = 'rounded-full border-2 border-accent border-t-transparent animate-spin';
const smallPillClass =
  'inline-flex items-center justify-center h-8 px-3 rounded-full border border-line-2 bg-panel text-fg-2 text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors hover:border-line-hover disabled:opacity-50 disabled:cursor-not-allowed';
const playerLinkClass =
  'flex-none inline-grid place-items-center w-[18px] h-[18px] rounded-md border border-line-2 text-[10px] text-muted transition-colors hover:text-accent-ink hover:border-accent-ink';
const multiSquadBadgeClass =
  'relative flex-none inline-grid place-items-center w-[18px] h-[18px] rounded-full border border-orange-500/45 bg-orange-500/12 text-[10px] text-orange-ink cursor-help';
const modalBackdropClass = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60';
const modalClass = 'w-full p-5 md:p-6 rounded-2xl border border-line-2 bg-panel shadow-[0_20px_50px_rgba(0,0,0,.45)]';
const sliderRootClass = 'relative flex items-center select-none w-full h-5';
const sliderTrackClass = 'relative grow h-1 rounded-full bg-line-2';
const sliderRangeClass = 'absolute h-1 rounded-full bg-accent';
const sliderThumbClass =
  'block w-3.5 h-3.5 rounded-full bg-accent border-2 border-panel shadow-[0_0_0_1px_rgba(0,0,0,.3)] cursor-grab outline-none focus-visible:ring-2 focus-visible:ring-accent/50';
const sliderLabelClass = 'block mb-1.5 text-xs font-semibold text-muted';

/** List of the saved squads a player is in, floating above the warning badge they hover. */
function MultiSquadPopover({ squadNames, position }: { squadNames: string[]; position: { x: number; y: number } }) {
  return createPortal(
    <div
      className="fixed z-[99999] px-3 py-2 rounded-xl border border-line-2 bg-panel text-xs text-fg whitespace-nowrap shadow-[0_20px_50px_rgba(0,0,0,.45)]"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translateX(-50%) translateY(-100%)',
        marginTop: '-8px'
      }}
    >
      <div className="font-semibold mb-1">Player in multiple squads:</div>
      <div className="space-y-1">
        {squadNames.map((squadName, index) => (
          <div key={index} className="text-orange-ink">
            • {squadName}
          </div>
        ))}
      </div>
      <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-line-2"></div>
    </div>,
    document.body
  );
}

// Draggable Player Card Component
interface DraggablePlayerCardProps {
  player: MFLPlayer;
  onAdd: (player: MFLPlayer) => void;
  onRemove?: (player: MFLPlayer) => void;
  isInSquad?: boolean;
  savedSquads?: SavedSquad[];
  currentSquad?: Squad;
}

function DraggablePlayerCard({ player, onAdd, onRemove, isInSquad = false, savedSquads = [], currentSquad }: DraggablePlayerCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: player.id.toString() });

  // State for popup management
  const [hoveredPlayerId, setHoveredPlayerId] = useState<number | null>(null);
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });

  // Check if player is in any saved squad (excluding current squad)
  const getPlayerSquadAppearances = (playerId: number): string[] => {
    const appearances: string[] = [];
    savedSquads.forEach(squad => {
      // Skip if this is the current squad being viewed
      if (currentSquad && squad.squad_name === currentSquad.name) {
        return;
      }
      const playerInSquad = Object.values(squad.players).some(sp => sp.player.id === playerId);
      if (playerInSquad) {
        appearances.push(squad.squad_name);
      }
    });
    return appearances;
  };

  // Check if player is already in the current squad being viewed
  const isPlayerInCurrentSquad = currentSquad ? 
    Object.values(currentSquad.players).some(sp => sp.player.id === player.id) : false;

  const squadAppearances = getPlayerSquadAppearances(player.id);
  const isInAnySquad = squadAppearances.length > 0;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => { if (isInSquad) { onRemove?.(player); } else { onAdd(player); } }}
      className={`flex flex-col gap-2 px-3.5 py-3 rounded-2xl border cursor-pointer transition-colors ${
        isInSquad
          ? 'border-accent-ink/40 bg-accent/6 hover:border-accent-ink/70'
          : 'border-line bg-inset hover:border-line-hover'
      }`}
    >
      <div className="flex items-start gap-2.5">
        <div className="flex-1 min-w-0 flex flex-col gap-[3px]">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[15px] font-bold text-fg truncate">
              {player.metadata.firstName} {player.metadata.lastName}
            </span>
            <span className="flex-none font-mono text-[11px] font-medium text-muted-3">{player.id}</span>
            <RetirementIcon retirementYears={player.metadata.retirementYears} className="w-3.5 h-3.5" />
            <a
              href={`/players/${player.id}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={playerLinkClass}
              aria-label="Open player page"
              title="Open player page"
            >
              ↗
            </a>
            {isInAnySquad && !isPlayerInCurrentSquad && (
              <div
                className={multiSquadBadgeClass}
                onMouseEnter={(e) => {
                  setHoveredPlayerId(player.id);
                  const rect = e.currentTarget.getBoundingClientRect();
                  setPopupPosition({
                    x: rect.left + rect.width / 2,
                    y: rect.top - 10
                  });
                }}
                onMouseLeave={() => setHoveredPlayerId(null)}
              >
                ⚠
                {hoveredPlayerId === player.id && (
                  <MultiSquadPopover squadNames={squadAppearances} position={popupPosition} />
                )}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-x-2 text-xs font-semibold text-muted">
            {player.metadata.positions.slice(0,3).map((position) => (
              <span key={position}>
                {position} <TierText value={calculatePositionRating(player, position as any)} />
              </span>
            ))}
            {player.metadata.positions.length > 3 && (
              <span>+{player.metadata.positions.length - 3}</span>
            )}
          </div>
        </div>
        <div className="flex-none flex flex-col items-center pointer-events-none">
          <span
            className="font-display text-2xl font-extrabold leading-none tabular-nums"
            style={{ color: getTierColors(player.metadata.overall).text }}
          >
            {player.metadata.overall}
          </span>
          <span className="text-[9px] font-bold tracking-[0.1em] text-muted-3">OVR</span>
        </div>
      </div>
      <div className="grid grid-cols-6 pt-2 border-t border-divider text-[13px]">
        {[
          player.metadata.pace,
          player.metadata.shooting,
          player.metadata.passing,
          player.metadata.dribbling,
          player.metadata.defense,
          player.metadata.physical,
        ].map((value, i) => (
          <TierText key={i} value={value} />
        ))}
      </div>
    </div>
  );
}

// Droppable Position Slot Component
interface DroppablePositionSlotProps {
  position: string;
  index: number;
  player: SquadPlayer | null;
  formation: Formation;
  activePlayer?: MFLPlayer | null;
  validatePlayerPosition: (player: MFLPlayer, position: string) => { isValid: boolean; reason: string };
}

function DroppablePositionSlot({ position, index, player, formation, activePlayer, validatePlayerPosition }: DroppablePositionSlotProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isOver,
  } = useSortable({ id: position });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const positionLayout = formation.layout[position];

  // Determine if the active player can be dropped here
  const canDrop = activePlayer ? validatePlayerPosition(activePlayer, position).isValid : true;

  const handleClickAssign = () => {
    if (activePlayer) return;
    const clickEvent = new CustomEvent('sb:assignToPosition', { detail: { position } });
    window.dispatchEvent(clickEvent);
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        left: `${positionLayout?.x || 50}%`,
        top: `${positionLayout?.y || 50}%`,
        transform: 'translate(-50%, -50%)',
      }}
      className={`absolute w-10 h-10 md:w-12 md:h-12 border-2 rounded-full flex items-center justify-center cursor-pointer transition-colors ${
        isOver
          ? canDrop
            ? 'bg-accent/15 border-accent'
            : 'bg-red-500/12 border-red-500'
          : player
          ? 'bg-accent/15 border-accent'
          : 'bg-panel border-line-2 hover:bg-row-hover'
      }`}
      {...attributes}
      {...listeners}
      onClick={handleClickAssign}
    >
      {player ? (
        <div className="text-xs font-medium text-accent-ink text-center">
          <div className="truncate">{player.player.metadata.firstName}</div>
          <div className="text-xs">{player.player.metadata.overall}</div>
        </div>
      ) : (
        <span className="text-xs font-medium text-muted">
          {position}
        </span>
      )}
    </div>
  );
}

export default function SquadBuilderPage() {
  const router = useRouter();
  const { isConnected, account } = useWallet();
  
  // State management
  const [players, setPlayers] = useState<MFLPlayer[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<MFLPlayer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFormation, setSelectedFormation] = useState<Formation>(FORMATIONS[0]);
  const [filterPosition, setFilterPosition] = useState<string>('all');
  // Attribute slider filters (min/max)
  const [attrFilters, setAttrFilters] = useState({
    pace: 0,
    shooting: 0,
    passing: 0,
    dribbling: 0,
    defense: 0,
    physical: 0,
  });
  const [attrFiltersMax, setAttrFiltersMax] = useState({
    pace: 100,
    shooting: 100,
    passing: 100,
    dribbling: 100,
    defense: 100,
    physical: 100,
  });
  const [overallMin, setOverallMin] = useState(0);
  const [overallMax, setOverallMax] = useState(100);
  const [positionRatingMin, setPositionRatingMin] = useState(0);
  const [positionRatingMax, setPositionRatingMax] = useState(100);
  // Card type filters (common, limited, uncommon, epic, legendary, ultimate)
  const [selectedCardTypes, setSelectedCardTypes] = useState<string[]>([]);
  // Sidebar sort state
  const [sidebarSortKey, setSidebarSortKey] = useState<'name'|'overall'|'pace'|'shooting'|'passing'|'dribbling'|'defense'|'physical'>('overall');
  const [sidebarSortDir, setSidebarSortDir] = useState<'asc'|'desc'>('desc');
  // Debounced copies for performance
  const [debouncedAttr, setDebouncedAttr] = useState({
    pace: 0,
    shooting: 0,
    passing: 0,
    dribbling: 0,
    defense: 0,
    physical: 0,
  });
  const [debouncedAttrMax, setDebouncedAttrMax] = useState({
    pace: 100,
    shooting: 100,
    passing: 100,
    dribbling: 100,
    defense: 100,
    physical: 100,
  });
  const [debouncedOverallMin, setDebouncedOverallMin] = useState(overallMin);
  const [debouncedOverallMax, setDebouncedOverallMax] = useState(overallMax);
  const [debouncedPositionRatingMin, setDebouncedPositionRatingMin] = useState(positionRatingMin);
  const [debouncedPositionRatingMax, setDebouncedPositionRatingMax] = useState(positionRatingMax);
  // Sort removed per spec
  const [squad, setSquad] = useState<Squad>({
    name: '',
    formation: FORMATIONS[0],
    players: {}
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasCheckedWallet, setHasCheckedWallet] = useState(false);
  const [activePlayer, setActivePlayer] = useState<MFLPlayer | null>(null);
  const [savedSquads, setSavedSquads] = useState<SavedSquad[]>([]);
  // Simplified save flow: use inline squad.name and save directly
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [pendingSaveName, setPendingSaveName] = useState('');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingSquads, setIsLoadingSquads] = useState(false);
  const { toasts, removeToast, success, error: showError, warning, info } = useToast();
  const [squadStats, setSquadStats] = useState({
    averageOverall: 0,
    totalPlayers: 0,
    top11Average: 0,
    top16Average: 0,
    chemistry: 0,
    formationEffectiveness: 0,
    positionCoverage: 0,
    stats: {
      pace: 0,
      shooting: 0,
      passing: 0,
      dribbling: 0,
      defense: 0,
      physical: 0
    }
  });
  const [showStats, setShowStats] = useState(false);
  const statsRef = useRef<HTMLDivElement | null>(null);
  // Validation UI removed per spec
  const [squadValidation] = useState({ isValid: true, warnings: [] as string[], errors: [] as string[], recommendations: [] as string[] });
  const [squadHistory, setSquadHistory] = useState<Squad[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  // Multi-squad warning popup state
  const [hoveredPlayerId, setHoveredPlayerId] = useState<number | null>(null);
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(false);
  const [playersError, setPlayersError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [showSidebarFilters, setShowSidebarFilters] = useState(false);
  const [sidebarPage, setSidebarPage] = useState(0);
  const pageSize = 20;
  const autoSaveTimer = useRef<number | null>(null);
  const [hideSelectedInSidebar, setHideSelectedInSidebar] = useState(false);

  // Detect if any sidebar filters are active (non-default)
  const isFiltersActive =
    filterPosition !== 'all' ||
    selectedCardTypes.length > 0 ||
    overallMin !== 0 || overallMax !== 100 ||
    positionRatingMin !== 0 || positionRatingMax !== 100 ||
    Object.values(attrFilters).some(v => v !== 0) ||
    Object.values(attrFiltersMax).some(v => v !== 100) ||
    hideSelectedInSidebar;

  // Reset all sidebar filters to defaults
  const resetFilters = () => {
    setFilterPosition('all');
    setSelectedCardTypes([]);
    setOverallMin(0);
    setOverallMax(100);
    setPositionRatingMin(0);
    setPositionRatingMax(100);
    setAttrFilters({ pace: 0, shooting: 0, passing: 0, dribbling: 0, defense: 0, physical: 0 });
    setAttrFiltersMax({ pace: 100, shooting: 100, passing: 100, dribbling: 100, defense: 100, physical: 100 });
    setHideSelectedInSidebar(false);
    setSidebarPage(0);
  };

  // Debounced auto-save when players change (add/remove)
  useEffect(() => {
    if (!account) return;
    // Debounce saves to avoid spamming while user is arranging players
    if (autoSaveTimer.current) {
      window.clearTimeout(autoSaveTimer.current);
    }
    autoSaveTimer.current = window.setTimeout(async () => {
      const hasPlayers = Object.keys(squad.players).length > 0;
      if (!hasPlayers) return;
      const name = (squad.name || '').trim();
      if (!name) return; // only auto-save if already named
      try {
        setIsSaving(true);
        const existing = savedSquads.find(s => s.squad_name.toLowerCase() === name.toLowerCase());
        if (existing) {
          await updateSquad(existing.id, account, name, selectedFormation.id, squad.players);
        } else {
          await saveSquad(account, name, selectedFormation.id, squad.players);
        }
        const squads = await getSquads(account);
        setSavedSquads(squads);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to auto-save squad';
        showError('Auto-Save Failed', errorMessage, 2000);
      } finally {
        setIsSaving(false);
      }
    }, 800);

    return () => {
      if (autoSaveTimer.current) {
        window.clearTimeout(autoSaveTimer.current);
      }
    };
  }, [account, squad.players, selectedFormation.id]);

  const [selectedDeleteId, setSelectedDeleteId] = useState<string | null>(null);

  // Choose best available formation slot for a player (prefer valid within ±6 OVR, otherwise first empty)
  const pickTargetPositionForPlayer = (player: MFLPlayer, formation: Formation, current: Squad): string | null => {
    const emptyPositions = formation.positions.filter((pos) => !current.players[pos]);
    // If no empty formation slots, create an expandable bench/extra slot key
    const getNextExtraKey = () => {
      const existing = Object.keys(current.players).filter(k => k.startsWith('EXTRA'));
      const nums = existing.map(k => parseInt(k.replace('EXTRA',''), 10)).filter(n => !Number.isNaN(n));
      const next = (nums.length ? Math.max(...nums) : 0) + 1;
      return `EXTRA${next}`;
    };
    if (emptyPositions.length === 0) return getNextExtraKey();
    // Find valid positions per validation
    let bestPos: string | null = null;
    let bestDelta = Number.POSITIVE_INFINITY;
    for (const pos of emptyPositions) {
      const check = validatePlayerPosition(player, pos);
      const rating = calculatePositionRating(player, pos);
      const delta = Math.abs(rating - player.metadata.overall);
      if (check.isValid && delta < bestDelta) {
        bestDelta = delta;
        bestPos = pos;
      }
    }
    // Fallback: first empty slot if none considered valid
    return bestPos ?? emptyPositions[0] ?? null;
  };

  // Field view removed; table-only

  // Table sorting (independent of sidebar sort controls)
  const [tableSortKey, setTableSortKey] = useState<'name'|'overall'|'age'|'positions'|'pace'|'shooting'|'passing'|'dribbling'|'defense'|'physical'>('overall');
  const [tableSortDir, setTableSortDir] = useState<'asc'|'desc'>('desc');
  const [tableGroupFilter, setTableGroupFilter] = useState<'all'|'gk'|'defense'|'midfield'|'attack'>('all');
  const [showCoverageModal, setShowCoverageModal] = useState(false);
  const [coverageRatings, setCoverageRatings] = useState<Record<string, Record<string, number>> | null>(null);
  const [isCoverageLoading, setIsCoverageLoading] = useState(false);

  const normalizeSlotBase = (pos: string) => {
    const base = (pos || '').replace(/[0-9]+$/, '');
    if (base === 'CF') return 'ST';
    if (base === 'RWB') return 'RB';
    if (base === 'LWB') return 'LB';
    return base;
  };

  // Get all position groups a player can play in
  const getPlayerAllGroups = (player: MFLPlayer): ('gk'|'defense'|'midfield'|'attack')[] => {
    // Map each position to a group
    const positionToGroup: Record<string, 'gk'|'defense'|'midfield'|'attack'> = {
      GK: 'gk',
      CB: 'defense', LB: 'defense', RB: 'defense', LWB: 'defense', RWB: 'defense',
      CDM: 'midfield', CM: 'midfield', CAM: 'midfield', LM: 'midfield', RM: 'midfield',
      LW: 'attack', RW: 'attack', ST: 'attack', CF: 'attack'
    };
    const positions: string[] = (player.metadata.positions || []).map((p) => (p === 'CF' ? 'ST' : p));
    if (positions.length === 0) return ['midfield'];
    
    // Get all unique groups the player can play in
    const groups = positions.map(pos => positionToGroup[pos]).filter((group, index, arr) => arr.indexOf(group) === index);
    return groups.length > 0 ? groups : ['midfield'];
  };

  // Determine a player's best position group based on highest position rating
  const getPlayerBestGroup = (player: MFLPlayer): 'gk'|'defense'|'midfield'|'attack' => {
    // Map each position to a group
    const positionToGroup: Record<string, 'gk'|'defense'|'midfield'|'attack'> = {
      GK: 'gk',
      CB: 'defense', LB: 'defense', RB: 'defense', LWB: 'defense', RWB: 'defense',
      CDM: 'midfield', CM: 'midfield', CAM: 'midfield', LM: 'midfield', RM: 'midfield',
      LW: 'attack', RW: 'attack', ST: 'attack', CF: 'attack'
    };
    const positions: string[] = (player.metadata.positions || []).map((p) => (p === 'CF' ? 'ST' : p));
    if (positions.length === 0) return 'midfield';
    let bestPos = positions[0];
    let bestRating = -Infinity;
    for (const pos of positions) {
      const rating = calculatePositionRating(player, pos as any);
      if (rating > bestRating) {
        bestRating = rating;
        bestPos = pos;
      }
    }
    return positionToGroup[bestPos] ?? 'midfield';
  };

  // Export current squad players to Excel-compatible CSV
  const handleExportSquadToExcel = () => {
    try {
      const entries = Object.entries(squad.players);
      if (entries.length === 0) {
        warning('No Players', 'Add players to your squad before exporting.');
        return;
      }

      const order = ['GK','CB','LB','RB','LWB','RWB','CDM','CM','CAM','LM','RM','LW','RW','CF','ST'];
      const headers = [
        'Slot', 'Player ID', 'First Name', 'Last Name', 'Full Name', 'Overall', 'Age', 'Positions', 'Preferred Foot', 'Nationalities', 'Height',
        'PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY', 'GK'
      , ...order.map(pos => `Rating ${pos}`)];

      const csvEscape = (val: any) => {
        const s = String(val ?? '');
        if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
        return s;
      };

      const rows: string[] = [];
      rows.push(headers.map(csvEscape).join(','));

      // Stable sort by formation slot for readability
      const sorted = entries.sort(([a],[b]) => a.localeCompare(b));
      sorted.forEach(([slot, sp]) => {
        const p = sp.player;
        const m = p.metadata as any;
        const positionsArray = (m.positions || []) as string[];
        const positionsStr = positionsArray.join(' ');
        const natsStr = (m.nationalities || []).join(' ');

        const baseCols = [
          slot,
          p.id,
          m.firstName,
          m.lastName,
          `${m.firstName} ${m.lastName}`.trim(),
          m.overall ?? '',
          m.age ?? '',
          positionsStr,
          m.preferredFoot ?? '',
          natsStr,
          m.height ?? '',
          m.pace ?? '',
          m.shooting ?? '',
          m.passing ?? '',
          m.dribbling ?? '',
          m.defense ?? '',
          m.physical ?? '',
          m.goalkeeping ?? ''
        ];

        const ratingCols = order.map(pos => {
          try { return calculatePositionRating(p as MFLPlayer, pos as any); } catch { return ''; }
        });

        const line = [...baseCols, ...ratingCols].map(csvEscape).join(',');
        rows.push(line);
      });

      const csvContent = '\uFEFF' + rows.join('\n'); // BOM for Excel UTF-8
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeName = (squad.name && squad.name.trim().length > 0) ? squad.name.trim().replace(/[^a-z0-9_\-]+/gi, '_') : 'squad';
      a.href = url;
      a.download = `${safeName}_export.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      success('Export ready', 'Downloaded Excel-compatible CSV for your squad.', 2000);
    } catch (e) {
      console.error('Export failed:', e);
      showError('Export Failed', 'Could not export squad. Please try again.');
    }
  };
  const handleTableSort = (key: typeof tableSortKey) => {
    if (tableSortKey === key) {
      setTableSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setTableSortKey(key);
      setTableSortDir('desc');
      return;
    }
    // ensure re-render even if key unchanged
    setTableSortKey(key);
  };
  const tablePlayersEntries = Object.entries(squad.players).filter(([slot, sp]) => {
    if (tableGroupFilter === 'all') return true;
    const groups = getPlayerAllGroups(sp.player);
    return groups.includes(tableGroupFilter as 'gk'|'defense'|'midfield'|'attack');
  });
  const tableSortedPlayers = tablePlayersEntries.map(([_, sp]) => sp.player) as MFLPlayer[];
  tableSortedPlayers.sort((a, b) => {
    const dir = tableSortDir === 'asc' ? 1 : -1;
    const keyMap: any = { overall: 'overall', age: 'age', pace: 'pace', shooting: 'shooting', passing: 'passing', dribbling: 'dribbling', defense: 'defense', physical: 'physical' };
    if (tableSortKey === 'name') {
      const an = `${a.metadata.firstName} ${a.metadata.lastName}`;
      const bn = `${b.metadata.firstName} ${b.metadata.lastName}`;
      return an.localeCompare(bn) * dir;
    }
    if (tableSortKey === 'positions') {
      const bestA = (a.metadata.positions || []).map((pos: any) => calculatePositionRating(a, pos)).reduce((m, v) => Math.max(m, v), 0);
      const bestB = (b.metadata.positions || []).map((pos: any) => calculatePositionRating(b, pos)).reduce((m, v) => Math.max(m, v), 0);
      return (bestA - bestB) * dir;
    }
    const va = (a.metadata as any)[keyMap[tableSortKey]] ?? 0;
    const vb = (b.metadata as any)[keyMap[tableSortKey]] ?? 0;
    return (va - vb) * dir;
  });


  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Redirect if not connected (with delay to allow wallet to initialize)
  useEffect(() => {
    const timer = setTimeout(() => {
      setHasCheckedWallet(true);
      if (!isConnected) {
        router.push('/');
      }
    }, 1000); // 1 second delay

    return () => clearTimeout(timer);
  }, [isConnected, router]);

  // Load agency players
  useEffect(() => {
    const loadPlayers = async () => {
      if (!account) return;
      
      setIsLoadingPlayers(true);
      setPlayersError(null);
      setIsInitializing(true);
      
      try {
        setIsLoading(true);
        setError(null);
        
        console.log('🔍 Loading agency players for squad builder...');
        const agencyPlayers = await supabaseDataService.getAgencyPlayers(account);
        
        console.log(`📊 Loaded ${agencyPlayers.length} agency players`);
        setPlayers(agencyPlayers);
        setFilteredPlayers(agencyPlayers);
        
      } catch (err) {
        console.error('❌ Error loading agency players:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to load agency players';
        setError(errorMessage);
        setPlayersError(errorMessage);
        showError('Loading Failed', errorMessage);
      } finally {
        setIsLoading(false);
        setIsLoadingPlayers(false);
        setIsInitializing(false);
      }
    };

    if (account) {
      loadPlayers();
    }
  }, [account]);

  // Debounce attribute/rating sliders
  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedAttr({
        pace: attrFilters?.pace ?? 0,
        shooting: attrFilters?.shooting ?? 0,
        passing: attrFilters?.passing ?? 0,
        dribbling: attrFilters?.dribbling ?? 0,
        defense: attrFilters?.defense ?? 0,
        physical: attrFilters?.physical ?? 0,
      });
      setDebouncedAttrMax({
        pace: attrFiltersMax?.pace ?? 100,
        shooting: attrFiltersMax?.shooting ?? 100,
        passing: attrFiltersMax?.passing ?? 100,
        dribbling: attrFiltersMax?.dribbling ?? 100,
        defense: attrFiltersMax?.defense ?? 100,
        physical: attrFiltersMax?.physical ?? 100,
      });
      setDebouncedOverallMin(overallMin);
      setDebouncedOverallMax(overallMax);
      setDebouncedPositionRatingMin(positionRatingMin);
      setDebouncedPositionRatingMax(positionRatingMax);
    }, 200);
    return () => clearTimeout(handle);
  }, [attrFilters, attrFiltersMax, overallMin, overallMax, positionRatingMin, positionRatingMax]);

  // Function to get player squad appearances
  const getPlayerSquadAppearances = (playerId: number): string[] => {
    const appearances: string[] = [];
    savedSquads.forEach(squad => {
      const playerInSquad = Object.values(squad.players).some(sp => sp.player.id === playerId);
      if (playerInSquad) {
        appearances.push(squad.squad_name);
      }
    });
    return appearances;
  };

  // Load saved squads
  useEffect(() => {
    const loadSavedSquads = async () => {
      if (!account) return;
      // Skip network calls in test environment
      if (process.env.NODE_ENV === 'test') {
        setSavedSquads([]);
        return;
      }
      
      setIsLoadingSquads(true);
      try {
        const squads = await getSquads(account);
        setSavedSquads(squads);
        console.log(`✅ Loaded ${squads.length} saved squads`);
      } catch (error) {
        console.error('❌ Error loading saved squads:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to load saved squads. Please try again.';
        showError('Load Failed', errorMessage);
      } finally {
        setIsLoadingSquads(false);
      }
    };

    if (account) {
      loadSavedSquads();
    }
  }, [account]);

  // Handle sidebar "Add to squad" custom event
  useEffect(() => {
    const onAddToSquad = (ev: Event) => {
      const detail = (ev as CustomEvent).detail as { player?: MFLPlayer } | undefined;
      const player = detail?.player;
      if (!player) return;

      // pick best available position
      const targetPos = pickTargetPositionForPlayer(player, selectedFormation, squad);
      if (!targetPos) return;

      const newSquad: Squad = {
        ...squad,
        players: { ...squad.players, [targetPos]: { player, position: targetPos } },
      };
      addToHistory(newSquad);
      setSquad(newSquad);
    };

    window.addEventListener('sb:addPlayer', onAddToSquad as EventListener);
    return () => {
      window.removeEventListener('sb:addPlayer', onAddToSquad as EventListener);
    };
  }, [squad, selectedFormation]);

  // Save squad functionality
  const handleSaveSquad = async () => {
    if (!account) return;
    const name = (squad.name || '').trim();
    if (!name) {
      setPendingSaveName('');
      setShowSaveModal(true);
      return;
    }
    try {
      setIsSaving(true);
      // If a squad with the same name exists, overwrite it
      const existing = savedSquads.find(s => s.squad_name.toLowerCase() === name.toLowerCase());
      if (existing) {
        await updateSquad(existing.id, account, name, selectedFormation.id, squad.players);
      } else {
        await saveSquad(account, name, selectedFormation.id, squad.players);
      }
      // Refresh saved squads
      const squads = await getSquads(account);
      setSavedSquads(squads);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save squad';
      showError('Save Failed', errorMessage, 2000);
    } finally {
      setIsSaving(false);
    }
  };

  // Confirm save from modal
  const handleConfirmSaveName = async () => {
    const finalName = (pendingSaveName || '').trim();
    if (!finalName) {
      return;
    }
    // set into squad state then call save
    setSquad((prev) => ({ ...prev, name: finalName }));
    setShowSaveModal(false);
    // After state update, proceed to save using the name
    try {
      if (!account) return;
      setIsSaving(true);
      const existing = savedSquads.find(s => s.squad_name.toLowerCase() === finalName.toLowerCase());
      if (existing) {
        await updateSquad(existing.id, account, finalName, selectedFormation.id, squad.players);
      } else {
        await saveSquad(account, finalName, selectedFormation.id, squad.players);
      }
      const squads = await getSquads(account);
      setSavedSquads(squads);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save squad';
      showError('Save Failed', errorMessage, 2000);
    } finally {
      setIsSaving(false);
    }
  };

  // Load squad functionality
  const handleLoadSquad = async (savedSquad: SavedSquad) => {
    if (!account) return;

    try {
      // Find the formation that matches the saved squad
      const formation = FORMATIONS.find(f => f.id === savedSquad.formation_id);
      if (!formation) {
        console.error('Formation not found:', savedSquad.formation_id);
        return;
      }

      // Set the formation and players
      setSelectedFormation(formation);
      setSquad({
        name: savedSquad.squad_name,
        formation: formation,
        players: savedSquad.players as { [position: string]: SquadPlayer }
      });

      setShowLoadModal(false);
      console.log(`✅ Loaded squad: ${savedSquad.squad_name}`);
    } catch (error) {
      console.error('Error loading squad:', error);
      showError('Load Failed', 'Failed to load the squad. Please try again.', 2000);
    }
  };

  // Delete squad functionality
  const handleDeleteSquad = async (squadId: string, squadName: string) => {
    if (!account) return;

    if (!confirm(`Are you sure you want to delete "${squadName}"? This action cannot be undone.`)) {
      return;
    }

    setIsDeleting(squadId);

    try {
      await deleteSquad(squadId, account);
      
      // Refresh the saved squads list
      const squads = await getSquads(account);
      setSavedSquads(squads);
      success('Squad Deleted', `"${squadName}" has been deleted successfully.`, 2000);
      console.log(`✅ Deleted squad: ${squadName}`);

      // If the deleted squad is currently loaded, clear the builder
      if ((squad.name || '') === squadName) {
        setSquad({
          name: '',
          formation: selectedFormation,
          players: {}
        });
        setSquadHistory([]);
        setHistoryIndex(-1);
      }
    } catch (error) {
      console.error('Error deleting squad:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete the squad. Please try again.';
      showError('Delete Failed', errorMessage, 2000);
    } finally {
      setIsDeleting(null);
    }
  };

  // Undo/Redo functionality
  const addToHistory = (newSquad: Squad) => {
    const newHistory = squadHistory.slice(0, historyIndex + 1);
    newHistory.push(newSquad);
    setSquadHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setSquad(squadHistory[newIndex]);
      info('Undo', 'Previous squad state restored', 2000);
    }
  };

  const redo = () => {
    if (historyIndex < squadHistory.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setSquad(squadHistory[newIndex]);
      info('Redo', 'Next squad state restored', 2000);
    }
  };

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < squadHistory.length - 1;

  // Calculate squad stats and validation when squad changes
  useEffect(() => {
    const stats = calculateSquadStats(squad, players);
    setSquadStats(stats);
    
    // Skip validation updates (disabled per spec)
  }, [squad, players, selectedFormation]);

  // Filter and sort players
  useEffect(() => {
    // Sidebar list should be highest overall first (and allow custom sorting)
    let filtered = [...players];

    // Search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(player => {
        const fullName = `${player.metadata.firstName} ${player.metadata.lastName}`.toLowerCase();
        const positions = player.metadata.positions.join(' ').toLowerCase();
        
        return fullName.includes(search) || positions.includes(search);
      });
    }

    // Position filter (supports group selections)
    if (filterPosition !== 'all') {
      const resolvePositions = (val: string): string[] => {
        switch (val) {
          case '__GROUP_DEFENDERS':
            return ['CB','LB','RB','LWB','RWB'];
          case '__GROUP_MIDFIELDERS':
            return ['CM','CDM','LM','RM'];
          case '__GROUP_FORWARDS':
            return ['ST','CF','RW','LW','CAM'];
          default:
            return [val];
        }
      };
      const wanted = resolvePositions(filterPosition);
      filtered = filtered.filter(player => player.metadata.positions.some(p => wanted.includes(p as any)));
    }

    // Attribute slider min/max filters (debounced)
    filtered = filtered.filter(player => (
      player.metadata.pace >= debouncedAttr.pace && player.metadata.pace <= debouncedAttrMax.pace &&
      player.metadata.shooting >= debouncedAttr.shooting && player.metadata.shooting <= debouncedAttrMax.shooting &&
      player.metadata.passing >= debouncedAttr.passing && player.metadata.passing <= debouncedAttrMax.passing &&
      player.metadata.dribbling >= debouncedAttr.dribbling && player.metadata.dribbling <= debouncedAttrMax.dribbling &&
      player.metadata.defense >= debouncedAttr.defense && player.metadata.defense <= debouncedAttrMax.defense &&
      player.metadata.physical >= debouncedAttr.physical && player.metadata.physical <= debouncedAttrMax.physical
    ));

    // Overall rating min/max (debounced)
    filtered = filtered.filter(player => player.metadata.overall >= debouncedOverallMin && player.metadata.overall <= debouncedOverallMax);

    // Position rating min/max (debounced)
    filtered = filtered.filter(player => {
      const best = player.metadata.positions
        .map(pos => calculatePositionRating(player, pos as any))
        .reduce((a, b) => Math.max(a, b), 0);
      return best >= debouncedPositionRatingMin && best <= debouncedPositionRatingMax;
    });

    // Card type filter (derived from overall)
    const getCardTypeFromOverall = (overall: number): 'ultimate' | 'legendary' | 'epic' | 'uncommon' | 'limited' | 'common' => {
      if (overall >= 95) return 'ultimate';
      if (overall >= 85) return 'legendary';
      if (overall >= 75) return 'epic';
      if (overall >= 65) return 'uncommon';
      if (overall >= 55) return 'limited';
      return 'common';
    };

    if (selectedCardTypes.length > 0) {
      filtered = filtered.filter(p => selectedCardTypes.includes(getCardTypeFromOverall(p.metadata.overall)));
    }

    // Hide players already selected in any squad (current squad and other saved squads)
    if (hideSelectedInSidebar) {
      const selectedIds = new Set<number>();
      
      // Add players from current squad
      Object.values(squad.players).forEach(sp => {
        selectedIds.add(sp.player.id);
      });
      
      // Add players from other saved squads
      savedSquads.forEach(savedSquad => {
        Object.values(savedSquad.players).forEach(squadPlayer => {
          selectedIds.add(squadPlayer.player.id);
        });
      });
      
      filtered = filtered.filter(p => !selectedIds.has(p.id));
    }

    const dir = sidebarSortDir === 'asc' ? 1 : -1;
    if (sidebarSortKey === 'name') {
      filtered.sort((a, b) => (`${a.metadata.firstName} ${a.metadata.lastName}`).localeCompare(`${b.metadata.firstName} ${b.metadata.lastName}`) * dir);
    } else {
      const map: any = { overall: 'overall', pace: 'pace', shooting: 'shooting', passing: 'passing', dribbling: 'dribbling', defense: 'defense', physical: 'physical' };
      filtered.sort((a, b) => (((a.metadata as any)[map[sidebarSortKey]] ?? 0) - ((b.metadata as any)[map[sidebarSortKey]] ?? 0)) * dir);
    }
    setFilteredPlayers(filtered);
  }, [searchTerm, filterPosition, players, debouncedAttr, debouncedAttrMax, debouncedOverallMin, debouncedOverallMax, debouncedPositionRatingMin, debouncedPositionRatingMax, selectedCardTypes, sidebarSortKey, sidebarSortDir, hideSelectedInSidebar, squad.players, savedSquads]);

  // Back to the first page when the search, filters or sort change. Not when the squad
  // changes: picking a player on page 2 must leave the list on page 2
  useEffect(() => {
    setSidebarPage(0);
  }, [searchTerm, filterPosition, players, debouncedAttr, debouncedAttrMax, debouncedOverallMin, debouncedOverallMax, debouncedPositionRatingMin, debouncedPositionRatingMax, selectedCardTypes, sidebarSortKey, sidebarSortDir, hideSelectedInSidebar]);

  // Hiding selected players shrinks the list, so keep the page within range
  useEffect(() => {
    const lastPage = Math.max(0, Math.ceil(filteredPlayers.length / pageSize) - 1);
    setSidebarPage(page => Math.min(page, lastPage));
  }, [filteredPlayers]);

  // Handle formation change
  const handleFormationChange = (formation: Formation) => {
    setSelectedFormation(formation);
    setSquad(prev => ({
      ...prev,
      formation,
      players: {} // Clear players when formation changes
    }));
  };

  // Drag and drop handlers
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const player = players.find(p => p.id.toString() === active.id);
    if (player) {
      setActivePlayer(player);
    }
  };

  const handleAddToSquad = (player: MFLPlayer) => {
    const targetPos = pickTargetPositionForPlayer(player, selectedFormation, squad);
    if (!targetPos) return;
    const newSquad = {
      ...squad,
      players: { ...squad.players, [targetPos]: { player, position: targetPos } }
    };
    addToHistory(newSquad);
    setSquad(newSquad);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActivePlayer(null);

    if (!over) return;

    const player = players.find(p => p.id.toString() === active.id);
    const position = over.id as string;

    if (player && position) {
      // Validate if player can play in this position
      const canPlayPosition = validatePlayerPosition(player, position);
      
        if (canPlayPosition.isValid) {
          console.log(`✅ Player ${player.metadata.firstName} ${player.metadata.lastName} dropped on ${position} - Valid`);
          
          const newSquad = {
            ...squad,
            players: {
              ...squad.players,
              [position]: { player, position }
            }
          };
          
          // Add to history for undo/redo
          addToHistory(newSquad);
          setSquad(newSquad);
          
          success('Player Added!', `${player.metadata.firstName} ${player.metadata.lastName} added to ${position}`);
        } else {
          console.log(`❌ Player ${player.metadata.firstName} ${player.metadata.lastName} dropped on ${position} - Invalid: ${canPlayPosition.reason}`);
          warning('Invalid Position', `${player.metadata.firstName} ${player.metadata.lastName} cannot play ${position}: ${canPlayPosition.reason}`);
        }
    }
  };


  // Loading state
  if (!hasCheckedWallet || isLoading) {
    return (
      <Panel className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <div className={`w-8 h-8 ${spinnerClass}`}></div>
        <p className="m-0 text-sm font-medium text-muted">
          {!hasCheckedWallet ? 'Checking wallet connection...' : 'Loading squad builder...'}
        </p>
      </Panel>
    );
  }

  // Error state
  if (error) {
    return (
      <Panel className="flex flex-col items-center gap-5 max-w-md mx-auto px-6 py-12 text-center">
        <svg className="w-14 h-14 text-danger-ink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <div className="flex flex-col gap-2">
          <h2 className="m-0 font-display text-2xl font-bold text-fg">Error</h2>
          <p className="m-0 text-sm text-muted">{error}</p>
        </div>
        <div className="flex flex-col gap-2.5 w-full">
          <button
            onClick={() => window.location.reload()}
            className={`${btnPrimary} w-full`}
          >
            Try Again
          </button>
          <button
            onClick={() => router.push('/')}
            className={`${btnPill} w-full`}
          >
            Back to Home
          </button>
        </div>
      </Panel>
    );
  }

  const squadSize = Object.keys(squad.players).length;
  const squadColumns: [typeof tableSortKey, string, boolean][] = [
    ['name', 'Player', false],
    ['overall', 'OVR', true],
    ['age', 'Age', true],
    ['positions', 'Positions', false],
    ['pace', 'PAC', true],
    ['shooting', 'SHO', true],
    ['passing', 'PAS', true],
    ['dribbling', 'DRI', true],
    ['defense', 'DEF', true],
    ['physical', 'PHY', true],
  ];

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Squad Builder"
          actions={
            <>
              {tableSortedPlayers.length > 0 && (
                <button
                  className={btnPill}
                  onClick={() => setShowStats(prev => !prev)}
                >
                  {showStats ? 'Hide Squad Statistics' : 'Show Squad Statistics'}
                </button>
              )}

              <button
                className={btnPill}
                onClick={() => setShowLoadModal(true)}
                title="Load Squad"
              >
                Load Squad
              </button>

              {/* Save Squad (only when there are players) */}
              {squadSize > 0 && (
                <button
                  className={btnPrimary}
                  onClick={handleSaveSquad}
                  disabled={isSaving}
                >
                  {isSaving && (
                    <span className="inline-block w-3 h-3 rounded-full border-2 border-accent-fg border-t-transparent animate-spin" aria-hidden="true"></span>
                  )}
                  {isSaving ? 'Saving…' : 'Save Squad'}
                </button>
              )}

              {squadSize > 0 && (
                <button
                  className={btnPill}
                  onClick={() => {
                    // Start a brand new squad
                    const defaultFormation = FORMATIONS[0];
                    setSelectedFormation(defaultFormation);
                    setSquad({
                      name: '',
                      formation: defaultFormation,
                      players: {}
                    });
                    setSquadHistory([]);
                    setHistoryIndex(-1);
                  }}
                >
                  Clear Squad
                </button>
              )}

              {/* Delete Squad (current loaded) */}
              {(() => {
                const current = savedSquads.find(s => s.squad_name === squad.name && s.formation_id === selectedFormation.id);
                return current ? (
                  <button
                    className={btnDanger}
                    onClick={() => handleDeleteSquad(current.id, current.squad_name)}
                  >
                    Delete Squad
                  </button>
                ) : null;
              })()}
            </>
          }
        />

        {isInitializing && (
          <Panel className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <div className={`w-12 h-12 ${spinnerClass}`}></div>
            <h3 className="m-0 font-display text-lg font-bold text-fg">Initializing Squad Builder</h3>
            <p className="m-0 text-sm text-muted">Loading your players and squads...</p>
          </Panel>
        )}

        <div className={`${isInitializing ? 'hidden' : 'grid'} grid-cols-1 lg:grid-cols-[minmax(340px,420px)_minmax(0,1fr)] gap-[18px] items-start`}>
          {/* Player Sidebar */}
          <Panel className="min-w-0 flex flex-col gap-2.5 p-3.5">
            {isLoadingPlayers && (
              <div className="flex items-center justify-center gap-2 py-8 text-sm font-medium text-muted">
                <div className={`w-6 h-6 ${spinnerClass}`}></div>
                <span>Loading players...</span>
              </div>
            )}

            {playersError && (
              <div className="flex items-start gap-2.5 p-4 rounded-2xl border border-red-500/45 bg-red-500/12">
                <svg className="flex-none w-5 h-5 text-danger-ink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex flex-col gap-1 min-w-0">
                  <h3 className="m-0 text-sm font-bold text-danger-ink">Failed to load players</h3>
                  <p className="m-0 text-sm text-fg-3">{playersError}</p>
                  <button
                    onClick={() => {
                      if (account) {
                        const loadPlayers = async () => {
                          setIsLoadingPlayers(true);
                          setPlayersError(null);
                          try {
                            const agencyPlayers = await supabaseDataService.getAgencyPlayers(account);
                            setPlayers(agencyPlayers);
                            setFilteredPlayers(agencyPlayers);
                            // Silent on initial visit: no popup
                          } catch (err) {
                            const errorMessage = err instanceof Error ? err.message : 'Failed to load agency players';
                            setPlayersError(errorMessage);
                            showError('Loading Failed', errorMessage);
                          } finally {
                            setIsLoadingPlayers(false);
                          }
                        };
                        loadPlayers();
                      }
                    }}
                    className="self-start mt-1 text-sm font-semibold text-danger-ink underline cursor-pointer"
                  >
                    Try again
                  </button>
                </div>
              </div>
            )}

            {/* Search and Filters */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Search players..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`${fieldClass} flex-1 min-w-0`}
              />
              <button
                className={btnSecondary}
                onClick={() => setShowSidebarFilters(v => !v)}
              >
                {showSidebarFilters ? 'Hide Filters' : 'Show Filters'}
              </button>
            </div>

            {/* Filters */}
            <div className={`${showSidebarFilters ? 'grid' : 'hidden'} grid-cols-2 gap-x-4 gap-y-3.5 p-3.5 rounded-2xl border border-line bg-inset`}>
              {/* Card Type Filter */}
              <div className="col-span-2">
                <label className={sliderLabelClass}>Card type</label>
                <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap p-1">
                  {[
                    { key: 'common', label: 'Common', minRating: 0 },
                    { key: 'limited', label: 'Limited', minRating: 55 },
                    { key: 'uncommon', label: 'Uncommon', minRating: 65 },
                    { key: 'epic', label: 'Epic', minRating: 75 },
                    { key: 'legendary', label: 'Legendary', minRating: 85 },
                    { key: 'ultimate', label: 'Ultimate', minRating: 95 },
                  ].map(opt => {
                    const isSelected = selectedCardTypes.includes(opt.key);
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => {
                          setSelectedCardTypes(prev => {
                            return isSelected ? prev.filter(k => k !== opt.key) : [...prev, opt.key];
                          });
                        }}
                        className={`flex-none w-[30px] h-[35px] rounded-lg border border-[rgba(var(--glass-rgb),.14)] cursor-pointer select-none flex items-center justify-center p-0 transition-shadow ${isSelected ? 'ring-2 ring-accent-ink ring-offset-2 ring-offset-inset' : ''}`}
                        style={{ background: getTierColors(opt.minRating).bg }}
                        title={opt.label}
                        aria-pressed={isSelected}
                      >
                        <span className="sr-only">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Position Filter (moved inside collapsible) */}
              <div className="col-span-2">
                <label className={labelClass}>
                  Position
                  <Select
                    value={filterPosition}
                    onChange={(e) => setFilterPosition(e.target.value)}
                    className="w-full"
                  >
                    <option value="all">All Positions</option>
                    <option disabled>────────────</option>
                    <option value="GK">GK - Goalkeeper</option>
                    <option value="CB">CB - Center Back</option>
                    <option value="LB">LB - Left Back</option>
                    <option value="RB">RB - Right Back</option>
                    <option value="LWB">LWB - Left Wing Back</option>
                    <option value="RWB">RWB - Right Wing Back</option>
                    <option value="CDM">CDM - Defensive Midfielder</option>
                    <option value="CM">CM - Central Midfielder</option>
                    <option value="CAM">CAM - Attacking Midfielder</option>
                    <option value="LM">LM - Left Midfielder</option>
                    <option value="RM">RM - Right Midfielder</option>
                    <option value="LW">LW - Left Winger</option>
                    <option value="RW">RW - Right Winger</option>
                    <option value="ST">ST - Striker</option>
                    <option value="CF">CF - Center Forward</option>
                    <option disabled>────────────</option>
                    <option value="__GROUP_DEFENDERS">Defenders (CB, LB, RB, LWB, RWB)</option>
                    <option value="__GROUP_MIDFIELDERS">Midfielders (CM, CDM, LM, RM)</option>
                    <option value="__GROUP_FORWARDS">Forwards (ST, CF, RW, LW, CAM)</option>
                  </Select>
                </label>
              </div>
              <div>
                <label className={sliderLabelClass}>
                  Overall {overallMin} - {overallMax}
                </label>
                <Slider.Root
                  className={sliderRootClass}
                  min={0}
                  max={100}
                  step={1}
                  value={[overallMin, overallMax]}
                  onValueChange={([min, max]) => { setOverallMin(min); setOverallMax(max); }}
                >
                  <Slider.Track className={sliderTrackClass} />
                  <Slider.Range className={sliderRangeClass} />
                  <Slider.Thumb className={sliderThumbClass} aria-label="Overall min" />
                  <Slider.Thumb className={sliderThumbClass} aria-label="Overall max" />
                </Slider.Root>
              </div>
              <div>
                <label className={sliderLabelClass}>
                  Position rating {positionRatingMin} - {positionRatingMax}
                </label>
                <Slider.Root
                  className={sliderRootClass}
                  min={0}
                  max={100}
                  step={1}
                  value={[positionRatingMin, positionRatingMax]}
                  onValueChange={([min, max]) => { setPositionRatingMin(min); setPositionRatingMax(max); }}
                >
                  <Slider.Track className={sliderTrackClass} />
                  <Slider.Range className={sliderRangeClass} />
                  <Slider.Thumb className={sliderThumbClass} aria-label="Position min" />
                  <Slider.Thumb className={sliderThumbClass} aria-label="Position max" />
                </Slider.Root>
              </div>
              {([
                ['pace','PAC'],['shooting','SHO'],['passing','PAS'],['dribbling','DRI'],['defense','DEF'],['physical','PHY']
              ] as Array<[keyof typeof debouncedAttr,string]>).map(([key,label]) => (
                <div key={key} className="col-span-1">
                  <label className={sliderLabelClass}>
                    {label} {attrFilters[key]} - {attrFiltersMax[key]}
                  </label>
                  <Slider.Root
                    className={sliderRootClass}
                    min={0}
                    max={100}
                    step={1}
                    value={[attrFilters[key], attrFiltersMax[key]]}
                    onValueChange={([min, max]) => {
                      setAttrFilters(prev => ({ ...prev, [key]: min }));
                      setAttrFiltersMax(prev => ({ ...prev, [key]: max }));
                    }}
                  >
                    <Slider.Track className={sliderTrackClass} />
                    <Slider.Range className={sliderRangeClass} />
                    <Slider.Thumb className={sliderThumbClass} aria-label={`${label} min`} />
                    <Slider.Thumb className={sliderThumbClass} aria-label={`${label} max`} />
                  </Slider.Root>
                </div>
              ))}
              {/* Hide selected players toggle (inside filters area) */}
              <div className="col-span-2 flex items-center gap-2">
                <input
                  id="hide-selected"
                  type="checkbox"
                  checked={hideSelectedInSidebar}
                  onChange={(e) => setHideSelectedInSidebar(e.target.checked)}
                  className="w-4 h-4 cursor-pointer accent-accent"
                />
                <label htmlFor="hide-selected" className="text-sm font-medium text-fg-3 select-none cursor-pointer">
                  Hide selected players
                </label>
                {isFiltersActive && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="ml-auto text-sm font-semibold text-accent-ink hover:text-accent-hover cursor-pointer"
                    title="Reset filters"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            </div>

            {/* Pagination header (info) */}
            {filteredPlayers.length > pageSize && (
              <span className="self-end text-xs font-medium text-muted">
                Showing {Math.min((sidebarPage + 1) * pageSize, filteredPlayers.length)} of {filteredPlayers.length} players
              </span>
            )}

            {/* Player List */}
            <div className="flex flex-col gap-2.5">
              <SortableContext items={filteredPlayers.slice(sidebarPage*pageSize, sidebarPage*pageSize+pageSize).map(p => p.id.toString())} strategy={verticalListSortingStrategy}>
                {filteredPlayers.slice(sidebarPage*pageSize, sidebarPage*pageSize+pageSize).map((player) => {
                  const isInSquad = Object.values(squad.players).some(sp => sp.player.id === player.id);
                  return (
                    <DraggablePlayerCard key={player.id} player={player} isInSquad={isInSquad} savedSquads={savedSquads} currentSquad={squad} onAdd={(p) => {
                      const targetPos = pickTargetPositionForPlayer(p, selectedFormation, squad);
                      if (!targetPos) return;
                      const newSquad: Squad = { ...squad, players: { ...squad.players, [targetPos]: { player: p, position: targetPos } } };
                      addToHistory(newSquad);
                      setSquad(newSquad);
                    }} onRemove={(p) => {
                      const newSquad: Squad = { ...squad };
                      const entries = Object.entries(newSquad.players).filter(([_, v]) => v.player.id !== p.id);
                      newSquad.players = Object.fromEntries(entries);
                      addToHistory(newSquad);
                      setSquad(newSquad);
                    }} />
                )})}
              </SortableContext>
            </div>
            {/* Pagination footer with numbers: 1 line up to 5 pages, 2 lines when >5 */}
            {filteredPlayers.length > pageSize && (
              <div className="flex flex-col gap-1.5 pt-1">
                {(() => {
                  const pageCount = Math.ceil(filteredPlayers.length / pageSize);
                  const half = Math.ceil(pageCount / 2);
                  const renderRange = (start: number, end: number) => (
                    <div className="flex flex-wrap justify-center gap-1.5">
                      {Array.from({ length: end - start }).map((_, idx) => {
                        const i = start + idx;
                        return (
                          <button
                            key={i}
                            className={`min-w-8 h-8 px-2 rounded-lg border text-xs font-bold cursor-pointer transition-colors ${i===sidebarPage ? 'bg-accent text-accent-fg border-accent' : 'bg-btn text-fg-3 border-line-2 hover:border-line-hover'}`}
                            onClick={() => setSidebarPage(i)}
                          >
                            {i + 1}
                          </button>
                        );
                      })}
                    </div>
                  );
                  return (
                    <>
                      {pageCount <= 5 ? (
                        renderRange(0, pageCount)
                      ) : (
                        <>
                          {renderRange(0, half)}
                          {renderRange(half, pageCount)}
                        </>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </Panel>

          {/* Main Squad Builder Area */}
          <div className="min-w-0 flex flex-col gap-[18px]">
            {/* Squad Statistics (collapsible) */}
            {showStats && (
              <div ref={statsRef} className="flex flex-col gap-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <KpiTile label="Avg Overall" value={squadStats.averageOverall.toFixed(2)} accent />
                  <KpiTile label="AVG (TOP11)" value={squadStats.top11Average.toFixed(2)} />
                  <KpiTile label="AVG (TOP16)" value={squadStats.top16Average.toFixed(2)} />
                  <KpiTile label="Players" value={squadStats.totalPlayers} />
                </div>

                <Panel className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 p-3.5">
                  {([
                    ['AVG PAC', squadStats.stats.pace],
                    ['AVG SHO', squadStats.stats.shooting],
                    ['AVG PAS', squadStats.stats.passing],
                    ['AVG DRI', squadStats.stats.dribbling],
                    ['AVG DEF', squadStats.stats.defense],
                    ['AVG PHY', squadStats.stats.physical],
                  ] as [string, number][]).map(([label, value]) => (
                    <div key={label} className="flex flex-col items-center gap-2 px-2 py-3 rounded-2xl border border-line bg-inset">
                      <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-2 whitespace-nowrap">{label}</span>
                      <TierBadge value={value} />
                      <div className="w-full h-1 rounded-full bg-line-2 overflow-hidden">
                        <div
                          className="h-1 rounded-full transition-all duration-300"
                          style={{ width: `${value}%`, background: getTierColors(value).bg }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </Panel>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Panel className="flex flex-col gap-3 p-[18px]">
                    <div className="flex items-center justify-between gap-2 min-h-8">
                      <h4 className="m-0 font-display text-lg font-bold text-fg">Squad Balance</h4>
                      {tableGroupFilter !== 'all' && (
                        <button
                          type="button"
                          className={smallPillClass}
                          onClick={() => setTableGroupFilter('all')}
                          title="Reset group filter"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      {(() => {
                        const counts = { attack: 0, midfield: 0, defense: 0, gk: 0 };
                        Object.entries(squad.players).forEach(([slot, sp]) => {
                          // Use getPlayerAllGroups to count players in all groups they can play
                          const playerGroups = getPlayerAllGroups(sp.player);
                          playerGroups.forEach(group => {
                            if (group === 'gk') counts.gk++;
                            else if (group === 'attack') counts.attack++;
                            else if (group === 'midfield') counts.midfield++;
                            else if (group === 'defense') counts.defense++;
                          });
                        });
                        return ([
                          ['gk', 'Goalkeepers'],
                          ['defense', 'Defense'],
                          ['midfield', 'Midfield'],
                          ['attack', 'Attack'],
                        ] as const).map(([group, label]) => (
                          <button
                            key={group}
                            type="button"
                            className={`w-full flex justify-between items-center px-3 py-2 rounded-xl text-left text-sm cursor-pointer transition-colors ${tableGroupFilter===group ? 'bg-accent/12 text-accent-ink' : 'text-muted hover:bg-row-hover'}`}
                            onClick={() => setTableGroupFilter(group)}
                          >
                            <span className="font-medium">{label}</span>
                            <span className={`font-display font-bold ${tableGroupFilter===group ? '' : 'text-fg'}`}>{counts[group]}</span>
                          </button>
                        ));
                      })()}
                    </div>
                  </Panel>

                  <Panel className="flex flex-col gap-3 p-[18px]">
                    <div className="flex items-center min-h-8">
                      <h4 className="m-0 font-display text-lg font-bold text-fg">Age Analysis</h4>
                    </div>
                    <div className="flex flex-col gap-2">
                      {(() => {
                        const squadPlayers = Object.values(squad.players);
                        if (squadPlayers.length === 0) return (
                          <div className="text-sm text-muted">No players</div>
                        );
                        const ages = squadPlayers.map(sp => sp.player.metadata.age);
                        const avgAge = Math.round(ages.reduce((sum, age) => sum + age, 0) / ages.length);
                        const minAge = Math.min(...ages);
                        const maxAge = Math.max(...ages);
                        return (
                          <>
                            <div className="flex justify-between items-center text-sm">
                              <span className="font-medium text-muted">Average</span>
                              <span className="font-display font-bold text-fg">{avgAge}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                              <span className="font-medium text-muted">Range</span>
                              <span className="font-display font-bold text-fg">{minAge}-{maxAge}</span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </Panel>

                  <Panel className="flex flex-col gap-3 p-[18px]">
                    <div className="flex items-center min-h-8">
                      <h4 className="m-0 font-display text-lg font-bold text-fg">Position Coverage</h4>
                    </div>
                    <div className="flex flex-col gap-2">
                      {(() => {
                        // Required positions for coverage metrics
                        const requiredPositions = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST'];

                        // Build playable map per position using threshold (within 5 of overall)
                        const playable: Record<string, Set<string>> = {};
                        requiredPositions.forEach(pos => { playable[pos] = new Set(); });

                        Object.values(squad.players).forEach(sp => {
                          const p = sp.player;
                          const overall = p.metadata.overall || 0;
                          const threshold = Math.max(0, overall - 5);
                          requiredPositions.forEach(pos => {
                            const rating = calculatePositionRating(p, pos as any);
                            if (rating >= threshold) {
                              playable[pos].add(String(p.id));
                            }
                          });
                        });

                        const total = requiredPositions.length;
                        const coveredCount = requiredPositions.filter(pos => (playable[pos]?.size || 0) >= 1).length;

                        // Backup coverage: need 2 players per position without reusing the same player in another position
                        const usedGlobally = new Set<string>();
                        let backupCount = 0;
                        for (const pos of requiredPositions) {
                          const options = Array.from(playable[pos] || []);
                          let picked = 0;
                          for (const pid of options) {
                            if (!usedGlobally.has(pid)) {
                              usedGlobally.add(pid);
                              picked++;
                              if (picked === 2) break;
                            }
                          }
                          if (picked === 2) backupCount++;
                        }

                        const coveragePercent = Math.max(0, Math.min(100, Math.round((coveredCount / total) * 100)));
                        const backupPercent = Math.max(0, Math.min(100, Math.round((backupCount / total) * 100)));

                        return (
                          <>
                            <div className="flex justify-between items-center text-sm">
                              <span className="font-medium text-muted">Main Coverage</span>
                              <span className="font-display font-bold text-fg">{coveragePercent}%</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-line-2 overflow-hidden">
                              <div
                                className="h-2 rounded-full bg-accent transition-all duration-300"
                                style={{ width: `${coveragePercent}%` }}
                              ></div>
                            </div>

                            <div className="flex justify-between items-center mt-2 text-sm">
                              <span className="font-medium text-muted">Backup Coverage</span>
                              <span className="font-display font-bold text-fg">{backupPercent}%</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-line-2 overflow-hidden">
                              <div
                                className="h-2 rounded-full bg-[#6eb4ff] transition-all duration-300"
                                style={{ width: `${backupPercent}%` }}
                              ></div>
                            </div>
                            <div className="mt-2 flex justify-end">
                              <button
                                type="button"
                                className={smallPillClass}
                                onClick={async () => {
                                  setIsCoverageLoading(true);
                                  try {
                                    const playersList = Object.values(squad.players).map(sp => sp.player);
                                    const ratingsMap: Record<string, Record<string, number>> = {};
                                    for (const p of playersList) {
                                      const playerForOVR = {
                                        id: p.id,
                                        name: `${p.metadata.firstName} ${p.metadata.lastName}`,
                                        attributes: {
                                          PAC: p.metadata.pace,
                                          SHO: p.metadata.shooting,
                                          PAS: p.metadata.passing,
                                          DRI: p.metadata.dribbling,
                                          DEF: p.metadata.defense,
                                          PHY: p.metadata.physical,
                                          GK: p.metadata.goalkeeping || 0
                                        },
                                        positions: (p.metadata.positions || []) as MFLPosition[],
                                        overall: p.metadata.overall
                                      };
                                      const res = rbCalculateAllPositionOVRs(playerForOVR);
                                      const map: Record<string, number> = {};
                                      if (res.success && res.results) {
                                        for (const key of Object.keys(res.results)) {
                                          const r = (res.results as any)[key];
                                          map[key] = r?.ovr ?? 0;
                                        }
                                      }
                                      ratingsMap[p.id.toString()] = map;
                                    }
                                    setCoverageRatings(ratingsMap);
                                  } finally {
                                    setIsCoverageLoading(false);
                                    setShowCoverageModal(true);
                                  }
                                }}
                                title="Show all positions coverage"
                              >
                                Show all positions coverage
                              </button>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </Panel>
                </div>
              </div>
            )}

            {/* Squad table: only players currently in the squad */}
            <Panel className="min-w-0 overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-5 py-[18px]">
                <h2 className="m-0 font-display text-2xl font-extrabold tracking-[-0.01em] text-fg truncate">
                  {squad.name && squad.name.trim().length > 0 ? squad.name : 'SQUAD'}
                </h2>
                <span className="flex-none text-[13px] font-semibold text-muted">
                  {tableGroupFilter !== 'all' ? `${tableSortedPlayers.length} of ${squadSize}` : squadSize} {squadSize === 1 ? 'player' : 'players'}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className={tableClass}>
                  <thead>
                    <tr className={theadRowClass}>
                      {squadColumns.map(([key, label, centered]) => (
                        <th
                          key={key}
                          onClick={() => handleTableSort(key)}
                          className={`${sortableThClass} ${centered ? '!text-center' : ''} ${key === 'name' ? '!pl-5' : ''} ${tableSortKey === key ? '!text-accent-ink' : ''}`}
                        >
                          {label}
                          <SortArrow active={tableSortKey === key} direction={tableSortDir} />
                        </th>
                      ))}
                      <th className={`${thClass} !pr-5`}>&nbsp;</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableSortedPlayers.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="px-5 py-12 text-center text-sm font-medium text-muted">
                          To add players to your squad click or drag them from the left sidebar
                        </td>
                      </tr>
                    ) : null}
                    {tableSortedPlayers.map((p) => {
                      const squadAppearances = getPlayerSquadAppearances(p.id);
                      const isInMultipleSquads = squadAppearances.length > 1;

                      return (
                        <tr key={p.id} className={rowClass}>
                          <td className={`${tdClass} !pl-5`}>
                            <div className="flex flex-col gap-px">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-bold text-fg">{p.metadata.firstName} {p.metadata.lastName}</span>
                                <RetirementIcon retirementYears={p.metadata.retirementYears} className="w-3.5 h-3.5" />
                                <a
                                  href={`/players/${p.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={playerLinkClass}
                                  title="View player details"
                                >
                                  ↗
                                </a>
                                {isInMultipleSquads && (
                                  <div
                                    className={multiSquadBadgeClass}
                                    onMouseEnter={(e) => {
                                      setHoveredPlayerId(p.id);
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      setPopupPosition({
                                        x: rect.left + rect.width / 2,
                                        y: rect.top - 10
                                      });
                                    }}
                                    onMouseLeave={() => setHoveredPlayerId(null)}
                                  >
                                    ⚠
                                    {hoveredPlayerId === p.id && (
                                      <MultiSquadPopover squadNames={squadAppearances} position={popupPosition} />
                                    )}
                                  </div>
                                )}
                              </div>
                              <span className="font-mono text-[11px] font-medium text-muted-3">ID {p.id}</span>
                            </div>
                          </td>
                          <td className={`${tdClass} text-center`}>
                            <TierText value={p.metadata.overall} className="text-base" />
                          </td>
                          <td className={`${tdClass} text-center text-sm font-semibold text-fg-3`}>
                            {p.metadata.age}
                          </td>
                          <td className={`${tdClass} text-[13px] font-semibold text-fg-3`}>
                            <div className="flex gap-2">
                              {p.metadata.positions.slice(0,3).map(pos => (
                                <span key={pos}>
                                  {pos} <TierText value={calculatePositionRating(p, pos as any)} />
                                </span>
                              ))}
                              {p.metadata.positions.length > 3 && (
                                <span>+{p.metadata.positions.length - 3}</span>
                              )}
                            </div>
                          </td>
                          {[
                            p.metadata.pace,
                            p.metadata.shooting,
                            p.metadata.passing,
                            p.metadata.dribbling,
                            p.metadata.defense,
                            p.metadata.physical,
                          ].map((value, i) => (
                            <td key={i} className={`${tdClass} text-center`}>
                              <TierText value={value} className="text-sm" />
                            </td>
                          ))}
                          <td className={`${tdClass} !pr-5 text-center`}>
                            <button
                              onClick={() => {
                                const newSquad = { ...squad } as Squad;
                                // remove by player id across positions
                                const entries = Object.entries(newSquad.players).filter(([_, v]) => v.player.id !== p.id);
                                newSquad.players = Object.fromEntries(entries);
                                addToHistory(newSquad);
                                setSquad(newSquad);
                              }}
                              className="inline-grid place-items-center w-7 h-7 rounded-lg border border-line-2 bg-panel text-muted cursor-pointer transition-colors hover:text-danger-ink hover:border-red-500/45"
                              aria-label="Remove from squad"
                              title="Remove"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} aria-hidden="true">
                                <path d="M6 6l12 12M18 6 6 18" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {squadSize > 0 && (
                <div className="flex justify-end px-5 py-3.5">
                  <button
                    type="button"
                    onClick={handleExportSquadToExcel}
                    className="inline-flex items-center justify-center h-10 px-4 rounded-full border border-pos-line bg-btn-pos text-pos-ink text-[13px] font-bold whitespace-nowrap cursor-pointer transition-colors hover:border-pos-ink"
                  >
                    Export squad to Excel (CSV)
                  </button>
                </div>
              )}
            </Panel>
          </div>
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activePlayer ? (
            <div className="flex flex-col gap-2.5 px-3.5 py-3 rounded-2xl border border-line-hover bg-panel shadow-[0_20px_50px_rgba(0,0,0,.45)]">
              {/* Player Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="m-0 text-sm font-bold text-fg truncate">
                    {activePlayer.metadata.firstName} {activePlayer.metadata.lastName}
                  </h3>
                  <p className="m-0 text-xs font-medium text-muted">
                    {activePlayer.metadata.positions.join(', ')}
                  </p>
                </div>
                <div className="flex-none flex flex-col items-center">
                  <span
                    className="font-display text-xl font-extrabold leading-none tabular-nums"
                    style={{ color: getTierColors(activePlayer.metadata.overall).text }}
                  >
                    {activePlayer.metadata.overall}
                  </span>
                  <span className="text-[9px] font-bold tracking-[0.1em] text-muted-3">OVR</span>
                </div>
              </div>

              {/* Player Stats */}
              <div className="grid grid-cols-3 gap-1">
                {([
                  ['PAC', activePlayer.metadata.pace],
                  ['SHO', activePlayer.metadata.shooting],
                  ['PAS', activePlayer.metadata.passing],
                  ['DRI', activePlayer.metadata.dribbling],
                  ['DEF', activePlayer.metadata.defense],
                  ['PHY', activePlayer.metadata.physical],
                ] as [string, number][]).map(([label, value]) => (
                  <div key={label} className="flex flex-col items-center">
                    <TierText value={value} className="text-sm" />
                    <span className="text-[10px] font-bold tracking-[0.08em] text-muted-3">{label}</span>
                  </div>
                ))}
              </div>

              {/* Position Ratings */}
              <div className="flex flex-col gap-1.5 pt-2 border-t border-divider">
                <span className="text-xs font-semibold text-muted">Position Ratings:</span>
                <div className="flex flex-wrap gap-1">
                  {activePlayer.metadata.positions.slice(0, 3).map((position) => (
                    <PositionChip
                      key={position}
                      position={position}
                      rating={calculatePositionRating(activePlayer, position as any)}
                    />
                  ))}
                  {activePlayer.metadata.positions.length > 3 && (
                    <span className="inline-flex items-center h-6 px-2.5 rounded-full border border-chip-line bg-chip text-[11px] font-bold text-fg-3">
                      +{activePlayer.metadata.positions.length - 3}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </DragOverlay>

        {/* Save Squad Modal */}
        {showSaveModal && (
          <div className={modalBackdropClass}>
            <div className={`${modalClass} max-w-md`}>
              <h3 className="m-0 mb-1.5 font-display text-xl font-bold text-fg">
                Name Your Squad
              </h3>
              <p className="m-0 mb-4 text-sm text-muted">Enter a name for your new squad.</p>
              <input
                type="text"
                value={pendingSaveName}
                onChange={(e) => setPendingSaveName(e.target.value)}
                placeholder="e.g. 4-3-3 First XI"
                className={`${fieldClass} w-full mb-5`}
              />
              <div className="flex justify-end gap-2">
                <button
                  className={btnPill}
                  onClick={() => setShowSaveModal(false)}
                >
                  Cancel
                </button>
                <button
                  className={btnPrimary}
                  onClick={handleConfirmSaveName}
                  disabled={isSaving || !pendingSaveName.trim()}
                >
                  {isSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Load Squad Modal */}
        {showLoadModal && (
          <div className={modalBackdropClass}>
            <div className={`${modalClass} max-w-2xl max-h-[80vh] overflow-hidden`}>
              <h3 className="m-0 mb-4 font-display text-xl font-bold text-fg">
                Load Saved Squad
              </h3>

              {isLoadingSquads ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm font-medium text-muted">
                  <div className={`w-6 h-6 ${spinnerClass}`}></div>
                  <span>Loading squads...</span>
                </div>
              ) : savedSquads.length === 0 ? (
                <div className="flex flex-col items-center gap-1.5 py-8 text-center">
                  <p className="m-0 text-sm font-medium text-muted">No saved squads found.</p>
                  <p className="m-0 text-sm text-muted-3">
                    Create and save a squad to see it here.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5 max-h-96 overflow-y-auto">
                  {savedSquads.map((savedSquad) => (
                    <div
                      key={savedSquad.id}
                      className="flex items-center justify-between gap-3 p-4 rounded-2xl border border-line bg-inset transition-colors hover:border-line-hover"
                    >
                      <div className="flex-1 min-w-0">
                        <h4 className="m-0 text-[15px] font-bold text-fg truncate">
                          {savedSquad.squad_name}
                        </h4>
                        <div className="flex flex-wrap items-center gap-x-4 mt-1 text-xs font-medium text-muted">
                          <span>Players: {Object.keys(savedSquad.players).length}</span>
                          <span>Updated: {new Date(savedSquad.updated_at).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <button
                          onClick={() => handleLoadSquad(savedSquad)}
                          className={btnPrimary}
                        >
                          Load
                        </button>
                        <button
                          onClick={() => handleDeleteSquad(savedSquad.id, savedSquad.squad_name)}
                          disabled={isDeleting === savedSquad.id}
                          className={btnDanger}
                        >
                          {isDeleting === savedSquad.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setShowLoadModal(false)}
                  className={btnPill}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Positions Coverage Modal */}
        {showCoverageModal && (
          <div className={modalBackdropClass}>
            <div className={`${modalClass} max-w-4xl max-h-[80vh] overflow-y-auto`}>
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="m-0 font-display text-xl font-bold text-fg">All Positions Coverage</h3>
                <button
                  type="button"
                  className={btnPill}
                  onClick={() => setShowCoverageModal(false)}
                >
                  Close
                </button>
              </div>
              {(() => {
                const order = ['GK','CB','LB','RB','LWB','RWB','CDM','CM','CAM','LM','RM','LW','RW','CF','ST'];
                const grouped: Record<string, MFLPlayer[]> = {};
                order.forEach(p => { grouped[p] = []; });

                const playersList = Object.values(squad.players).map(sp => sp.player);
                const getRating = (pid: string, pos: string, player: MFLPlayer) => {
                  const viaCanonical = coverageRatings?.[pid]?.[pos];
                  if (typeof viaCanonical === 'number') return viaCanonical;
                  // Fallback to local calculator if canonical not precomputed
                  return calculatePositionRating(player, pos as any);
                };

                playersList.forEach(p => {
                  const pid = p.id.toString();
                  const overall = p.metadata.overall || 0;
                  const threshold = Math.max(0, overall - 5);
                  for (const pos of order) {
                    const rating = getRating(pid, pos, p);
                    if (rating >= threshold) {
                      if (!grouped[pos]) grouped[pos] = [];
                      if (!grouped[pos].some(existing => existing.id === p.id)) grouped[pos].push(p);
                    }
                  }
                });

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {order.map(pos => (
                      <div key={pos} className="flex flex-col gap-2 p-3.5 rounded-2xl border border-line bg-inset">
                        <h4 className="m-0 font-display text-base font-bold text-fg">{pos}</h4>
                        <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
                          {(grouped[pos] || []).length === 0 ? (
                            <div className="text-xs text-muted">No players</div>
                          ) : (
                            [...(grouped[pos] || [])]
                              .sort((a, b) => (
                                getRating(b.id.toString(), pos, b) - getRating(a.id.toString(), pos, a)
                              ))
                              .map(pl => {
                                const pr = getRating(pl.id.toString(), pos, pl);
                                return (
                                  <div key={`${pos}-${pl.id}`} className="flex items-center justify-between gap-2 text-[13px]">
                                    <span className="flex items-center gap-1 min-w-0 font-medium text-fg-2">
                                      <span className="truncate">{pl.metadata.firstName} {pl.metadata.lastName}</span>
                                      <RetirementIcon retirementYears={pl.metadata.retirementYears} className="w-3 h-3" />
                                    </span>
                                    <TierText value={pr} />
                                  </div>
                                );
                              })
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Toast Notifications */}
        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </div>
    </DndContext>
  );
}
