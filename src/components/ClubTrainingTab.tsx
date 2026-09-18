'use client';

import React, { useState, useEffect } from 'react';

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
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300';
    case 'STANDARD':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
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
      <div className="text-center py-12">
        <div className="text-gray-400 dark:text-gray-500 text-lg">Loading training info...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-600 dark:text-gray-400">{error}</div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Coaches available to hire ({coaches.length})
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Prices are what this club would pay: a revenue share or an upfront $MFL fee.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              {['Coach', 'Tier', 'Focus', 'Primary focus bonus', 'Dual focus bonus', 'All attributes', 'Revenue share', 'Upfront'].map(heading => (
                <th
                  key={heading}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {coaches.map(coach => (
              <tr key={coach.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">
                  {coach.name}
                </td>
                <td className="px-4 py-3 text-sm whitespace-nowrap">
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${getTierBadge(coach.tier)}`}>
                    {formatAttribute(coach.tier)}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  {[coach.primaryAttribute, coach.secondaryAttribute].filter(Boolean).map(formatAttribute).join(' / ')}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  {formatBonus(coach.xpBonusByStatPrimary) || '—'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  {formatBonus(coach.xpBonusByStatDual) || '—'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  {coach.xpBonusGlobal > 0 ? `+${coach.xpBonusGlobal}%` : '—'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  {coach.pricing ? `${coach.pricing.revenueShare / 100}%` : '—'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  {coach.pricing ? `${coach.pricing.upfrontMflPrice} $MFL` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
