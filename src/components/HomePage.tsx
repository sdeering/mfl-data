"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLoading } from '@/src/contexts/LoadingContext';
import LoadingSpinner from '@/src/components/LoadingSpinner';

interface Tool {
  title: string;
  description: string;
  path: string;
  needsWallet: boolean;
  icon: string; // SVG path, 24x24 outline
}

// The tools in the header menu, each with what it does
const TOOLS: Tool[] = [
  {
    title: 'Agency Overview',
    description: 'Every player you own in one table: overall, rating at each position, age and attributes. Search, filter, sort and export to Excel.',
    path: '/agency',
    needsWallet: true,
    icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
  },
  {
    title: 'Club Overview',
    description: "Your clubs with their divisions and competitions. Open one for its squad averages, its players' position ratings and the coaches it can hire.",
    path: '/clubs',
    needsWallet: true,
    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.040A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  },
  {
    title: 'Player Progression Overview',
    description: 'The stat points your players have gained, day by day, over the last 7 to 365 days. Narrow it by squad, position and age.',
    path: '/player-progression',
    needsWallet: true,
    icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
  },
  {
    title: 'Player Compare Tool',
    description: 'Put two or three players side by side: stats, position ratings, progression, recent matches and estimated market value. Share it as a link.',
    path: '/compare',
    needsWallet: false,
    icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
  },
  {
    title: 'Player Scouting Tool',
    description: "The newest marketplace listings that match your filters, with how much each player's overall has risen over the last 7, 30 and 90 days.",
    path: '/scout',
    needsWallet: false,
    icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  },
  {
    title: 'Squad Builder Tool',
    description: 'Build squads from your players and see their averages, balance, ages and position coverage. Save squads to come back to.',
    path: '/squad-builder',
    needsWallet: true,
    icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z',
  },
  {
    title: 'MFL Resources Links',
    description: 'MFL podcasts and YouTube channels, and other community sites for managers.',
    path: '/resources',
    needsWallet: false,
    icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  },
];

export const HomePage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const router = useRouter();
  const { setIsLoading } = useLoading();

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

  const handlePaste = async (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedValue = e.clipboardData.getData('text');
    const playerIdPattern = /^\d{4,6}$/;
    
    if (playerIdPattern.test(pastedValue.trim())) {
      // Set the pasted value in the input
      setSearchQuery(pastedValue.trim());
      
      // Show loading state
      setIsSearching(true);
      setIsLoading(true);
      
      // Small delay to show loading state and keep the number visible
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Navigate to player page
      router.push(`/players/${encodeURIComponent(pastedValue.trim())}`);
    }
  };

  return (
    <div className="min-h-screen">

      {/* Main Content - Search */}
      <main className="flex justify-center bg-white dark:bg-[#111827] pt-12 lg:pt-20 pb-12 lg:pb-16">
        <div className="w-full max-w-md">
          <form onSubmit={handleSearch} className="space-y-6">
            <div className="text-center mb-8">
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Search for MFL players
              </h1>
            </div>
            
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={handleInputChange}
                onPaste={handlePaste}
                placeholder="Search for a player by id..."
                className="w-full px-4 py-3 text-lg bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 dark:text-white"
                disabled={isSearching}
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <LoadingSpinner size="sm" />
                </div>
              )}
            </div>
            
            <button
              type="submit"
              disabled={!searchQuery.trim() || isSearching}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-lg flex items-center justify-center gap-2"
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
            
            {/* Quick Search Links */}
            <div className="flex flex-wrap gap-4 justify-start items-center">
              <span className="text-black dark:text-white text-sm" style={{ fontSize: '14px' }}>Explore:</span>
              {[116267, 9122, 93886, 44743, 26114, 71469, 55419].map((playerId) => (
                <button
                  key={playerId}
                  type="button"
                  onClick={() => router.push(`/players/${playerId}`)}
                  className="text-black dark:text-white hover:text-gray-600 dark:hover:text-gray-300 underline text-sm cursor-pointer"
                  style={{ fontSize: '14px' }}
                  disabled={isSearching}
                >
                  {playerId}
                </button>
              ))}
            </div>
          </form>
        </div>
      </main>

      {/* Tools */}
      <section aria-labelledby="tools-heading" className="pb-16">
        <h2 id="tools-heading" className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Tools
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {TOOLS.map(tool => (
            <Link
              key={tool.path}
              href={tool.path}
              className="group flex flex-col gap-3 p-5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-lg transition-all duration-200"
            >
              <div className="flex items-center gap-3">
                <span className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tool.icon} />
                  </svg>
                </span>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {tool.title}
                </h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {tool.description}
              </p>
              {tool.needsWallet && (
                <span className="mt-auto self-start inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Needs wallet
                </span>
              )}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
};

export default HomePage;
