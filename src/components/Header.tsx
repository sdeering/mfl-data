"use client";

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import ThemeToggle from './ThemeToggle';
import WalletConnect from './WalletConnect';

interface NavLink {
  label: string;
  path: string;
}

interface NavGroup {
  label: string;
  path?: string;
  children?: NavLink[];
}

const NAV: NavGroup[] = [
  { label: 'Home', path: '/' },
  { label: 'Agency', path: '/agency' },
  {
    label: 'Clubs',
    children: [
      { label: 'My Clubs', path: '/clubs' },
      { label: 'My Matches', path: '/matches' },
      { label: 'Squad Builder Tool', path: '/squad-builder' },
    ],
  },
  {
    label: 'Players',
    children: [
      { label: 'Player Compare Tool', path: '/compare' },
      { label: 'Player Progression Tool', path: '/player-progression' },
      { label: 'Player Scouting Tool', path: '/scout' },
    ],
  },
  { label: 'MFL Resources', path: '/resources' },
];

const isActivePath = (pathname: string, path: string) => (path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(`${path}/`));

// A player page counts as being under Players
const isGroupActive = (pathname: string, group: NavGroup) =>
  (group.path !== undefined && isActivePath(pathname, group.path)) ||
  (group.children ?? []).some(child => isActivePath(pathname, child.path)) ||
  (group.label === 'Players' && pathname.startsWith('/players/'));

const glassButton =
  'flex-none grid place-items-center w-10 h-10 rounded-full border border-[rgba(var(--glass-rgb),.12)] bg-[rgba(var(--glass-rgb),.05)] cursor-pointer transition-colors hover:bg-[rgba(var(--glass-rgb),.12)]';

const dropdownClass =
  'absolute left-0 z-30 min-w-[220px] p-1.5 rounded-2xl border border-line-2 bg-panel shadow-[0_20px_50px_rgba(0,0,0,.45)] flex flex-col gap-0.5';

const Chevron: React.FC<{ open?: boolean; size?: number }> = ({ open = false, size = 11 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} className={`transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const SearchIcon: React.FC<{ size?: number }> = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

export const Header: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname() ?? '/';
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const headerRef = useRef<HTMLElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const playerId = pathname.match(/^\/players\/(\d+)/)?.[1];

  // Close the dropdowns when clicking elsewhere or pressing Escape, and after navigating
  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        setOpenGroup(null);
        setIsMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenGroup(null);
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    setOpenGroup(null);
    setIsMenuOpen(false);
  }, [pathname]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;
    router.push(`/players/${query}`);
    setQuery('');
    setSearchOpen(false);
  };

  const openSearch = () => {
    setSearchOpen(true);
    setTimeout(() => searchInputRef.current?.focus(), 0);
  };

  const pillClass = (active: boolean) =>
    `flex items-center gap-1.5 h-8 px-3.5 rounded-full text-[13px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
      active ? 'bg-accent text-accent-fg' : 'text-fg-3 hover:text-fg'
    }`;

  const childClass = (active: boolean) =>
    `flex items-center h-10 px-3 rounded-[10px] text-sm font-semibold whitespace-nowrap transition-colors ${
      active ? 'bg-accent/14 text-accent-ink' : 'text-fg-2 hover:bg-chip'
    }`;

  const activeLabel =
    NAV.flatMap(group => (group.children ? group.children : [group as NavLink])).find(link => isActivePath(pathname, link.path))?.label ??
    (pathname.startsWith('/players/') ? 'Player' : 'Home');

  const searchForm = (
    <form
      onSubmit={handleSearch}
      className="flex items-center gap-2 h-10 w-[240px] min-w-[150px] px-3.5 rounded-full border border-[rgba(var(--glass-rgb),.12)] bg-[rgba(var(--field-rgb),.7)] text-muted"
      role="search"
    >
      <SearchIcon />
      <input
        ref={searchInputRef}
        value={query}
        onChange={e => setQuery(e.target.value.replace(/\D/g, ''))}
        onBlur={() => !query && setSearchOpen(false)}
        inputMode="numeric"
        placeholder="Enter Player ID…"
        aria-label="Player ID"
        className="flex-1 min-w-0 bg-transparent border-0 outline-none text-strong text-[13px] font-medium"
      />
    </form>
  );

  return (
    <header ref={headerRef} className="relative z-20 max-w-[1520px] mx-auto px-4 sm:px-7 py-[18px] flex items-center gap-3">
      <Link href="/" className="flex-none flex items-center gap-2.5 text-fg hover:text-fg" title="Go to homepage">
        <svg width="34" height="34" viewBox="0 0 36 36" aria-label="MFL Data logo">
          <rect width="36" height="36" rx="10" fill="#c6f432" />
          <rect x="7" y="10" width="22" height="16" rx="2" fill="none" stroke="#0b1406" strokeWidth="2" />
          <path d="M18 10v16" stroke="#0b1406" strokeWidth="2" />
          <circle cx="18" cy="18" r="3.6" fill="none" stroke="#0b1406" strokeWidth="2" />
          <path d="M7 15h3v6H7M29 15h-3v6h3" fill="none" stroke="#0b1406" strokeWidth="2" strokeLinejoin="round" />
        </svg>
        <span className="hidden min-[26.25rem]:inline font-display text-[19px] font-bold tracking-[-0.01em] whitespace-nowrap">MFL Data</span>
      </Link>

      {/* Full navigation on wide screens */}
      <nav className="hidden lg:flex flex-none gap-1 p-1 rounded-full border border-[rgba(var(--glass-rgb),.1)] bg-[rgba(var(--glass-rgb),.05)] backdrop-blur-md" aria-label="Main">
        {NAV.map(group => {
          const active = isGroupActive(pathname, group);
          if (!group.children) {
            return (
              <Link key={group.label} href={group.path!} className={pillClass(active)}>
                {group.label}
              </Link>
            );
          }
          const open = openGroup === group.label;
          return (
            <div key={group.label} className="relative">
              <button
                type="button"
                onClick={() => setOpenGroup(open ? null : group.label)}
                className={pillClass(active)}
                aria-expanded={open}
              >
                {group.label}
                <Chevron open={open} />
              </button>
              {open && (
                <div className={`${dropdownClass} top-[42px]`}>
                  {group.children.map(child => (
                    <Link key={child.path} href={child.path} className={childClass(isActivePath(pathname, child.path))}>
                      {child.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* One menu on narrow screens */}
      <div className="relative flex-none lg:hidden">
        <button
          type="button"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="flex items-center gap-2 h-10 px-3.5 rounded-full border border-[rgba(var(--glass-rgb),.12)] bg-[rgba(var(--glass-rgb),.05)] text-fg text-[13px] font-semibold whitespace-nowrap cursor-pointer"
          aria-expanded={isMenuOpen}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
          Menu
          <span className="hidden sm:inline text-accent-ink">· {activeLabel}</span>
          <Chevron size={12} />
        </button>
        {isMenuOpen && (
          <div className={`${dropdownClass} top-12`}>
            {NAV.map(group =>
              group.children ? (
                <React.Fragment key={group.label}>
                  <span className="flex items-center h-[38px] px-3 text-sm font-semibold text-muted">{group.label}</span>
                  {group.children.map(child => (
                    <Link key={child.path} href={child.path} className={`${childClass(isActivePath(pathname, child.path))} pl-[26px]`}>
                      {child.label}
                    </Link>
                  ))}
                </React.Fragment>
              ) : (
                <Link key={group.label} href={group.path!} className={childClass(isActivePath(pathname, group.path!))}>
                  {group.label}
                </Link>
              )
            )}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0" />

      {/* Player search: a field on wide screens, an icon that opens one otherwise */}
      <div className="hidden xl:block">{searchForm}</div>
      <div className="xl:hidden">
        {searchOpen ? (
          searchForm
        ) : (
          <button type="button" onClick={openSearch} title="Search player" aria-label="Search player" className={`${glassButton} text-fg-2`}>
            <SearchIcon size={16} />
          </button>
        )}
      </div>

      {playerId && (
        <Link
          href={`/compare?playerId=${playerId}`}
          className="hidden md:flex flex-none items-center h-10 px-3.5 rounded-full border border-[rgba(var(--glass-rgb),.12)] text-fg-2 text-[13px] font-semibold whitespace-nowrap hover:text-fg"
        >
          Compare vs Player
        </Link>
      )}

      <a
        href="https://app.playmfl.com/?referrer=F64076"
        target="_blank"
        rel="noopener noreferrer"
        title="Play MFL"
        className="hidden sm:flex flex-none items-center justify-center gap-2 h-10 min-w-10 xl:px-3.5 rounded-full border border-[rgba(var(--glass-rgb),.12)] bg-[rgba(var(--glass-rgb),.06)] text-fg text-[13px] font-semibold whitespace-nowrap transition-colors hover:bg-[rgba(var(--glass-rgb),.12)] hover:text-strong"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="m12 7 4 3-1.5 4.5h-5L8 10z" />
        </svg>
        <span className="hidden xl:inline">Play MFL</span>
      </a>

      <ThemeToggle variant="glass" size="sm" aria-label="Toggle dark mode" />

      <WalletConnect />
    </header>
  );
};

export default Header;
