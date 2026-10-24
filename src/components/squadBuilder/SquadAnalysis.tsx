import React, { useState } from 'react';
import type { MFLPlayer } from '../../types/mflApi';
import type { MFLPosition } from '../../types/positionOvr';
import { ALL_POSITIONS, positionFit } from '../../utils/squadLineups';
import { getTierColors } from '../../utils/tierColors';
import RetirementIcon from '../RetirementIcon';
import { KpiTile, Panel, TierBadge, TierText, btnPill } from '../ui';
import { STAT_KEYS, STAT_LABELS, fullName } from './shared';

export type SquadGroup = 'gk' | 'defense' | 'midfield' | 'attack';

const GROUP_OF: Record<string, SquadGroup> = {
  GK: 'gk',
  CB: 'defense', LB: 'defense', RB: 'defense', LWB: 'defense', RWB: 'defense',
  CDM: 'midfield', CM: 'midfield', CAM: 'midfield', LM: 'midfield', RM: 'midfield',
  LW: 'attack', RW: 'attack', ST: 'attack', CF: 'attack',
};
const GROUP_LABELS: [SquadGroup, string][] = [['gk', 'Goalkeepers'], ['defense', 'Defense'], ['midfield', 'Midfield'], ['attack', 'Attack']];

/** Every group a player can play in, by their positions. */
export const playerGroups = (player: MFLPlayer): SquadGroup[] => [...new Set(player.metadata.positions.map(position => GROUP_OF[position]).filter(Boolean))];

// The positions a squad needs someone for, and how close to their overall a player must rate there to count
const COVERED_POSITIONS: MFLPosition[] = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST'];
const COVERAGE_MARGIN = 5;
const canCover = (player: MFLPlayer, position: MFLPosition) => positionFit(player, position).rating >= player.metadata.overall - COVERAGE_MARGIN;

const average = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);

const smallPillClass =
  'inline-flex items-center justify-center h-8 px-3 rounded-full border border-line-2 bg-panel text-fg-2 text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors hover:border-line-hover';

interface SquadAnalysisProps {
  /** The lineup's players, starters and substitutes */
  players: MFLPlayer[];
  group: SquadGroup | null;
  onGroup: (group: SquadGroup | null) => void;
}

/** Averages, balance, ages and position coverage of a lineup, above its statistics table. */
export default function SquadAnalysis({ players, group, onGroup }: SquadAnalysisProps) {
  const [showCoverage, setShowCoverage] = useState(false);
  const overalls = players.map(player => player.metadata.overall).sort((a, b) => b - a);
  const outfield = players.filter(player => !player.metadata.positions.includes('GK'));
  const statAverages = STAT_KEYS.map(key => Math.round(average(outfield.map(player => player.metadata[key] || 0))));

  const counts: Record<SquadGroup, number> = { gk: 0, defense: 0, midfield: 0, attack: 0 };
  players.forEach(player => playerGroups(player).forEach(g => counts[g]++));

  const ages = players.map(player => player.metadata.age);

  // Main: someone for each position. Backup: two for each, without counting a player for more than one position.
  const coveredBy = Object.fromEntries(COVERED_POSITIONS.map(position => [position, players.filter(player => canCover(player, position))]));
  const mainCount = COVERED_POSITIONS.filter(position => coveredBy[position].length > 0).length;
  const used = new Set<number>();
  const backupCount = COVERED_POSITIONS.filter(position => {
    const pair = coveredBy[position].filter(player => !used.has(player.id)).slice(0, 2);
    pair.forEach(player => used.add(player.id));
    return pair.length === 2;
  }).length;
  const mainPercent = Math.round((mainCount / COVERED_POSITIONS.length) * 100);
  const backupPercent = Math.round((backupCount / COVERED_POSITIONS.length) * 100);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile label="Avg Overall" value={average(overalls).toFixed(2)} accent />
        <KpiTile label="AVG (TOP11)" value={average(overalls.slice(0, 11)).toFixed(2)} />
        <KpiTile label="AVG (TOP16)" value={average(overalls.slice(0, 16)).toFixed(2)} />
        <KpiTile label="Players" value={players.length} />
      </div>

      <Panel className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 p-3.5">
        {STAT_LABELS.map((label, index) => (
          <div key={label} className="flex flex-col items-center gap-2 px-2 py-3 rounded-2xl border border-line bg-inset">
            <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-2 whitespace-nowrap">AVG {label}</span>
            <TierBadge value={statAverages[index]} />
            <div className="w-full h-1 rounded-full bg-line-2 overflow-hidden">
              <div className="h-1 rounded-full transition-all duration-300" style={{ width: `${statAverages[index]}%`, background: getTierColors(statAverages[index]).bg }} />
            </div>
          </div>
        ))}
      </Panel>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Panel className="flex flex-col gap-3 p-[18px]">
          <div className="flex items-center justify-between gap-2 min-h-8">
            <h4 className="m-0 font-display text-lg font-bold text-fg">Squad Balance</h4>
            {group && (
              <button type="button" className={smallPillClass} onClick={() => onGroup(null)} title="Show every player in the table">
                Reset
              </button>
            )}
          </div>
          <div className="flex flex-col gap-1">
            {GROUP_LABELS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={group === key}
                onClick={() => onGroup(key)}
                className={`w-full flex justify-between items-center px-3 py-2 rounded-xl text-left text-sm cursor-pointer transition-colors ${
                  group === key ? 'bg-accent/12 text-accent-ink' : 'text-muted hover:bg-row-hover'
                }`}
              >
                <span className="font-medium">{label}</span>
                <span className={`font-display font-bold ${group === key ? '' : 'text-fg'}`}>{counts[key]}</span>
              </button>
            ))}
          </div>
        </Panel>

        <Panel className="flex flex-col gap-3 p-[18px]">
          <div className="flex items-center min-h-8">
            <h4 className="m-0 font-display text-lg font-bold text-fg">Age Analysis</h4>
          </div>
          {ages.length === 0 ? (
            <div className="text-sm text-muted">No players</div>
          ) : (
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="font-medium text-muted">Average</span>
                <span className="font-display font-bold text-fg">{Math.round(average(ages))}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium text-muted">Range</span>
                <span className="font-display font-bold text-fg">
                  {Math.min(...ages)}-{Math.max(...ages)}
                </span>
              </div>
            </div>
          )}
        </Panel>

        <Panel className="flex flex-col gap-3 p-[18px]">
          <div className="flex items-center min-h-8">
            <h4 className="m-0 font-display text-lg font-bold text-fg">Position Coverage</h4>
          </div>
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="font-medium text-muted">Main Coverage</span>
              <span className="font-display font-bold text-fg">{mainPercent}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-line-2 overflow-hidden">
              <div className="h-2 rounded-full bg-accent transition-all duration-300" style={{ width: `${mainPercent}%` }} />
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="font-medium text-muted">Backup Coverage</span>
              <span className="font-display font-bold text-fg">{backupPercent}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-line-2 overflow-hidden">
              <div className="h-2 rounded-full bg-[#6eb4ff] transition-all duration-300" style={{ width: `${backupPercent}%` }} />
            </div>
            <div className="mt-2 flex justify-end">
              <button type="button" className={smallPillClass} onClick={() => setShowCoverage(true)}>
                Show all positions coverage
              </button>
            </div>
          </div>
        </Panel>
      </div>

      {showCoverage && <CoverageModal players={players} onClose={() => setShowCoverage(false)} />}
    </div>
  );
}

/** For every position, the players who rate within a few points of their overall there, best first. */
function CoverageModal({ players, onClose }: { players: MFLPlayer[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div
        className="w-full max-w-4xl max-h-[80vh] overflow-y-auto p-5 md:p-6 rounded-2xl border border-line-2 bg-panel shadow-[0_20px_50px_rgba(0,0,0,.45)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="coverage-title"
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 id="coverage-title" className="m-0 font-display text-xl font-bold text-fg">
            All Positions Coverage
          </h3>
          <button type="button" className={btnPill} onClick={onClose}>
            Close
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {ALL_POSITIONS.map(position => {
            const covering = players
              .filter(player => canCover(player, position))
              .map(player => ({ player, rating: positionFit(player, position).rating }))
              .sort((a, b) => b.rating - a.rating);
            return (
              <div key={position} className="flex flex-col gap-2 p-3.5 rounded-2xl border border-line bg-inset">
                <h4 className="m-0 font-display text-base font-bold text-fg">{position}</h4>
                <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
                  {covering.length === 0 ? (
                    <div className="text-xs text-muted">No players</div>
                  ) : (
                    covering.map(({ player, rating }) => (
                      <div key={player.id} className="flex items-center justify-between gap-2 text-[13px]">
                        <span className="flex items-center gap-1 min-w-0 font-medium text-fg-2">
                          <span className="truncate">{fullName(player)}</span>
                          <RetirementIcon retirementYears={player.metadata.retirementYears} className="w-3 h-3" />
                        </span>
                        <TierText value={rating} />
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
