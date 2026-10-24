import React from 'react';

// MFL counts retirementYears down to 1 in the player's final season (see isRetiredPlayer)
const RETIREMENT_LEVELS: Record<number, { className: string; label: string }> = {
  1: { className: 'text-red-500', label: 'Retiring at the end of this season' },
  2: { className: 'text-orange-500', label: 'Retiring in 2 seasons' },
  3: { className: 'text-yellow-400', label: 'Retiring in 3 seasons' },
};

interface RetirementIconProps {
  retirementYears?: number;
  className?: string;
  /** The season being played, so the label can say which one the player retires at the end of */
  currentSeason?: number | null;
}

/**
 * Calendar for a player whose retirement is announced: red in the final season,
 * orange two seasons out, yellow three. Renders nothing otherwise.
 */
export default function RetirementIcon({ retirementYears, className = 'w-4 h-4', currentSeason = null }: RetirementIconProps) {
  const level = retirementYears === undefined ? undefined : RETIREMENT_LEVELS[retirementYears];
  if (!level || retirementYears === undefined) return null;
  const label = currentSeason ? `${level.label} (end of season ${currentSeason + retirementYears - 1})` : level.label;

  return (
    <span role="img" aria-label={label} title={label} className={`inline-flex flex-shrink-0 ${level.className}`}>
      <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
      </svg>
    </span>
  );
}
