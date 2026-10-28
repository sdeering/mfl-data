import React, { useLayoutEffect, useRef, useState } from 'react';
import type { MFLClubData } from '../../services/clubsService';
import { clubsService } from '../../services/clubsService';
import { linkClass } from '../ui';
import { ClubLogo } from './ClubLogo';

/** The wallet's clubs as cards in one row, with "Show all" when there are more than fit. */
export const ClubStrip: React.FC<{ clubs: MFLClubData[]; selectedId?: number; onSelect: (club: MFLClubData) => void }> = ({
  clubs,
  selectedId,
  onSelect,
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  // Cards that wrap past the first row, hidden until expanded
  const [overflow, setOverflow] = useState(0);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => {
      const cards = Array.from(list.children) as HTMLElement[];
      const firstRow = cards[0]?.offsetTop ?? 0;
      setOverflow(cards.filter(card => card.offsetTop > firstRow).length);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [clubs]);

  return (
    <div className="flex flex-col gap-2">
      <div ref={listRef} className={`flex flex-wrap gap-2.5 ${expanded ? '' : 'max-h-16 overflow-hidden'}`}>
        {clubs.map(clubData => {
          const { club } = clubData;
          const selected = club.id === selectedId;
          return (
            <button
              key={club.id}
              type="button"
              onClick={() => onSelect(clubData)}
              aria-pressed={selected}
              title={`${club.name} · ${clubsService.getDivisionName(club.division)}`}
              className={`flex items-center gap-2.5 h-16 pl-2.5 pr-4 rounded-2xl border cursor-pointer transition-colors ${
                selected ? 'border-accent bg-[var(--badge-bg)]' : 'border-line bg-panel/92 hover:border-line-hover'
              }`}
            >
              <ClubLogo clubId={club.id} name={club.name} logoVersion={club.logoVersion} className="w-11 h-11" />
              <span className="flex flex-col items-start gap-1 min-w-0">
                <span className={`max-w-[11rem] truncate text-sm font-bold ${selected ? 'text-accent-ink' : 'text-fg'}`}>{club.name}</span>
                <span className={`inline-flex items-center h-[18px] px-2 rounded-full text-[10px] font-bold ${clubsService.getDivisionColor(club.division)}`}>
                  {clubsService.getDivisionName(club.division)}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {(overflow > 0 || expanded) && (
        <button type="button" onClick={() => setExpanded(!expanded)} className={`self-start text-sm font-semibold cursor-pointer ${linkClass}`}>
          {expanded ? 'Show less' : `Show all clubs (${overflow} more)`}
        </button>
      )}
    </div>
  );
};
