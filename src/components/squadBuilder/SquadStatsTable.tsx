import React from 'react';
import Link from 'next/link';
import type { MFLPlayer } from '../../types/mflApi';
import type { MFLPosition } from '../../types/positionOvr';
import { ALL_POSITIONS, FORMATIONS, Lineup, positionFit } from '../../utils/squadLineups';
import { getTierColors } from '../../utils/tierColors';
import RetirementIcon from '../RetirementIcon';
import { Panel, tableClass, tdClass, thClass, theadRowClass, rowClass } from '../ui';
import { RatingText, STAT_KEYS, STAT_LABELS, fullName } from './shared';
import { SquadGroup, playerGroups } from './SquadAnalysis';

/** The lineup's players in order, each with their role: a position in the XI, or SUB. */
export function lineupRows(lineup: Lineup, playersById: Map<number, MFLPlayer>): { role: string; player: MFLPlayer }[] {
  const slots = FORMATIONS[lineup.formation];
  const rows = lineup.xi.map((id, index) => ({ role: slots[index][0] as string, id }));
  lineup.bench.forEach(id => rows.push({ role: 'SUB', id }));
  return rows.flatMap(({ role, id }) => {
    const player = id === null ? undefined : playersById.get(id);
    return player ? [{ role, player }] : [];
  });
}

const csvCell = (value: unknown) => {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** The lineup as a CSV Excel opens, with each player's rating at every position. */
export function lineupCsv(lineup: Lineup, playersById: Map<number, MFLPlayer>): string {
  const headers = [
    'Lineup', 'Formation', 'Role', 'Player ID', 'First Name', 'Last Name', 'Full Name', 'Overall', 'Role Rating', 'Age', 'Positions',
    'Preferred Foot', 'Nationalities', 'Height', 'PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY', 'GK', ...ALL_POSITIONS.map(position => `Rating ${position}`),
  ];
  const lines = lineupRows(lineup, playersById).map(({ role, player }) => {
    const m = player.metadata;
    return [
      lineup.name, lineup.formation, role, player.id, m.firstName, m.lastName, fullName(player), m.overall,
      role === 'SUB' ? '' : positionFit(player, role as MFLPosition).rating, m.age, m.positions.join(' '),
      m.preferredFoot, (m.nationalities || []).join(' '), m.height, m.pace, m.shooting, m.passing, m.dribbling, m.defense, m.physical, m.goalkeeping,
      ...ALL_POSITIONS.map(position => positionFit(player, position).rating),
    ];
  });
  // The byte order mark tells Excel the file is UTF-8, so accented names come out right
  return '﻿' + [headers, ...lines].map(line => line.map(csvCell).join(',')).join('\n');
}

interface SquadStatsTableProps {
  lineup: Lineup;
  playersById: Map<number, MFLPlayer>;
  /** Only the players who can play in this group, picked in Squad Balance */
  group: SquadGroup | null;
  season: number | null;
  onExport: () => void;
}

export default function SquadStatsTable({ lineup, playersById, group, season, onExport }: SquadStatsTableProps) {
  const allRows = lineupRows(lineup, playersById);
  const rows = group ? allRows.filter(({ player }) => playerGroups(player).includes(group)) : allRows;
  return (
    <Panel className="min-w-0 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-[18px]">
        <h2 className="m-0 font-display text-[22px] font-extrabold text-fg">
          Squad statistics · {lineup.name}
          {group && (
            <span className="font-semibold text-muted">
              {' '}
              ({rows.length} of {allRows.length})
            </span>
          )}
        </h2>
        <button
          type="button"
          onClick={onExport}
          disabled={allRows.length === 0}
          className="inline-flex items-center justify-center h-[38px] px-4 rounded-full border border-pos-line bg-btn-pos text-pos-ink text-[13px] font-bold whitespace-nowrap cursor-pointer transition-colors hover:border-pos-ink disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Export squad to Excel (CSV)
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className={`${tableClass} min-w-[860px]`}>
          <thead>
            <tr className={theadRowClass}>
              <th className={`${thClass} !pl-5`}>Role</th>
              <th className={thClass}>Player</th>
              <th className={thClass}>OVR</th>
              <th className={thClass}>Age</th>
              <th className={thClass}>Positions</th>
              {STAT_LABELS.map(label => (
                <th key={label} className={thClass}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={11} className="px-5 py-10 text-center text-sm font-medium text-muted">
                  {group ? 'No players in this group.' : 'No players in this lineup yet.'}
                </td>
              </tr>
            )}
            {rows.map(({ role, player }) => {
              const m = player.metadata;
              return (
                <tr key={`${role}-${player.id}`} className={rowClass}>
                  <td className={`${tdClass} !pl-5 text-[11px] font-extrabold text-muted`}>{role}</td>
                  <td className={tdClass}>
                    <span className="flex items-center gap-1.5">
                      <Link href={`/players/${player.id}`} className="text-sm font-bold text-fg hover:text-accent-ink">
                        {fullName(player)}
                      </Link>
                      <RetirementIcon retirementYears={m.retirementYears} currentSeason={season} className="w-3 h-3" />
                    </span>
                  </td>
                  <td className={tdClass}>
                    <RatingText value={m.overall} color={getTierColors(m.overall).text} className="text-base font-extrabold" />
                  </td>
                  <td className={`${tdClass} text-sm font-semibold text-fg-3`}>{m.age}</td>
                  <td className={`${tdClass} text-[13px] font-semibold text-fg-3`}>
                    <span className="flex gap-2">
                      {m.positions.slice(0, 3).map(position => {
                        const { rating } = positionFit(player, position as MFLPosition);
                        return (
                          <span key={position}>
                            {position} <b style={{ color: getTierColors(rating).text }}>{rating}</b>
                          </span>
                        );
                      })}
                    </span>
                  </td>
                  {STAT_KEYS.map(key => (
                    <td key={key} className={tdClass}>
                      <RatingText value={m[key]} color={getTierColors(m[key]).text} className="text-sm" />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
