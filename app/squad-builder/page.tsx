'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '../../src/contexts/WalletContext';
import { supabaseDataService } from '../../src/services/supabaseDataService';
import { MFLPlayer } from '../../src/types/mflApi';
import { getSquads, saveSquad, deleteSquad, loadSquad, SavedSquad } from '../../src/services/squadService';
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
  if (primaryPosition === position) {
    return overall;
  }

  // Calculate rating based on position weights
  const weights = positionWeights[position];
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
  const positionRating = calculatePositionRating(player, position as any);
  const overall = player.metadata.overall;

  const isGoalkeeper = playerPositions.includes('GK');
  const isGoalkeeperPosition = position === 'GK';
  if (isGoalkeeper && !isGoalkeeperPosition) return { isValid: false, reason: 'Goalkeeper cannot play outfield' };
  if (!isGoalkeeper && isGoalkeeperPosition) return { isValid: false, reason: 'Outfield player cannot play goalkeeper' };

  if (playerPositions.includes(position as any)) return { isValid: true, reason: 'Natural position' };

  // Playable if within ±6 of overall
  if (Math.abs(positionRating - overall) <= 6) return { isValid: true, reason: `Within ±6 OVR (${positionRating})` };

  return { isValid: false, reason: `Position rating too far from overall (${positionRating} vs ${overall})` };
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
}

function DraggablePlayerCard({ player }: DraggablePlayerCardProps) {
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

  // Helper function to get stat color based on value
  const getStatColor = (value: number) => {
    if (value >= 90) return 'text-green-600 dark:text-green-400';
    if (value >= 80) return 'text-blue-600 dark:text-blue-400';
    if (value >= 70) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="p-2 md:p-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-grab active:cursor-grabbing transition-colors"
    >
      {/* Player Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="font-medium text-gray-900 dark:text-white text-sm">
            {player.metadata.firstName} {player.metadata.lastName}
          </h3>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {player.metadata.positions.join(', ')}
          </p>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-gray-900 dark:text-white">
            {player.metadata.overall}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-500">OVR</div>
        </div>
      </div>

      {/* Player Stats */}
      <div className="grid grid-cols-3 gap-1 text-xs mb-2">
        <div className="text-center">
          <div className={`font-medium ${getStatColor(player.metadata.pace)}`}>
            {player.metadata.pace}
          </div>
          <div className="text-gray-500 dark:text-gray-500">PAC</div>
        </div>
        <div className="text-center">
          <div className={`font-medium ${getStatColor(player.metadata.shooting)}`}>
            {player.metadata.shooting}
          </div>
          <div className="text-gray-500 dark:text-gray-500">SHO</div>
        </div>
        <div className="text-center">
          <div className={`font-medium ${getStatColor(player.metadata.passing)}`}>
            {player.metadata.passing}
          </div>
          <div className="text-gray-500 dark:text-gray-500">PAS</div>
        </div>
        <div className="text-center">
          <div className={`font-medium ${getStatColor(player.metadata.dribbling)}`}>
            {player.metadata.dribbling}
          </div>
          <div className="text-gray-500 dark:text-gray-500">DRI</div>
        </div>
        <div className="text-center">
          <div className={`font-medium ${getStatColor(player.metadata.defense)}`}>
            {player.metadata.defense}
          </div>
          <div className="text-gray-500 dark:text-gray-500">DEF</div>
        </div>
        <div className="text-center">
          <div className={`font-medium ${getStatColor(player.metadata.physical)}`}>
            {player.metadata.physical}
          </div>
          <div className="text-gray-500 dark:text-gray-500">PHY</div>
        </div>
      </div>

      {/* Position Ratings */}
      <div className="border-t border-gray-200 dark:border-gray-600 pt-2">
        <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Position Ratings:</div>
        <div className="flex flex-wrap gap-1">
          {player.metadata.positions.slice(0, 3).map((position) => {
            const rating = calculatePositionRating(player, position as any);
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
          {player.metadata.positions.length > 3 && (
            <div className="px-2 py-1 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
              +{player.metadata.positions.length - 3}
            </div>
          )}
        </div>
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
  // Attribute slider filters (minimum values)
  const [attrFilters, setAttrFilters] = useState({
    pace: 0,
    shooting: 0,
    passing: 0,
    dribbling: 0,
    defense: 0,
    physical: 0,
  });
  const [overallMin, setOverallMin] = useState(0);
  const [positionRatingMin, setPositionRatingMin] = useState(0);
  // Debounced copies for performance
  const [debouncedAttr, setDebouncedAttr] = useState(attrFilters);
  const [debouncedOverallMin, setDebouncedOverallMin] = useState(overallMin);
  const [debouncedPositionRatingMin, setDebouncedPositionRatingMin] = useState(positionRatingMin);
  const [sortBy, setSortBy] = useState<string>('overall');
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
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [squadName, setSquadName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
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
  // Validation UI removed per spec
  const [squadValidation] = useState({ isValid: true, warnings: [] as string[], errors: [] as string[], recommendations: [] as string[] });
  const [squadHistory, setSquadHistory] = useState<Squad[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(false);
  const [playersError, setPlayersError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // View mode: 'table' | 'field' (default to table, persist)
  const [viewMode, setViewMode] = useState<'table' | 'field'>(() => {
    if (typeof window === 'undefined') return 'table';
    try {
      const saved = window.localStorage.getItem('sb:viewMode');
      return saved === 'field' ? 'field' : 'table';
    } catch {
      return 'table';
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem('sb:viewMode', viewMode);
    } catch {}
  }, [viewMode]);

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
  const tableSortedPlayers = [...filteredPlayers].sort((a, b) => {
    const dir = tableSortDir === 'asc' ? 1 : -1;
    if (tableSortKey === 'name') {
      const nameA = `${a.metadata.firstName} ${a.metadata.lastName}`;
      const nameB = `${b.metadata.firstName} ${b.metadata.lastName}`;
      return nameA.localeCompare(nameB) * dir;
    }
    const map: any = {
      overall: 'overall', pace: 'pace', shooting: 'shooting', passing: 'passing',
      dribbling: 'dribbling', defense: 'defense', physical: 'physical'
    };
    const ka = (a.metadata as any)[map[tableSortKey]] ?? 0;
    const kb = (b.metadata as any)[map[tableSortKey]] ?? 0;
    return (ka - kb) * dir;
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
    const t = setTimeout(() => setDebouncedAttr(attrFilters), 200);
    return () => clearTimeout(t);
  }, [attrFilters]);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedOverallMin(overallMin), 200);
    return () => clearTimeout(t);
  }, [overallMin]);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedPositionRatingMin(positionRatingMin), 200);
    return () => clearTimeout(t);
  }, [positionRatingMin]);

  // Load saved squads
  useEffect(() => {
    const loadSavedSquads = async () => {
      if (!account) return;
      
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

  // Save squad functionality
  const handleSaveSquad = async () => {
    if (!account || !squadName.trim()) {
      setSaveError('Please enter a squad name');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      await saveSquad(
        account,
        squadName.trim(),
        selectedFormation.id,
        squad.players
      );
      
      setShowSaveModal(false);
      setSquadName('');
      // Refresh the saved squads list
      const squads = await getSquads(account);
      setSavedSquads(squads);
      
      success('Squad Saved!', `"${squadName.trim()}" has been saved successfully.`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save squad';
      setSaveError(errorMessage);
      showError('Save Failed', errorMessage);
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
      success('Squad Loaded!', `"${savedSquad.squad_name}" has been loaded successfully.`);
      console.log(`✅ Loaded squad: ${savedSquad.squad_name}`);
    } catch (error) {
      console.error('Error loading squad:', error);
      showError('Load Failed', 'Failed to load the squad. Please try again.');
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
      success('Squad Deleted', `"${squadName}" has been deleted successfully.`);
      console.log(`✅ Deleted squad: ${squadName}`);
    } catch (error) {
      console.error('Error deleting squad:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete the squad. Please try again.';
      showError('Delete Failed', errorMessage);
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
      info('Undo', 'Previous squad state restored');
    }
  };

  const redo = () => {
    if (historyIndex < squadHistory.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setSquad(squadHistory[newIndex]);
      info('Redo', 'Next squad state restored');
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

    // Attribute slider minimum filters (debounced)
    filtered = filtered.filter(player => (
      player.metadata.pace >= debouncedAttr.pace &&
      player.metadata.shooting >= debouncedAttr.shooting &&
      player.metadata.passing >= debouncedAttr.passing &&
      player.metadata.dribbling >= debouncedAttr.dribbling &&
      player.metadata.defense >= debouncedAttr.defense &&
      player.metadata.physical >= debouncedAttr.physical
    ));

    // Overall rating minimum (debounced)
    filtered = filtered.filter(player => player.metadata.overall >= debouncedOverallMin);

    // Position rating minimum (debounced) – use a reasonable default position: best fit among player's positions
    filtered = filtered.filter(player => {
      const best = player.metadata.positions
        .map(pos => calculatePositionRating(player, pos as any))
        .reduce((a, b) => Math.max(a, b), 0);
      return best >= debouncedPositionRatingMin;
    });

    // Sort players
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'overall':
          return b.metadata.overall - a.metadata.overall;
        case 'name':
          const nameA = `${a.metadata.firstName} ${a.metadata.lastName}`;
          const nameB = `${b.metadata.firstName} ${b.metadata.lastName}`;
          return nameA.localeCompare(nameB);
        case 'age':
          return a.metadata.age - b.metadata.age;
        default:
          return 0;
      }
    });

    setFilteredPlayers(filtered);
  }, [searchTerm, filterPosition, sortBy, players, debouncedAttr, debouncedOverallMin, debouncedPositionRatingMin]);

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
          <div className="inline-flex items-center rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
              className={`px-3 py-1.5 text-sm ${viewMode === 'table' ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'}`}
              onClick={() => setViewMode('table')}
              title="Table view"
            >
              Table
            </button>
            <button
              className={`px-3 py-1.5 text-sm ${viewMode === 'field' ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'}`}
              onClick={() => setViewMode('field')}
              title="Field view"
            >
              Field
            </button>
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

        {!isInitializing && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-6">        {/* Player Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Your Players ({filteredPlayers.length})
            </h2>
            
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
            <div className="space-y-3 mb-4">
              {/* Position Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Position
                </label>
                <select
                  value={filterPosition}
                  onChange={(e) => setFilterPosition(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Positions</option>
                  <option value="GK">Goalkeeper</option>
                  <option value="CB">Center Back</option>
                  <option value="LB">Left Back</option>
                  <option value="RB">Right Back</option>
                  <option value="CDM">Defensive Midfielder</option>
                  <option value="CM">Central Midfielder</option>
                  <option value="CAM">Attacking Midfielder</option>
                  <option value="LM">Left Midfielder</option>
                  <option value="RM">Right Midfielder</option>
                  <option value="LW">Left Winger</option>
                  <option value="RW">Right Winger</option>
                  <option value="ST">Striker</option>
                  <option value="CF">Center Forward</option>
                </select>
              </div>

              {/* Attribute Sliders */}
              <div className="grid grid-cols-2 gap-3">
                {([
                  ['pace','PAC'],['shooting','SHO'],['passing','PAS'],['dribbling','DRI'],['defense','DEF'],['physical','PHY']
                ] as Array<[keyof typeof attrFilters,string]>).map(([key,label]) => (
                  <div key={key} className="col-span-1">
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {label} ≥ {attrFilters[key]}
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={99}
                      step={1}
                      value={attrFilters[key]}
                      onChange={(e) => setAttrFilters(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                      className="w-full"
                    />
                  </div>
                ))}
              </div>

              {/* Rating Sliders */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Overall ≥ {overallMin}
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={99}
                    step={1}
                    value={overallMin}
                    onChange={(e) => setOverallMin(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Position rating ≥ {positionRatingMin}
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={99}
                    step={1}
                    value={positionRatingMin}
                    onChange={(e) => setPositionRatingMin(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Sort By */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Sort By
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="overall">Overall Rating</option>
                  <option value="name">Name</option>
                  <option value="age">Age</option>
                </select>
              </div>
            </div>

            {/* Player List */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              <SortableContext items={filteredPlayers.map(p => p.id.toString())} strategy={verticalListSortingStrategy}>
                {filteredPlayers.map((player) => (
                  <DraggablePlayerCard key={player.id} player={player} />
                ))}
              </SortableContext>
            </div>
          </div>
        </div>

        {/* Main Squad Builder Area */}
        <div className="lg:col-span-3">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            {/* Formation Selector with Analysis (hidden in table view) */}
            {viewMode === 'field' && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Formation Analysis
              </h2>
              
              {/* Current Formation */}
              <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-md font-medium text-blue-900 dark:text-blue-200">
                    Current: {selectedFormation.name}
                  </h3>
                  <div className="flex items-center gap-2">
                    <div className={`px-2 py-1 rounded text-xs font-medium ${
                      squadStats.formationEffectiveness >= 80 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                      squadStats.formationEffectiveness >= 60 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                      'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                    }`}>
                      {squadStats.formationEffectiveness}% Effective
                    </div>
                  </div>
                </div>
                
                {/* Formation Analysis */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-blue-700 dark:text-blue-300 font-medium">Strengths:</span>
                    <div className="text-blue-600 dark:text-blue-400 mt-1">
                      {(() => {
                        const strengths = [];
                        if (squadStats.stats.defense >= 75) strengths.push('Strong Defense');
                        if (squadStats.stats.passing >= 75) strengths.push('Good Passing');
                        if (squadStats.stats.pace >= 75) strengths.push('High Pace');
                        if (squadStats.stats.shooting >= 75) strengths.push('Clinical Finishing');
                        return strengths.length > 0 ? strengths.join(', ') : 'Balanced approach';
                      })()}
                    </div>
                  </div>
                  <div>
                    <span className="text-blue-700 dark:text-blue-300 font-medium">Weaknesses:</span>
                    <div className="text-blue-600 dark:text-blue-400 mt-1">
                      {(() => {
                        const weaknesses = [];
                        if (squadStats.stats.defense < 60) weaknesses.push('Weak Defense');
                        if (squadStats.stats.passing < 60) weaknesses.push('Poor Passing');
                        if (squadStats.stats.pace < 60) weaknesses.push('Slow Pace');
                        if (squadStats.stats.shooting < 60) weaknesses.push('Low Finishing');
                        return weaknesses.length > 0 ? weaknesses.join(', ') : 'No major weaknesses';
                      })()}
                    </div>
                  </div>
                  <div>
                    <span className="text-blue-700 dark:text-blue-300 font-medium">Style:</span>
                    <div className="text-blue-600 dark:text-blue-400 mt-1">
                      {(() => {
                        const { stats } = squadStats;
                        if (stats.shooting > 70 && stats.pace > 70) return 'Attacking';
                        if (stats.defense > 70 && stats.physical > 70) return 'Defensive';
                        if (stats.passing > 70 && stats.dribbling > 70) return 'Possession';
                        return 'Balanced';
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Formation Options */}
              <div className="mb-4">
                <h3 className="text-md font-medium text-gray-900 dark:text-white mb-3">Available Formations</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {FORMATIONS.map((formation) => {
                    // Calculate effectiveness for each formation
                    const effectiveness = calculateFormationEffectiveness(squad, formation, players);
                    return (
                      <button
                        key={formation.id}
                        onClick={() => handleFormationChange(formation)}
                        className={`p-3 rounded-lg border transition-all hover:scale-105 ${
                          selectedFormation.id === formation.id
                            ? 'bg-blue-600 text-white border-blue-600 shadow-lg'
                            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                        }`}
                      >
                        <div className="text-sm font-medium mb-1">{formation.name}</div>
                        <div className={`text-xs ${
                          selectedFormation.id === formation.id ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          {effectiveness}% effective
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1 mt-2">
                          <div 
                            className={`h-1 rounded-full transition-all duration-300 ${
                              selectedFormation.id === formation.id ? 'bg-blue-200' :
                              effectiveness >= 80 ? 'bg-green-500' :
                              effectiveness >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${effectiveness}%` }}
                          ></div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Recommendations removed per spec */}
            </div>
            )}

            {/* Enhanced Squad Statistics (always shown) */}
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Squad Statistics
              </h3>
              
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
                {/* Formation Fit retained */}
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mb-1">
                    {squadStats.formationEffectiveness}%
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Formation Fit</div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${
                        squadStats.formationEffectiveness >= 80 ? 'bg-purple-600' :
                        squadStats.formationEffectiveness >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${squadStats.formationEffectiveness}%` }}
                    ></div>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400 mb-1">
                    {squadStats.totalPlayers}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Players (no max)</div>
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

            {/* Squad Validation removed per spec */}

            {/* Formation Display (hidden in table view) */}
            {viewMode === 'field' && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {selectedFormation.name} Formation
              </h2>
              <div className="relative bg-green-100 dark:bg-green-900/20 rounded-lg p-8 min-h-96">
                {/* Field lines */}
                <div className="absolute inset-4 border-2 border-green-600 dark:border-green-400 rounded-lg"></div>
                <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-green-600 dark:bg-green-400"></div>
                <div className="absolute top-1/4 left-4 right-4 h-0.5 bg-green-600 dark:bg-green-400"></div>
                <div className="absolute bottom-1/4 left-4 right-4 h-0.5 bg-green-600 dark:bg-green-400"></div>
                
                {/* Position slots */}
                <SortableContext items={selectedFormation.positions}>
                  {selectedFormation.positions.map((position, index) => (
                    <DroppablePositionSlot
                      key={`${position}-${index}`}
                      position={position}
                      index={index}
                      player={squad.players[position] || null}
                      formation={selectedFormation}
                      activePlayer={activePlayer}
                      validatePlayerPosition={validatePlayerPosition}
                    />
                  ))}
                </SortableContext>
              </div>
            </div>
            )}

            {/* Table View: reuse club page styles */}
            {viewMode === 'table' && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none" onClick={() => handleTableSort('name')}>Player</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none" onClick={() => handleTableSort('overall')}>Overall</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer" onClick={() => handleTableSort('pace')}>PAC</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer" onClick={() => handleTableSort('shooting')}>SHO</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer" onClick={() => handleTableSort('passing')}>PAS</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer" onClick={() => handleTableSort('dribbling')}>DRI</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer" onClick={() => handleTableSort('defense')}>DEF</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer" onClick={() => handleTableSort('physical')}>PHY</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {tableSortedPlayers.map((p) => (
                        <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {p.metadata.firstName} {p.metadata.lastName}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-center text-gray-900 dark:text-white">{p.metadata.overall}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-center text-gray-700 dark:text-gray-300">{p.metadata.pace}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-center text-gray-700 dark:text-gray-300">{p.metadata.shooting}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-center text-gray-700 dark:text-gray-300">{p.metadata.passing}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-center text-gray-700 dark:text-gray-300">{p.metadata.dribbling}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-center text-gray-700 dark:text-gray-300">{p.metadata.defense}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-center text-gray-700 dark:text-gray-300">{p.metadata.physical}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Squad Actions */}
            <div className="flex flex-wrap gap-2 md:gap-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={undo}
                  disabled={!canUndo}
                  className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Undo last action"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                </button>
                <button
                  onClick={redo}
                  disabled={!canRedo}
                  className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Redo last action"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
                  </svg>
                </button>
              </div>
              <button
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                onClick={() => setShowSaveModal(true)}
              >
                Save Squad
              </button>
              <div className="relative">
                <select
                  onChange={async (e) => {
                    const id = e.target.value;
                    if (!id) return;
                    const ss = savedSquads.find(s => s.id === id);
                    if (ss) await handleLoadSquad(ss);
                    e.currentTarget.selectedIndex = 0;
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  defaultValue=""
                >
                  <option value="" disabled>Load Squad...</option>
                  {savedSquads.map(s => (
                    <option key={s.id} value={s.id}>{s.squad_name}</option>
                  ))}
                </select>
              </div>
              <button
                className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                onClick={() => {
                  const newSquad = { ...squad, players: {} };
                  addToHistory(newSquad);
                  setSquad(newSquad);
                  info('Squad Cleared', 'All players have been removed from the squad.');
                }}
              >
                Clear Squad
              </button>
            </div>
          </div>
        </div>
        </div>
        )}

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

      {/* Save Squad Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 md:p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Save Squad
            </h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Squad Name
              </label>
              <input
                type="text"
                value={squadName}
                onChange={(e) => setSquadName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Enter squad name..."
                maxLength={50}
              />
            </div>

            {saveError && (
              <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg">
                <p className="text-sm text-red-700 dark:text-red-300">{saveError}</p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                onClick={handleSaveSquad}
                disabled={isSaving || !squadName.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {isSaving ? 'Saving...' : 'Save Squad'}
              </button>
              <button
                onClick={() => {
                  setShowSaveModal(false);
                  setSquadName('');
                  setSaveError(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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
                        <span>Formation: {savedSquad.formation_id}</span>
                        <span>Players: {Object.keys(savedSquad.players).length}</span>
                        <span>
                          Updated: {new Date(savedSquad.updated_at).toLocaleDateString()}
                        </span>
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
                className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
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
