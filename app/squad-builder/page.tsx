'use client';

import { useState, useEffect, useRef } from 'react';
import * as Slider from '@radix-ui/react-slider';
import { useRouter } from 'next/navigation';
import { useWallet } from '../../src/contexts/WalletContext';
import { supabaseDataService } from '../../src/services/supabaseDataService';
import { MFLPlayer } from '../../src/types/mflApi';
import { getSquads, saveSquad, updateSquad, deleteSquad, loadSquad, SavedSquad } from '../../src/services/squadService';
import { useToast, ToastContainer } from '../../src/components/Toast';
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
  const averageOverall = Math.round(totalOverall / totalPlayers);

  // Calculate average stats (chemistry removed per spec)
  const stats = {
    pace: Math.round(squadPlayers.reduce((sum, p) => sum + (p?.player.metadata.pace || 0), 0) / totalPlayers),
    shooting: Math.round(squadPlayers.reduce((sum, p) => sum + (p?.player.metadata.shooting || 0), 0) / totalPlayers),
    passing: Math.round(squadPlayers.reduce((sum, p) => sum + (p?.player.metadata.passing || 0), 0) / totalPlayers),
    dribbling: Math.round(squadPlayers.reduce((sum, p) => sum + (p?.player.metadata.dribbling || 0), 0) / totalPlayers),
    defense: Math.round(squadPlayers.reduce((sum, p) => sum + (p?.player.metadata.defense || 0), 0) / totalPlayers),
    physical: Math.round(squadPlayers.reduce((sum, p) => sum + (p?.player.metadata.physical || 0), 0) / totalPlayers)
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

// Draggable Player Card Component
interface DraggablePlayerCardProps {
  player: MFLPlayer;
  onAdd: (player: MFLPlayer) => void;
  isInSquad?: boolean;
}

function DraggablePlayerCard({ player, onAdd, isInSquad = false }: DraggablePlayerCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: player.id.toString() });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Tiered text color for stats, matching card tiers
  const getTierTextColor = (value: number): string => {
    if (value >= 95) return '#87f6f8';        // Ultimate
    if (value >= 85) return '#fa53ff';        // Legendary
    if (value >= 75) return '#0047ff';        // Epic
    if (value >= 65) return '#71ff30';        // Uncommon
    if (value >= 55) return '#ecd17f';        // Limited
    return '#9f9f9f';                          // Common
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => { if (!isInSquad) onAdd(player); }}
      className={`p-2 md:p-3 border rounded-lg cursor-pointer transition-colors ${
        isInSquad
          ? 'border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 opacity-80'
          : 'border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-blue-400 dark:hover:border-blue-500'
      }`}
    >
                    <div className="flex items-center justify-between mb-1 cursor-pointer">
        <div className="min-w-0">
          <h3 className="font-medium text-gray-900 dark:text-white text-sm md:text-base truncate flex items-center gap-2">
            {player.metadata.firstName} {player.metadata.lastName}
            <a
              href={`/players/${player.id}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex-shrink-0 inline-flex items-center justify-center w-4 h-4 text-[9px] border border-gray-400 dark:border-gray-500 rounded-md text-gray-500 dark:text-gray-400 hover:text-blue-500 hover:border-blue-400"
              aria-label="Open player page"
              title="Open player page"
            >
              ↗
            </a>
          </h3>
          <div className="text-xs md:text-sm text-gray-600 dark:text-gray-400 truncate">
            {player.metadata.positions.slice(0,3).map((position) => {
              const rating = calculatePositionRating(player, position as any);
              const color = (() => {
                if (rating >= 95) return 'var(--tier-ultimate)';
                if (rating >= 85) return 'var(--tier-legendary)';
                if (rating >= 75) return 'var(--tier-epic)';
                if (rating >= 65) return 'var(--tier-uncommon)';
                if (rating >= 55) return 'var(--tier-limited)';
                return 'var(--tier-common)';
              })();
              return (
                <span key={position} className="mr-2">
                  {position} <span className="font-semibold" style={{ color }}>{rating}</span>
                </span>
              );
            })}
            {player.metadata.positions.length > 3 && (
              <span>+{player.metadata.positions.length - 3}</span>
            )}
          </div>
        </div>
          <div className="text-right flex-shrink-0 pl-2 pointer-events-none">
          <div
            className="text-xl md:text-2xl font-bold leading-5"
            style={{ color: (() => {
              const o = player.metadata.overall;
              if (o >= 95) return 'var(--tier-ultimate)';     // 95-99
              if (o >= 85) return 'var(--tier-legendary)';    // 85-94
              if (o >= 75) return 'var(--tier-epic)';         // 75-84
              if (o >= 65) return 'var(--tier-uncommon)';     // 65-74
              if (o >= 55) return 'var(--tier-limited)';      // 55-64
              return 'var(--tier-common)';                    // <55
            })() }}
          >
            {player.metadata.overall}
          </div>
          <div className="text-[10px] text-gray-500 dark:text-gray-500">OVR</div>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs md:text-sm gap-2">
        <span className="font-medium" style={{ color: getTierTextColor(player.metadata.pace) }}>{player.metadata.pace}</span>
        <span className="font-medium" style={{ color: getTierTextColor(player.metadata.shooting) }}>{player.metadata.shooting}</span>
        <span className="font-medium" style={{ color: getTierTextColor(player.metadata.passing) }}>{player.metadata.passing}</span>
        <span className="font-medium" style={{ color: getTierTextColor(player.metadata.dribbling) }}>{player.metadata.dribbling}</span>
        <span className="font-medium" style={{ color: getTierTextColor(player.metadata.defense) }}>{player.metadata.defense}</span>
        <span className="font-medium" style={{ color: getTierTextColor(player.metadata.physical) }}>{player.metadata.physical}</span>
      </div>

      {/* Action buttons removed per spec; click card to add */}
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
            ? 'bg-green-100 dark:bg-green-900/30 border-green-500'
            : 'bg-red-100 dark:bg-red-900/30 border-red-500'
          : player
          ? 'bg-green-100 dark:bg-green-900/30 border-green-500'
          : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/30'
      }`}
      {...attributes}
      {...listeners}
      onClick={handleClickAssign}
    >
      {player ? (
        <div className="text-xs font-medium text-green-700 dark:text-green-300 text-center">
          <div className="truncate">{player.player.metadata.firstName}</div>
          <div className="text-xs">{player.player.metadata.overall}</div>
        </div>
      ) : (
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
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
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isLoadingSquads, setIsLoadingSquads] = useState(false);
  const { toasts, removeToast, success, error: showError, warning, info } = useToast();
  const [squadStats, setSquadStats] = useState({
    averageOverall: 0,
    totalPlayers: 0,
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
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(false);
  const [playersError, setPlayersError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [showSidebarFilters, setShowSidebarFilters] = useState(false);
  const [sidebarPage, setSidebarPage] = useState(0);
  const pageSize = 20;

  // Table/stat tier color helper (match sidebar/card tiers)
  const getTierTextColorValue = (value: number): string => {
    if (value >= 95) return '#87f6f8';      // Ultimate
    if (value >= 85) return '#fa53ff';      // Legendary
    if (value >= 75) return '#0047ff';      // Epic
    if (value >= 65) return '#71ff30';      // Uncommon
    if (value >= 55) return '#ecd17f';      // Limited
    return '#9f9f9f';                        // Common
  };
  const [selectedDeleteId, setSelectedDeleteId] = useState<string | null>(null);

  // Choose best available formation slot for a player (prefer valid within ±6 OVR, otherwise first empty)
  const pickTargetPositionForPlayer = (player: MFLPlayer, formation: Formation, current: Squad): string | null => {
    const emptyPositions = formation.positions.filter((pos) => !current.players[pos]);
    if (emptyPositions.length === 0) return null;
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
  const [tableSortKey, setTableSortKey] = useState<'name'|'overall'|'pace'|'shooting'|'passing'|'dribbling'|'defense'|'physical'>('overall');
  const [tableSortDir, setTableSortDir] = useState<'asc'|'desc'>('desc');
  const handleTableSort = (key: typeof tableSortKey) => {
    setTableSortKey(prev => {
      if (prev === key) {
        setTableSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setTableSortDir('desc');
      return key;
    });
  };
  const tableSortedPlayers = [...selectedFormation.positions
    .map(pos => squad.players[pos])
    .filter(Boolean)
    .map(sp => sp!.player)] as MFLPlayer[];
  tableSortedPlayers.sort((a, b) => {
    const dir = tableSortDir === 'asc' ? 1 : -1;
    const keyMap: any = { overall: 'overall', pace: 'pace', shooting: 'shooting', passing: 'passing', dribbling: 'dribbling', defense: 'defense', physical: 'physical' };
    if (tableSortKey === 'name') {
      const an = `${a.metadata.firstName} ${a.metadata.lastName}`;
      const bn = `${b.metadata.firstName} ${b.metadata.lastName}`;
      return an.localeCompare(bn) * dir;
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
      showError('Missing name', 'Please enter a squad name before saving.', 2000);
      return;
    }
    try {
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
      success('Squad Saved!', `"${name}" has been saved successfully.`, 2000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save squad';
      showError('Save Failed', errorMessage, 2000);
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
      success('Squad Loaded!', `"${savedSquad.squad_name}" has been loaded successfully.`, 2000);
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

    // Position filter
    if (filterPosition !== 'all') {
      filtered = filtered.filter(player => 
        player.metadata.positions.includes(filterPosition as any)
      );
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

    const dir = sidebarSortDir === 'asc' ? 1 : -1;
    if (sidebarSortKey === 'name') {
      filtered.sort((a, b) => (`${a.metadata.firstName} ${a.metadata.lastName}`).localeCompare(`${b.metadata.firstName} ${b.metadata.lastName}`) * dir);
    } else {
      const map: any = { overall: 'overall', pace: 'pace', shooting: 'shooting', passing: 'passing', dribbling: 'dribbling', defense: 'defense', physical: 'physical' };
      filtered.sort((a, b) => (((a.metadata as any)[map[sidebarSortKey]] ?? 0) - ((b.metadata as any)[map[sidebarSortKey]] ?? 0)) * dir);
    }
    setFilteredPlayers(filtered);
    setSidebarPage(0);
  }, [searchTerm, filterPosition, players, debouncedAttr, debouncedAttrMax, debouncedOverallMin, debouncedOverallMax, debouncedPositionRatingMin, debouncedPositionRatingMax, selectedCardTypes, sidebarSortKey, sidebarSortDir]);

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
    const targetPos = selectedFormation.positions.find(pos => !squad.players[pos]);
    if (!targetPos) return;
    const canPlayPosition = validatePlayerPosition(player, targetPos);
    if (!canPlayPosition.isValid) return;
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
      <div className="min-h-screen">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">
              {!hasCheckedWallet ? 'Checking wallet connection...' : 'Loading squad builder...'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen">
        <div className="flex items-start justify-center min-h-[calc(100vh-6rem)]">
          <div className="text-center max-w-md">
            <div className="mb-6">
              <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Error</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
            </div>
            
            <div className="space-y-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => router.push('/')}
                className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Back to Home
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="min-h-screen">
          <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Squad Builder</h1>
          <div className="flex items-center gap-2">
            {tableSortedPlayers.length > 0 && (
              <button
                className="ml-2 px-3 py-1.5 text-sm rounded-lg border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer"
                onClick={() => setShowStats(prev => !prev)}
              >
                {showStats ? 'Hide Squad Statistics' : 'Show Squad Statistics'}
              </button>
            )}

            {/* Inline Squad Actions (moved above table) */}
            <div className="flex items-center gap-2 md:gap-3 flex-wrap">
              {/* Load Squad (button styled like Show Stats) */}
              <button
                className="px-3 py-1.5 text-sm rounded-lg border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer"
                onClick={() => setShowLoadModal(true)}
                title="Load Squad"
              >
                Load Squad
              </button>

              {/* Save Squad (only when there are players) */}
              {Object.keys(squad.players).length > 0 && (
                <button
                  className="px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer text-sm"
                  onClick={handleSaveSquad}
                >
                  Save Squad
                </button>
              )}

              {/* Clear Squad */}
              {Object.keys(squad.players).length > 0 && (
                <button
                  className="px-4 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors cursor-pointer text-sm"
                  onClick={() => {
                    const newSquad = { ...squad, players: {} };
                    addToHistory(newSquad);
                    setSquad(newSquad);
                    info('Squad Cleared', 'All players have been removed from the squad.');
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
                    className="px-4 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors cursor-pointer text-sm"
                    onClick={() => handleDeleteSquad(current.id, current.squad_name)}
                  >
                    Delete Squad
                  </button>
                ) : null;
              })()}
            </div>
          </div>
        </div>

        {isInitializing && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Initializing Squad Builder</h3>
              <p className="text-gray-600 dark:text-gray-400">Loading your players and squads...</p>
            </div>
          </div>
        )}

        <div className={`grid grid-cols-1 lg:grid-cols-[calc(32%_-_50px)_calc(68%_+_50px)] gap-2 lg:gap-3 items-start ${isInitializing ? 'hidden' : ''}`}>        {/* Player Sidebar */}
        <div className="min-w-0">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 min-h-[830px] mb-4">
            {/* Header removed per spec */}
            
            {isLoadingPlayers && (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600 dark:text-gray-400">Loading players...</span>
              </div>
            )}
            
            {playersError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Failed to load players</h3>
                    <p className="text-sm text-red-700 dark:text-red-300 mt-1">{playersError}</p>
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
                      className="mt-2 text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 underline"
                    >
                      Try again
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Search */}
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search players..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Filters */}
            <div className="space-y-3 mb-2">
              {/* Rating Sliders (Overall first, Position rating second) */}
              <button
                className="w-full text-left px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer"
                onClick={() => setShowSidebarFilters(v => !v)}
              >
                {showSidebarFilters ? 'Hide Filters' : 'Show Filters'}
              </button>
              <div className={`grid grid-cols-2 gap-3 ${showSidebarFilters ? '' : 'hidden'}`}>
                {/* Card Type Filter */}
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Card type</label>
                  <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap py-1">
                    {[
                      { key: 'common', label: 'Common', bg: 'bg-[#9f9f9f]', text: 'text-white' },
                      { key: 'limited', label: 'Limited', bg: 'bg-[#ecd17f]', text: 'text-black' },
                      { key: 'uncommon', label: 'Uncommon', bg: 'bg-[#71ff30]', text: 'text-black' },
                      { key: 'epic', label: 'Epic', bg: 'bg-[#0047ff]', text: 'text-white' },
                      { key: 'legendary', label: 'Legendary', bg: 'bg-[#fa53ff]', text: 'text-white' },
                      { key: 'ultimate', label: 'Ultimate', bg: 'bg-[#87f6f8]', text: 'text-black' },
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
                          className={`${opt.bg} ${opt.text} w-[30px] h-[35px] rounded-lg shadow-sm text-xs font-semibold cursor-pointer select-none flex items-center justify-center p-0 border ${isSelected ? 'border-2 border-white' : 'border-[var(--tier-common-foreground)]/15'}`}
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Position
                  </label>
                  <select
                    value={filterPosition}
                    onChange={(e) => setFilterPosition(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">All Positions</option>
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
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Overall {overallMin} - {overallMax}
                  </label>
                  <Slider.Root
                    className="relative flex items-center select-none w-full h-5"
                    min={0}
                    max={100}
                    step={1}
                    value={[overallMin, overallMax]}
                    onValueChange={([min, max]) => { setOverallMin(min); setOverallMax(max); }}
                  >
                    <Slider.Track className="bg-gray-200 dark:bg-gray-600 relative grow rounded h-1" />
                    <Slider.Range className="absolute h-1 bg-blue-500 rounded" />
                    <Slider.Thumb className="block w-2.5 h-5 bg-gray-600 border border-gray-400 rounded-sm" aria-label="Overall min" />
                    <Slider.Thumb className="block w-2.5 h-5 bg-gray-600 border border-gray-400 rounded-sm" aria-label="Overall max" />
                  </Slider.Root>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Position rating {positionRatingMin} - {positionRatingMax}
                  </label>
                  <Slider.Root
                    className="relative flex items-center select-none w-full h-5"
                    min={0}
                    max={100}
                    step={1}
                    value={[positionRatingMin, positionRatingMax]}
                    onValueChange={([min, max]) => { setPositionRatingMin(min); setPositionRatingMax(max); }}
                  >
                    <Slider.Track className="bg-gray-200 dark:bg-gray-600 relative grow rounded h-1" />
                    <Slider.Range className="absolute h-1 bg-blue-500 rounded" />
                    <Slider.Thumb className="block w-2.5 h-5 bg-gray-600 border border-gray-400 rounded-sm" aria-label="Position min" />
                    <Slider.Thumb className="block w-2.5 h-5 bg-gray-600 border border-gray-400 rounded-sm" aria-label="Position max" />
                  </Slider.Root>
                </div>
                {([
                  ['pace','PAC'],['shooting','SHO'],['passing','PAS'],['dribbling','DRI'],['defense','DEF'],['physical','PHY']
                ] as Array<[keyof typeof debouncedAttr,string]>).map(([key,label]) => (
                  <div key={key} className="col-span-1">
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {label} {attrFilters[key]} - {attrFiltersMax[key]}
                    </label>
                    <Slider.Root
                      className="relative flex items-center select-none w-full h-5"
                      min={0}
                      max={100}
                      step={1}
                      value={[attrFilters[key], attrFiltersMax[key]]}
                      onValueChange={([min, max]) => {
                        setAttrFilters(prev => ({ ...prev, [key]: min }));
                        setAttrFiltersMax(prev => ({ ...prev, [key]: max }));
                      }}
                    >
                      <Slider.Track className="bg-gray-200 dark:bg-gray-600 relative grow rounded h-1" />
                      <Slider.Range className="absolute h-1 bg-blue-500 rounded" />
                      <Slider.Thumb className="block w-2.5 h-5 bg-gray-600 border border-gray-400 rounded-sm" aria-label={`${label} min`} />
                      <Slider.Thumb className="block w-2.5 h-5 bg-gray-600 border border-gray-400 rounded-sm" aria-label={`${label} max`} />
                    </Slider.Root>
                  </div>
                ))}
              </div>

      
              {/* Sort By removed per spec */}
            </div>

            {/* Summary */}

            {/* Pagination header (info) */}
            {filteredPlayers.length > pageSize && (
              <div className="flex items-center justify-end mb-3 text-xs text-gray-700 dark:text-gray-300">
                <span>Showing {Math.min((sidebarPage + 1) * pageSize, filteredPlayers.length)} of {filteredPlayers.length} players</span>
              </div>
            )}

            {/* Player List */}
            <div className="space-y-2 min-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
              <SortableContext items={filteredPlayers.slice(sidebarPage*pageSize, sidebarPage*pageSize+pageSize).map(p => p.id.toString())} strategy={verticalListSortingStrategy}>
                {filteredPlayers.slice(sidebarPage*pageSize, sidebarPage*pageSize+pageSize).map((player) => {
                  const isInSquad = Object.values(squad.players).some(sp => sp.player.id === player.id);
                  return (
                  <div key={player.id} className="flex flex-col gap-1">
                    <DraggablePlayerCard player={player} isInSquad={isInSquad} onAdd={(p) => {
                      const targetPos = pickTargetPositionForPlayer(p, selectedFormation, squad);
                      if (!targetPos) return;
                      const newSquad: Squad = { ...squad, players: { ...squad.players, [targetPos]: { player: p, position: targetPos } } };
                      addToHistory(newSquad);
                      setSquad(newSquad);
                    }} />
                  </div>
                )})}
              </SortableContext>
            </div>
            {/* Pagination footer with numbers (split into two lines to avoid overflow) */}
            {filteredPlayers.length > pageSize && (
              <div className="mt-2 text-xs text-gray-700 dark:text-gray-300">
                {(() => {
                  const pageCount = Math.ceil(filteredPlayers.length / pageSize);
                  const half = Math.ceil(pageCount / 2);
                  const renderRange = (start: number, end: number) => (
                    <div className="flex flex-wrap justify-center gap-1 mb-1">
                      {Array.from({ length: end - start }).map((_, idx) => {
                        const i = start + idx;
                        return (
                          <button
                            key={i}
                            className={`min-w-7 h-7 px-2 rounded border ${i===sidebarPage ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'} cursor-pointer`}
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
                      {renderRange(0, half)}
                      {pageCount > 1 && renderRange(half, pageCount)}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>

        {/* Main Squad Builder Area */}
        <div className="min-w-0">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 min-h-[830px]">
            {/* Formation Selector with Analysis (hidden in table view) */}
            {/* Formation analysis and field view removed */}

            {/* Enhanced Squad Statistics (collapsible) */}
            {showStats && (
            <div ref={statsRef} className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              
              {/* Primary Statistics with Progress Bars (chemistry hidden per spec) */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mb-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-1">
                    {squadStats.averageOverall}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Avg Overall</div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${squadStats.averageOverall}%` }}
                    ></div>
                  </div>
                </div>
                {/* Formation Fit removed */}
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400 mb-1">
                    {squadStats.totalPlayers}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Players</div>
                </div>
              </div>

              {/* Squad Stats Breakdown with Enhanced Visuals */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="text-center p-3 bg-white dark:bg-gray-700 rounded-lg">
                  <div className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                    {squadStats.stats.pace}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">PAC</div>
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1">
                    <div 
                      className="bg-yellow-500 h-1 rounded-full transition-all duration-300"
                      style={{ width: `${squadStats.stats.pace}%` }}
                    ></div>
                  </div>
                </div>
                <div className="text-center p-3 bg-white dark:bg-gray-700 rounded-lg">
                  <div className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                    {squadStats.stats.shooting}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">SHO</div>
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1">
                    <div 
                      className="bg-red-500 h-1 rounded-full transition-all duration-300"
                      style={{ width: `${squadStats.stats.shooting}%` }}
                    ></div>
                  </div>
                </div>
                <div className="text-center p-3 bg-white dark:bg-gray-700 rounded-lg">
                  <div className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                    {squadStats.stats.passing}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">PAS</div>
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1">
                    <div 
                      className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                      style={{ width: `${squadStats.stats.passing}%` }}
                    ></div>
                  </div>
                </div>
                <div className="text-center p-3 bg-white dark:bg-gray-700 rounded-lg">
                  <div className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                    {squadStats.stats.dribbling}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">DRI</div>
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1">
                    <div 
                      className="bg-green-500 h-1 rounded-full transition-all duration-300"
                      style={{ width: `${squadStats.stats.dribbling}%` }}
                    ></div>
                  </div>
                </div>
                <div className="text-center p-3 bg-white dark:bg-gray-700 rounded-lg">
                  <div className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                    {squadStats.stats.defense}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">DEF</div>
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1">
                    <div 
                      className="bg-indigo-500 h-1 rounded-full transition-all duration-300"
                      style={{ width: `${squadStats.stats.defense}%` }}
                    ></div>
                  </div>
                </div>
                <div className="text-center p-3 bg-white dark:bg-gray-700 rounded-lg">
                  <div className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                    {squadStats.stats.physical}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">PHY</div>
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1">
                    <div 
                      className="bg-orange-500 h-1 rounded-full transition-all duration-300"
                      style={{ width: `${squadStats.stats.physical}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Advanced Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-700 rounded-lg p-3">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Squad Balance</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-600 dark:text-gray-400">Attack</span>
                      <span className="text-xs font-medium text-gray-900 dark:text-white">
                        {Math.round((squadStats.stats.shooting + squadStats.stats.pace) / 2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-600 dark:text-gray-400">Midfield</span>
                      <span className="text-xs font-medium text-gray-900 dark:text-white">
                        {Math.round((squadStats.stats.passing + squadStats.stats.dribbling) / 2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-600 dark:text-gray-400">Defense</span>
                      <span className="text-xs font-medium text-gray-900 dark:text-white">
                        {Math.round((squadStats.stats.defense + squadStats.stats.physical) / 2)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-700 rounded-lg p-3">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Age Analysis</h4>
                  <div className="space-y-2">
                    {(() => {
                      const squadPlayers = Object.values(squad.players);
                      if (squadPlayers.length === 0) return (
                        <div className="text-xs text-gray-500 dark:text-gray-400">No players</div>
                      );
                      const ages = squadPlayers.map(sp => sp.player.metadata.age);
                      const avgAge = Math.round(ages.reduce((sum, age) => sum + age, 0) / ages.length);
                      const minAge = Math.min(...ages);
                      const maxAge = Math.max(...ages);
                      return (
                        <>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-600 dark:text-gray-400">Average</span>
                            <span className="text-xs font-medium text-gray-900 dark:text-white">{avgAge}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-600 dark:text-gray-400">Range</span>
                            <span className="text-xs font-medium text-gray-900 dark:text-white">{minAge}-{maxAge}</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-700 rounded-lg p-3">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Position Coverage</h4>
                  <div className="space-y-2">
                    {(() => {
                      const squadPlayers = Object.values(squad.players);
                      const coveredPositions = new Set();
                      squadPlayers.forEach(sp => {
                        sp.player.metadata.positions.forEach(pos => coveredPositions.add(pos));
                      });
                      const totalPositions = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST'].length;
                      const coveragePercent = Math.round((coveredPositions.size / totalPositions) * 100);
                      return (
                        <>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-600 dark:text-gray-400">Coverage</span>
                            <span className="text-xs font-medium text-gray-900 dark:text-white">{coveragePercent}%</span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                            <div 
                              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${coveragePercent}%` }}
                            ></div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
            )}

            {/* Squad Validation removed per spec */}

            {/* Field display removed */}

            {/* Table View: reuse club page styles. Show only players currently in squad */}
            {/* Squad Name inline editor */}
            <div className="mb-3">
              <input
                type="text"
                value={squad.name}
                onChange={(e) => setSquad(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Squad name..."
                className="w-full max-w-md px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th onClick={() => handleTableSort('name')} className="cursor-pointer px-4 py-3 text-left text-sm font-semibold text-gray-600 dark:text-white uppercase tracking-wider">Player</th>
                        <th onClick={() => handleTableSort('overall')} className="cursor-pointer px-4 py-3 text-center text-sm font-semibold text-gray-600 dark:text-white uppercase tracking-wider">OVR {tableSortKey==='overall' ? (tableSortDir==='asc'?'↑':'↓') : ''}</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600 dark:text-white uppercase tracking-wider">Positions</th>
                        <th onClick={() => handleTableSort('pace')} className="cursor-pointer px-4 py-3 text-center text-sm font-semibold text-gray-600 dark:text-white uppercase tracking-wider">PAC {tableSortKey==='pace' ? (tableSortDir==='asc'?'↑':'↓') : ''}</th>
                        <th onClick={() => handleTableSort('shooting')} className="cursor-pointer px-4 py-3 text-center text-sm font-semibold text-gray-600 dark:text-white uppercase tracking-wider">SHO {tableSortKey==='shooting' ? (tableSortDir==='asc'?'↑':'↓') : ''}</th>
                        <th onClick={() => handleTableSort('passing')} className="cursor-pointer px-4 py-3 text-center text-sm font-semibold text-gray-600 dark:text-white uppercase tracking-wider">PAS {tableSortKey==='passing' ? (tableSortDir==='asc'?'↑':'↓') : ''}</th>
                        <th onClick={() => handleTableSort('dribbling')} className="cursor-pointer px-4 py-3 text-center text-sm font-semibold text-gray-600 dark:text-white uppercase tracking-wider">DRI {tableSortKey==='dribbling' ? (tableSortDir==='asc'?'↑':'↓') : ''}</th>
                        <th onClick={() => handleTableSort('defense')} className="cursor-pointer px-4 py-3 text-center text-sm font-semibold text-gray-600 dark:text-white uppercase tracking-wider">DEF {tableSortKey==='defense' ? (tableSortDir==='asc'?'↑':'↓') : ''}</th>
                        <th onClick={() => handleTableSort('physical')} className="cursor-pointer px-4 py-3 text-center text-sm font-semibold text-gray-600 dark:text-white uppercase tracking-wider">PHY {tableSortKey==='physical' ? (tableSortDir==='asc'?'↑':'↓') : ''}</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600 dark:text-white uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {tableSortedPlayers.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="px-4 py-8 text-center text-base text-gray-600 dark:text-gray-400">
                            To add players to your squad click or drag them from the left sidebar
                          </td>
                        </tr>
                      ) : null}
                      {tableSortedPlayers.map((p) => (
                        <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-4 py-3 whitespace-nowrap text-base text-gray-900 dark:text-white">
                            {p.metadata.firstName} {p.metadata.lastName}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-base text-center">
                            <span className="font-semibold" style={{ color: getTierTextColorValue(p.metadata.overall) }}>{p.metadata.overall}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-base text-gray-900 dark:text-white">
                            {p.metadata.positions.slice(0,3).map(pos => {
                              const rating = calculatePositionRating(p, pos as any);
                              return (
                                <span key={pos} className="mr-2">
                                  {pos} <span style={{ color: getTierTextColorValue(rating) }}>{rating}</span>
                                </span>
                              );
                            })}
                            {p.metadata.positions.length > 3 && (
                              <span>+{p.metadata.positions.length - 3}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-base text-center">
                            <span className="font-semibold" style={{ color: getTierTextColorValue(p.metadata.pace) }}>{p.metadata.pace}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-base text-center">
                            <span className="font-semibold" style={{ color: getTierTextColorValue(p.metadata.shooting) }}>{p.metadata.shooting}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-base text-center">
                            <span className="font-semibold" style={{ color: getTierTextColorValue(p.metadata.passing) }}>{p.metadata.passing}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-base text-center">
                            <span className="font-semibold" style={{ color: getTierTextColorValue(p.metadata.dribbling) }}>{p.metadata.dribbling}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-base text-center">
                            <span className="font-semibold" style={{ color: getTierTextColorValue(p.metadata.defense) }}>{p.metadata.defense}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-base text-center">
                            <span className="font-semibold" style={{ color: getTierTextColorValue(p.metadata.physical) }}>{p.metadata.physical}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-base text-center">
                            <button
                              onClick={() => {
                                const newSquad = { ...squad } as Squad;
                                // remove by player id across positions
                                const entries = Object.entries(newSquad.players).filter(([_, v]) => v.player.id !== p.id);
                                newSquad.players = Object.fromEntries(entries);
                                addToHistory(newSquad);
                                setSquad(newSquad);
                              }}
                              className="ml-2 px-1.5 py-0.5 text-[10px] rounded border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer"
                              aria-label="Remove from squad"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            {/* Controls moved to header */}
          </div>
        </div>
        </div>

        {/* Drag Overlay */}
      <DragOverlay>
        {activePlayer ? (
          <div className="p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 shadow-lg">
            {/* Player Header */}
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white text-sm">
                  {activePlayer.metadata.firstName} {activePlayer.metadata.lastName}
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {activePlayer.metadata.positions.join(', ')}
                </p>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  {activePlayer.metadata.overall}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-500">OVR</div>
              </div>
            </div>

            {/* Player Stats */}
            <div className="grid grid-cols-3 gap-1 text-xs mb-2">
              <div className="text-center">
                <div className="font-medium text-gray-900 dark:text-white">
                  {activePlayer.metadata.pace}
                </div>
                <div className="text-gray-500 dark:text-gray-500">PAC</div>
              </div>
              <div className="text-center">
                <div className="font-medium text-gray-900 dark:text-white">
                  {activePlayer.metadata.shooting}
                </div>
                <div className="text-gray-500 dark:text-gray-500">SHO</div>
              </div>
              <div className="text-center">
                <div className="font-medium text-gray-900 dark:text-white">
                  {activePlayer.metadata.passing}
                </div>
                <div className="text-gray-500 dark:text-gray-500">PAS</div>
              </div>
              <div className="text-center">
                <div className="font-medium text-gray-900 dark:text-white">
                  {activePlayer.metadata.dribbling}
                </div>
                <div className="text-gray-500 dark:text-gray-500">DRI</div>
              </div>
              <div className="text-center">
                <div className="font-medium text-gray-900 dark:text-white">
                  {activePlayer.metadata.defense}
                </div>
                <div className="text-gray-500 dark:text-gray-500">DEF</div>
              </div>
              <div className="text-center">
                <div className="font-medium text-gray-900 dark:text-white">
                  {activePlayer.metadata.physical}
                </div>
                <div className="text-gray-500 dark:text-gray-500">PHY</div>
              </div>
            </div>

            {/* Position Ratings */}
            <div className="border-t border-gray-200 dark:border-gray-600 pt-2">
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Position Ratings:</div>
              <div className="flex flex-wrap gap-1">
                {activePlayer.metadata.positions.slice(0, 3).map((position) => {
                  const rating = calculatePositionRating(activePlayer, position as any);
                  return (
                    <div
                      key={position}
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        rating >= 80
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                          : rating >= 70
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : rating >= 60
                          ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {position} {rating}
                    </div>
                  );
                })}
                {activePlayer.metadata.positions.length > 3 && (
                  <div className="px-2 py-1 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                    +{activePlayer.metadata.positions.length - 3}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </DragOverlay>

      {/* Save Squad Modal removed (inline name + direct save) */}

      {/* Load Squad Modal */}
      {showLoadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 md:p-6 w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Load Saved Squad
            </h3>
            
            {isLoadingSquads ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600 dark:text-gray-400">Loading squads...</span>
              </div>
            ) : savedSquads.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 dark:text-gray-400">No saved squads found.</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                  Create and save a squad to see it here.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {savedSquads.map((savedSquad) => (
                  <div
                    key={savedSquad.id}
                    className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        {savedSquad.squad_name}
                      </h4>
                      <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400 mt-1">
                        <span>Players: {Object.keys(savedSquad.players).length}</span>
                        <span>Updated: {new Date(savedSquad.updated_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        onClick={() => handleLoadSquad(savedSquad)}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => handleDeleteSquad(savedSquad.id, savedSquad.squad_name)}
                        disabled={isDeleting === savedSquad.id}
                        className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
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
                className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-black rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      </div>
    </DndContext>
  );
}
