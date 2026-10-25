"use client";

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLoading } from '@/src/contexts/LoadingContext';
import { useWallet } from '@/src/contexts/WalletContext';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import { ClearButton } from '@/src/components/ui';
import { playerIdFromText } from '@/src/utils/playerId';

const LIME = '#c6f432';
const SKY = '#6eb4ff';

// Rows of a mini player table, for the Agency box: name bar width and two rating colours
const TABLE_ROWS: [string, string, string][] = [
  ['62%', LIME, SKY],
  ['48%', LIME, 'rgba(255,255,255,.1)'],
  ['70%', SKY, LIME],
  ['40%', 'rgba(255,255,255,.1)', LIME],
  ['56%', LIME, SKY],
];

// A 4-4-2 on the Squad Builder pitch, goalkeeper first: x%, y%
const FORMATION: [number, number][] = [
  [50, 90], [18, 72], [39, 75], [61, 75], [82, 72], [30, 52], [50, 56], [70, 52], [22, 28], [50, 22], [78, 28],
];

const PROGRESSION_BARS = [28, 36, 32, 48, 44, 58, 54, 72, 88];

const EXPLORE_PLAYER_IDS = [116267, 9122, 93886, 44743, 26114, 71469, 55419];

const NeedsWallet: React.FC<{ small?: boolean }> = ({ small = false }) => (
  <span
    className={`inline-flex items-center whitespace-nowrap leading-tight rounded-full bg-[rgba(255,190,90,.12)] text-warn-ink font-semibold ${
      small ? 'px-2.5 py-1 text-[11px]' : 'px-[11px] py-[5px] text-xs'
    }`}
  >
    Needs wallet
  </span>
);

const cardClass =
  'relative flex flex-col rounded-[22px] overflow-hidden bg-panel border border-line text-fg hover:border-line-hover hover:text-fg transition-colors';

const ToolCaption: React.FC<{ title: string; description: string; locked?: boolean; large?: boolean }> = ({
  title,
  description,
  locked = false,
  large = false,
}) => (
  <div className={`flex flex-col ${large ? 'gap-1.5 px-[22px] pt-[18px] pb-5' : 'gap-1 px-5 pt-4 pb-[18px]'}`}>
    <div className="flex flex-wrap items-center gap-2.5">
      <span className={`font-display font-bold tracking-[-0.01em] ${large ? 'text-xl' : 'text-lg'}`}>{title}</span>
      {locked && <NeedsWallet small={!large} />}
    </div>
    <p className={`m-0 text-muted text-pretty ${large ? 'text-sm leading-normal' : 'text-[13px] leading-[1.45]'}`}>{description}</p>
  </div>
);

export const HomePage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { setIsLoading } = useLoading();
  const { isConnected, connectWallet } = useWallet();
  const locked = !isConnected;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setIsSearching(true);
      setIsLoading(true);

      // Small delay to show loading state
      await new Promise(resolve => setTimeout(resolve, 300));

      // Navigate to new player route
      router.push(`/players/${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
  };

  // A pasted ID, or a link to a player here or on mfl.com, opens the player without pressing Search
  const handlePaste = async (e: React.ClipboardEvent<HTMLInputElement>) => {
    const id = playerIdFromText(e.clipboardData.getData('text'));
    if (!id) return;
    e.preventDefault();
    setSearchQuery(id);

    // Show loading state
    setIsSearching(true);
    setIsLoading(true);

    // Small delay to show loading state and keep the number visible
    await new Promise(resolve => setTimeout(resolve, 500));

    router.push(`/players/${id}`);
  };

  return (
    <div>
      {/* Hero - Search */}
      <section className="relative max-w-[820px] mx-auto pt-12 sm:pt-[82px] pb-20 flex flex-col items-center gap-[22px] text-center">
        <div className="flex items-center gap-2 h-[30px] px-3.5 rounded-full border border-[var(--badge-line)] bg-[var(--badge-bg)] text-accent-soft text-[13px] font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--badge-dot)]" />
          100% free to use community project
        </div>
        <h1 className="m-0 font-display font-extrabold text-[clamp(40px,7vw,76px)] leading-[0.98] tracking-[-0.035em] text-balance">
          Search for MFL players
        </h1>
        <form
          onSubmit={handleSearch}
          className="w-full max-w-[620px] flex items-center gap-2 p-2 rounded-[18px] border border-[rgba(var(--glass-rgb),.14)] bg-[rgba(var(--field-rgb),.72)] backdrop-blur-lg shadow-[0_20px_60px_rgba(0,0,0,.45)]"
        >
          <svg className="ml-3 flex-none text-muted" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="text"
            ref={inputRef}
            value={searchQuery}
            onChange={handleInputChange}
            onPaste={handlePaste}
            inputMode="numeric"
            placeholder="Search for a player by ID…"
            className="flex-1 min-w-0 h-12 bg-transparent border-0 outline-none text-strong text-[17px] font-medium"
            disabled={isSearching}
          />
          {searchQuery && !isSearching && (
            <ClearButton
              label="Clear player ID"
              onClear={() => {
                setSearchQuery('');
                inputRef.current?.focus();
              }}
            />
          )}
          <button
            type="submit"
            disabled={!searchQuery.trim() || isSearching}
            className="flex items-center gap-2 h-12 px-4 sm:px-6 rounded-xl bg-accent text-accent-fg text-[15px] font-bold whitespace-nowrap cursor-pointer transition-colors hover:bg-[#d8fb74] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSearching ? (
              <>
                <LoadingSpinner size="sm" />
                Searching...
              </>
            ) : (
              'Search Player'
            )}
          </button>
        </form>

        {/* Quick Search Links */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="mr-1 text-[13px] font-semibold text-muted">Explore</span>
          {EXPLORE_PLAYER_IDS.map((playerId) => (
            <button
              key={playerId}
              type="button"
              onClick={() => router.push(`/players/${playerId}`)}
              className="h-[30px] px-3 rounded-full border border-[rgba(var(--glass-rgb),.14)] bg-[rgba(var(--glass-rgb),.06)] backdrop-blur-sm font-mono text-[13px] font-medium text-fg-2 cursor-pointer transition-colors hover:border-accent-ink hover:text-accent-ink disabled:opacity-50"
              disabled={isSearching}
            >
              {playerId}
            </button>
          ))}
        </div>
      </section>

      {/* Tools */}
      <section aria-labelledby="tools-heading" className="relative">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
          <h2 id="tools-heading" className="m-0 font-display text-[32px] font-bold tracking-[-0.02em]">
            Tools
          </h2>
          <span className="text-sm font-medium text-muted">
            {locked ? (
              <>
                <button
                  type="button"
                  onClick={connectWallet}
                  className="p-0 border-0 bg-transparent text-strong underline underline-offset-[3px] cursor-pointer"
                >
                  Connect your wallet
                </button>{' '}
                to unlock agency tools
              </>
            ) : (
              'All tools unlocked'
            )}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 min-[68.75rem]:grid-cols-4 auto-rows-[280px] grid-flow-dense gap-4">
          <Link href="/agency" className={`${cardClass} md:col-span-2`}>
            <div className="relative flex-1 px-[22px] pt-[22px] overflow-hidden bg-[linear-gradient(160deg,#143a26,#0e1d15_70%)]">
              <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,.025)_0_40px,transparent_40px_80px)]" />
              <div className="relative ml-auto w-[78%] flex flex-col gap-1.5 translate-y-2" aria-hidden="true">
                {TABLE_ROWS.map(([width, first, second], index) => (
                  <div
                    key={index}
                    className="grid grid-cols-[26px_1fr_40px_40px_40px] items-center gap-2.5 h-[30px] px-2.5 rounded-lg border border-white/6 bg-[rgba(8,12,10,.55)]"
                  >
                    <span className="w-5 h-5 rounded-full bg-[#2a4a38]" />
                    <span className="h-[7px] rounded bg-white/22" style={{ width }} />
                    <span className="h-4 rounded-[5px]" style={{ background: first }} />
                    <span className="h-4 rounded-[5px]" style={{ background: second }} />
                    <span className="h-4 rounded-[5px] bg-white/10" />
                  </div>
                ))}
              </div>
            </div>
            <ToolCaption
              large
              title="Agency Overview"
              locked={locked}
              description="Every player you own in one table: overall, rating at each position, age and attributes. Search, filter, sort and export to Excel."
            />
          </Link>

          <Link href="/squad-builder" className={`${cardClass} md:row-span-2`}>
            <div
              className="relative flex-1 mx-3.5 mt-3.5 rounded-[14px] overflow-hidden bg-[repeating-linear-gradient(180deg,#11482c_0_36px,#145233_36px_72px)]"
              aria-hidden="true"
            >
              <div className="absolute inset-3 rounded border-2 border-white/35" />
              <div className="absolute inset-x-3 top-1/2 h-0.5 bg-white/35" />
              <div className="absolute left-1/2 top-1/2 w-[70px] h-[70px] -ml-[35px] -mt-[35px] rounded-full border-2 border-white/35" />
              <div className="absolute left-1/2 bottom-3 w-[120px] h-[46px] -ml-[60px] border-2 border-b-0 border-white/35" />
              <div className="absolute left-1/2 top-3 w-[120px] h-[46px] -ml-[60px] border-2 border-t-0 border-white/35" />
              {FORMATION.map(([x, y], index) => (
                <span
                  key={index}
                  className="absolute w-[22px] h-[22px] -ml-[11px] -mt-[11px] rounded-full border-2 border-[#0b1406] shadow-[0_3px_8px_rgba(0,0,0,.4)]"
                  style={{ left: `${x}%`, top: `${y}%`, background: index === 0 ? '#ffffff' : LIME }}
                />
              ))}
            </div>
            <ToolCaption
              large
              title="Squad Builder"
              locked={locked}
              description="Build squads from your players and see their averages, balance, ages and position coverage. Save squads to come back to."
            />
          </Link>

          <Link href="/compare" className={cardClass}>
            <div className="flex-1 flex items-center justify-center gap-3.5 bg-[linear-gradient(160deg,#16242e,#0e1519_70%)]" aria-hidden="true">
              <div className="w-[70px] h-[92px] rounded-xl border border-[rgba(198,244,50,.4)] bg-[rgba(198,244,50,.16)] flex flex-col items-center justify-center gap-1.5">
                <span className="w-[30px] h-[30px] rounded-full bg-accent" />
                <span className="w-10 h-[5px] rounded-sm bg-white/30" />
              </div>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#93a39a" strokeWidth={2}>
                <path d="M7 7h13l-3-3M17 17H4l3 3" />
              </svg>
              <div className="w-[70px] h-[92px] rounded-xl border border-[rgba(110,180,255,.4)] bg-[rgba(110,180,255,.14)] flex flex-col items-center justify-center gap-1.5">
                <span className="w-[30px] h-[30px] rounded-full bg-[#6eb4ff]" />
                <span className="w-10 h-[5px] rounded-sm bg-white/30" />
              </div>
            </div>
            <ToolCaption title="Player Compare" description="Two or three players side by side — stats, ratings, progression and market value." />
          </Link>

          <Link href="/player-progression" className={cardClass}>
            <div className="flex-1 flex items-end gap-[7px] px-6 pt-[22px] bg-[linear-gradient(160deg,#20301a,#111a0e_70%)]" aria-hidden="true">
              {PROGRESSION_BARS.map((height, index) => (
                <span
                  key={index}
                  className="flex-1 rounded-t-md"
                  style={{ height: `${height}%`, background: index === PROGRESSION_BARS.length - 1 ? LIME : `rgba(198,244,50,${0.18 + index * 0.05})` }}
                />
              ))}
            </div>
            <ToolCaption title="Player Progression" locked={locked} description="Stat points your players gained, day by day, over 7 to 365 days." />
          </Link>

          <Link href="/clubs" className={cardClass}>
            <div className="flex-1 flex items-center justify-center bg-[linear-gradient(160deg,#2a1d33,#140f19_70%)]" aria-hidden="true">
              <div className="w-[92px] h-[108px] grid place-items-center bg-accent [clip-path:polygon(50%_0,100%_14%,100%_55%,50%_100%,0_55%,0_14%)]">
                <div className="w-[78px] h-[92px] grid place-items-center bg-[#1b1322] font-display text-[26px] font-extrabold text-accent [clip-path:polygon(50%_0,100%_14%,100%_55%,50%_100%,0_55%,0_14%)]">
                  FC
                </div>
              </div>
            </div>
            <ToolCaption title="Club Overview" locked={locked} description="Divisions, squad averages, position ratings and coaches you can hire." />
          </Link>

          <Link href="/scout" className={cardClass}>
            <div className="relative flex-1 flex items-center justify-center overflow-hidden bg-[linear-gradient(160deg,#122b2e,#0c1718_70%)]" aria-hidden="true">
              <div className="absolute w-[180px] h-[180px] rounded-full border border-[rgba(94,234,212,.18)]" />
              <div className="absolute w-[110px] h-[110px] rounded-full border border-[rgba(94,234,212,.3)]" />
              <div className="w-14 h-14 rounded-full grid place-items-center border border-[rgba(94,234,212,.55)] bg-[rgba(94,234,212,.16)]">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#5eead4" strokeWidth={2.2}>
                  <circle cx="11" cy="11" r="6" />
                  <path d="m20 20-4-4" />
                </svg>
              </div>
              <span className="absolute left-[28%] top-[28%] w-2.5 h-2.5 rounded-full bg-accent" />
              <span className="absolute right-[26%] top-[60%] w-2 h-2 rounded-full bg-[#5eead4]" />
              <span className="absolute left-[62%] top-[20%] w-1.5 h-1.5 rounded-full bg-white" />
            </div>
            <ToolCaption title="Player Scouting" description="Newest marketplace listings matching your filters, with 7, 30 and 90-day overall growth." />
          </Link>
        </div>

        <Link
          href="/resources"
          className="mt-4 flex items-center gap-[22px] min-h-[110px] px-5 sm:px-7 py-5 rounded-[22px] border border-line bg-[linear-gradient(100deg,var(--tile-tint),var(--panel)_60%)] text-fg hover:border-line-hover hover:text-fg transition-colors"
        >
          <div className="flex-none w-14 h-14 rounded-2xl grid place-items-center bg-accent" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#0b1406">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <span className="font-display text-xl font-bold">MFL Resources</span>
            <span className="text-sm leading-[1.45] text-muted">MFL podcasts and YouTube channels, and other community sites for managers.</span>
          </div>
          <svg className="flex-none text-accent-ink" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </Link>
      </section>
    </div>
  );
};

export default HomePage;
