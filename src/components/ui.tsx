import React from 'react';
import { getTierColors } from '../utils/tierColors';

/*
 * Building blocks of the redesign. Colours come from the design tokens in app/globals.css
 * (bg-panel, border-line, text-muted, ...), so they follow the light/dark theme.
 */

// Buttons and fields
export const btnPrimary =
  'inline-flex items-center justify-center gap-2 h-10 px-4 rounded-full bg-accent text-accent-fg text-[13px] font-bold whitespace-nowrap cursor-pointer transition-colors hover:bg-[#d8fb74] disabled:opacity-50 disabled:cursor-not-allowed';
export const btnSecondary =
  'inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl border border-line-2 bg-btn text-fg text-[13px] font-semibold whitespace-nowrap cursor-pointer transition-colors hover:border-line-hover disabled:opacity-50 disabled:cursor-not-allowed';
export const btnPill =
  'inline-flex items-center justify-center gap-2 h-10 px-4 rounded-full border border-line-2 bg-panel text-fg-2 text-[13px] font-semibold whitespace-nowrap cursor-pointer transition-colors hover:border-line-hover disabled:opacity-50 disabled:cursor-not-allowed';
export const btnDanger =
  'inline-flex items-center justify-center gap-2 h-10 px-4 rounded-full border border-red-500/45 bg-red-500/12 text-danger-ink text-[13px] font-bold whitespace-nowrap cursor-pointer transition-colors hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed';
export const fieldClass =
  'h-10 px-3.5 rounded-xl border border-line-3 bg-field text-strong text-sm font-medium outline-none focus:border-line-hover';
export const selectClass =
  'appearance-none h-10 pl-3.5 pr-9 rounded-xl border border-line-2 bg-field text-fg text-sm font-semibold cursor-pointer outline-none focus:border-line-hover';
// For a row of many filters
export const selectCompactClass =
  'appearance-none h-10 pl-2.5 pr-6 rounded-xl border border-line-2 bg-field text-fg text-[13px] font-semibold cursor-pointer outline-none focus:border-line-hover';
export const labelClass = 'flex flex-col gap-1.5 text-xs font-semibold text-muted';
export const linkClass = 'text-accent-ink hover:text-accent-hover';

// Tables
export const tableClass = 'min-w-full border-collapse';
export const theadRowClass = 'bg-thead border-y border-line';
export const thClass = 'px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.1em] text-muted-2 whitespace-nowrap';
export const sortableThClass = `${thClass} cursor-pointer select-none hover:text-fg-2`;
export const rowClass = 'border-b border-divider hover:bg-row-hover transition-colors';
export const tdClass = 'px-3 py-3 whitespace-nowrap';

/** Down/up arrow beside the column a table is sorted by, in the accent colour. */
export const SortArrow: React.FC<{ active: boolean; direction: 'asc' | 'desc' }> = ({ active, direction }) =>
  active ? <span className="ml-1 text-accent-ink">{direction === 'asc' ? '↑' : '↓'}</span> : null;

/** Page title, with an optional muted count after it and a line underneath. */
export const PageHeader: React.FC<{
  title: React.ReactNode;
  count?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}> = ({ title, count, subtitle, actions }) => (
  <div className="flex flex-wrap items-end justify-between gap-4">
    <div className="flex flex-col gap-1.5 min-w-0">
      <h1 className="m-0 font-display font-extrabold text-[32px] sm:text-[44px] leading-none tracking-[-0.03em] text-fg">
        {title}
        {count !== undefined && <span className="font-semibold text-muted"> {count}</span>}
      </h1>
      {subtitle && <p className="m-0 text-[15px] font-medium text-muted">{subtitle}</p>}
    </div>
    {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
  </div>
);

/** Rounded translucent card that sections of a page sit in. */
export const Panel: React.FC<React.HTMLAttributes<HTMLElement> & { as?: 'section' | 'div'; ref?: React.Ref<HTMLElement> }> = ({
  as: Tag = 'section',
  className = '',
  children,
  ref,
  ...rest
}) => (
  <Tag ref={ref as React.Ref<HTMLDivElement>} className={`rounded-[22px] border border-line bg-panel/92 backdrop-blur-md ${className}`} {...rest}>
    {children}
  </Tag>
);

const BADGE_SIZES = {
  lg: 'w-12 h-[34px] rounded-[10px] text-[17px] font-extrabold',
  md: 'w-11 h-[30px] rounded-[9px] text-[15px] font-bold',
  sm: 'min-w-[1.75rem] h-6 px-1 rounded-md text-xs font-bold',
};

/** A rating on its card-tier colour, e.g. the Overall column. Blank ratings show a dash. */
export const TierBadge: React.FC<{ value: number | null | undefined; size?: keyof typeof BADGE_SIZES; className?: string }> = ({
  value,
  size = 'md',
  className = '',
}) => {
  if (value === null || value === undefined || value === 0) {
    return <span className={`inline-grid place-items-center font-display text-faint ${BADGE_SIZES[size]} ${className}`}>–</span>;
  }
  const { bg, fg } = getTierColors(value);
  return (
    <span
      className={`inline-grid place-items-center font-display tabular-nums ${BADGE_SIZES[size]} ${className}`}
      style={{ background: bg, color: fg }}
    >
      {value}
    </span>
  );
};

/** A rating as text in its card-tier colour. */
export const TierText: React.FC<{ value: number; className?: string }> = ({ value, className = '' }) => (
  <span className={`font-display font-bold tabular-nums ${className}`} style={{ color: getTierColors(value).text }}>
    {value}
  </span>
);

/** A position with the player's rating there, and how much it beats their primary position by. */
export const PositionChip: React.FC<{ position: string; rating?: number; gain?: number; title?: string }> = ({
  position,
  rating,
  gain = 0,
  title,
}) => (
  <span className="inline-flex items-center gap-1" title={title}>
    <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full border border-chip-line bg-chip text-[11px] font-bold text-fg-3">
      {position}
      {rating !== undefined && rating > 0 && <>{' '}<TierText value={rating} /></>}
    </span>
    {gain > 0 && <span className="text-xs font-semibold text-green-600 dark:text-green-400">+{gain}</span>}
  </span>
);

/** A single headline number, e.g. "Players 23". */
export const KpiTile: React.FC<{ label: React.ReactNode; value: React.ReactNode; sub?: React.ReactNode; accent?: boolean }> = ({
  label,
  value,
  sub,
  accent = false,
}) => (
  <div className="flex flex-col gap-2 px-5 py-[18px] rounded-[20px] border border-line bg-panel/92">
    <span className="text-[13px] font-semibold text-muted">{label}</span>
    <div className="flex items-baseline gap-2">
      <span className={`font-display font-extrabold text-[36px] leading-none tracking-[-0.02em] ${accent ? 'text-accent-ink' : 'text-fg'}`}>
        {value}
      </span>
      {sub && <span className="text-xs font-medium text-muted-3">{sub}</span>}
    </div>
  </div>
);

/** Search box with a magnifier, as at the top of the player tables. */
/** The X at the end of a search field that empties it. */
export const ClearButton: React.FC<{ onClear: () => void; label?: string }> = ({ onClear, label = 'Clear search' }) => (
  <button
    type="button"
    onClick={onClear}
    title="Clear"
    aria-label={label}
    className="flex-none grid place-items-center w-7 h-7 rounded-full text-muted cursor-pointer transition-colors hover:bg-chip hover:text-fg"
  >
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  </button>
);

/** With `onClear`, an X empties the field whenever there is something in it. */
export const SearchField: React.FC<
  React.InputHTMLAttributes<HTMLInputElement> & { wrapperClassName?: string; onClear?: () => void; clearLabel?: string }
> = ({ wrapperClassName = 'w-[300px] max-w-full', className = '', onClear, clearLabel, ...input }) => {
  const inputRef = React.useRef<HTMLInputElement>(null);
  return (
    <div
      className={`flex items-center gap-2 h-10 pl-3.5 ${onClear ? 'pr-1.5' : 'pr-3.5'} rounded-xl border border-line-3 bg-field focus-within:border-line-hover ${wrapperClassName}`}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="flex-none text-muted" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        ref={inputRef}
        type="text"
        className={`flex-1 min-w-0 bg-transparent border-0 outline-none text-strong text-sm font-medium ${className}`}
        {...input}
      />
      {onClear && input.value ? (
        <ClearButton
          label={clearLabel}
          onClear={() => {
            onClear();
            inputRef.current?.focus();
          }}
        />
      ) : null}
    </div>
  );
};

/**
 * Native select styled as in the design, with its own chevron. `compact` trims it for a row of many filters;
 * `block` makes it fill its container (give the select `w-full` too).
 */
export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { compact?: boolean; block?: boolean }> = ({
  className = '',
  compact = false,
  block = false,
  children,
  ...select
}) => (
  <span className={`relative ${block ? 'block' : 'inline-block'}`}>
    <select className={`${compact ? selectCompactClass : selectClass} ${className}`} {...select}>
      {children}
    </select>
    <svg
      className={`absolute ${compact ? 'right-2' : 'right-3'} top-1/2 -translate-y-1/2 pointer-events-none text-muted`}
      width={compact ? 11 : 14}
      height={compact ? 11 : 14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  </span>
);

/** Round grey disc with a player's initials, at the start of a table row. */
export const InitialsAvatar: React.FC<{ name: string }> = ({ name }) => (
  <span className="flex-none grid place-items-center w-9 h-9 rounded-full border border-line-2 bg-chip font-display text-xs font-bold text-fg-3">
    {name.split(' ').map(word => word[0]).join('').slice(0, 2)}
  </span>
);
