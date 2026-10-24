'use client';

import React, { useState, useEffect } from 'react';
import { Panel, tableClass, theadRowClass, thClass, rowClass, tdClass } from './ui';

interface Coach {
  id: number;
  name: string;
  tier: string;
  primaryAttribute: string;
  secondaryAttribute: string | null;
  xpBonusByStatPrimary: Record<string, number>;
  xpBonusByStatDual: Record<string, number>;
  xpBonusGlobal: number;
  contractCostPct: number;
  pricing?: {
    revenueShare: number;
    upfrontMflPrice: number;
  };
}

interface ClubTrainingTabProps {
  clubId: string;
}

const formatAttribute = (attr: string | null) =>
  attr ? attr.charAt(0) + attr.slice(1).toLowerCase() : '';

// e.g. "+25% Shooting" or "+15% Shooting, +15% Dribbling"
const formatBonus = (bonus: Record<string, number>) =>
  Object.entries(bonus)
    .filter(([, value]) => value > 0)
    .map(([stat, value]) => `+${value}% ${formatAttribute(stat.toUpperCase())}`)
    .join(', ');

const getTierBadge = (tier: string) => {
  switch (tier) {
    case 'ELITE':
      return 'border-violet-line bg-violet-bg text-violet-ink';
    case 'STANDARD':
      return 'border-chip-line bg-chip text-rt-blue';
    default:
      return 'border-chip-line bg-chip text-fg-3';
  }
};

export default function ClubTrainingTab({ clubId }: ClubTrainingTabProps) {
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchCoaches = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch(`/api/clubs/${clubId}/coaches`);
        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || 'Failed to load coaches');
        }
        if (!cancelled) setCoaches(result.data);
      } catch (err) {
        console.error('Error fetching coaches:', err);
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load coaches');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchCoaches();
    return () => {
      cancelled = true;
    };
  }, [clubId]);

  if (isLoading) {
    return (
      <Panel className="flex items-center justify-center gap-3 px-6 py-16">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent"></div>
        <span className="text-[15px] font-medium text-muted">Loading training info...</span>
      </Panel>
    );
  }

  if (error) {
    return (
      <Panel className="px-6 py-16 text-center">
        <p className="m-0 text-[15px] font-medium text-muted">{error}</p>
      </Panel>
    );
  }

  return (
    <Panel className="overflow-hidden">
      <div className="flex flex-col gap-1 px-[18px] py-4">
        <h2 className="m-0 font-display text-xl font-bold text-fg">
          Coaches available to hire <span className="font-semibold text-muted">({coaches.length})</span>
        </h2>
        <p className="m-0 text-sm font-medium text-muted">
          Prices are what this club would pay: a revenue share or an upfront $MFL fee.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className={tableClass}>
          <thead>
            <tr className={theadRowClass}>
              {['Coach', 'Tier', 'Focus', 'Primary focus bonus', 'Dual focus bonus', 'All attributes', 'Revenue share', 'Upfront'].map(heading => (
                <th key={heading} className={thClass}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {coaches.map(coach => (
              <tr key={coach.id} className={rowClass}>
                <td className={`${tdClass} text-[15px] font-bold text-fg`}>
                  {coach.name}
                </td>
                <td className={tdClass}>
                  <span className={`inline-flex items-center h-6 px-2.5 rounded-full border text-[11px] font-bold ${getTierBadge(coach.tier)}`}>
                    {formatAttribute(coach.tier)}
                  </span>
                </td>
                <td className={`${tdClass} text-sm font-semibold text-fg-2`}>
                  {[coach.primaryAttribute, coach.secondaryAttribute].filter(Boolean).map(formatAttribute).join(' / ')}
                </td>
                <td className={`${tdClass} text-sm text-fg-3`}>
                  {formatBonus(coach.xpBonusByStatPrimary) || '—'}
                </td>
                <td className={`${tdClass} text-sm text-fg-3`}>
                  {formatBonus(coach.xpBonusByStatDual) || '—'}
                </td>
                <td className={`${tdClass} text-sm text-fg-3`}>
                  {coach.xpBonusGlobal > 0 ? `+${coach.xpBonusGlobal}%` : '—'}
                </td>
                <td className={`${tdClass} text-sm font-semibold text-fg-2`}>
                  {coach.pricing ? `${coach.pricing.revenueShare / 100}%` : '—'}
                </td>
                <td className={`${tdClass} text-sm font-semibold ${coach.pricing ? 'text-price' : 'text-fg-2'}`}>
                  {coach.pricing ? `${coach.pricing.upfrontMflPrice} $MFL` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
