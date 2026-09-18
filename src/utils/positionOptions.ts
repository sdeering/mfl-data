import type { MFLPosition } from '../types/mflApi';

// Same positions and groupings as the squad builder's position filter
export const POSITIONS: Array<{ value: MFLPosition; label: string }> = [
  { value: 'GK', label: 'GK - Goalkeeper' },
  { value: 'CB', label: 'CB - Center Back' },
  { value: 'LB', label: 'LB - Left Back' },
  { value: 'RB', label: 'RB - Right Back' },
  { value: 'LWB', label: 'LWB - Left Wing Back' },
  { value: 'RWB', label: 'RWB - Right Wing Back' },
  { value: 'CDM', label: 'CDM - Defensive Midfielder' },
  { value: 'CM', label: 'CM - Central Midfielder' },
  { value: 'CAM', label: 'CAM - Attacking Midfielder' },
  { value: 'LM', label: 'LM - Left Midfielder' },
  { value: 'RM', label: 'RM - Right Midfielder' },
  { value: 'LW', label: 'LW - Left Winger' },
  { value: 'RW', label: 'RW - Right Winger' },
  { value: 'ST', label: 'ST - Striker' },
  { value: 'CF', label: 'CF - Center Forward' }
];

export const POSITION_GROUPS: Record<string, { label: string; positions: MFLPosition[] }> = {
  __GROUP_DEFENDERS: { label: 'Defenders (CB, LB, RB, LWB, RWB)', positions: ['CB', 'LB', 'RB', 'LWB', 'RWB'] },
  __GROUP_MIDFIELDERS: { label: 'Midfielders (CM, CDM, LM, RM)', positions: ['CM', 'CDM', 'LM', 'RM'] },
  __GROUP_FORWARDS: { label: 'Forwards (ST, CF, RW, LW, CAM)', positions: ['ST', 'CF', 'RW', 'LW', 'CAM'] }
};

export const ALL_POSITIONS = 'all';

/** The positions a filter value stands for - a position, a position group, or every position (null). */
export function getFilterPositions(filter: string): MFLPosition[] | null {
  if (filter === ALL_POSITIONS) return null;
  return POSITION_GROUPS[filter]?.positions ?? [filter as MFLPosition];
}
