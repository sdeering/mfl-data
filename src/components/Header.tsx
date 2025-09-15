"use client";

import React, { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import SearchBar from './SearchBar';
import ThemeToggle from './ThemeToggle';
import WalletConnect from './WalletConnect';
import { useLoading } from '../contexts/LoadingContext';
import { useWallet } from '../contexts/WalletContext';

export const Header: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { isLoading } = useLoading();
  const { isConnected } = useWallet();

  // Extract player ID from current path
  const getCurrentPlayerId = () => {
    const match = pathname.match(/\/players\/(\d+)/);
    return match ? match[1] : null;
  };

  const handleCompareClick = () => {
    const playerId = getCurrentPlayerId();
    if (playerId) {
      router.push(`/compare?playerId=${playerId}`);
    } else {
      router.push('/compare');
    }
  };


  return (
    <>
      <header className="px-[30px] py-4 lg:py-6 max-[412px]:px-[15px] bg-white dark:bg-[#111827]">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4 lg:space-x-6">
            <button 
              onClick={() => router.push('/')}
              className="flex items-center space-x-2 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
              title="Go to homepage"
            >
              <svg className="w-6 h-6 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">MFL Data</h1>
            </button>
            
            {/* Navigation Links - Only show when logged in */}
            {isConnected && (
              <nav className="hidden lg:flex items-center space-x-6">
                <button 
                  onClick={() => router.push('/agency')}
                  className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                >
                  Agency
                </button>
                <button 
                  onClick={() => router.push('/clubs')}
                  className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                >
                  Clubs
                </button>
                <button 
                  onClick={() => router.push('/matches')}
                  className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                >
                  Matches
                </button>
                <button 
                  onClick={() => router.push('/matches/tactics')}
                  className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                >
                  Tactics
                </button>
              </nav>
            )}
            

            
            {/* Search Bar and Compare Link - Only show on player pages */}
            {pathname.includes('/players/') && (
              <div className="hidden lg:flex items-center space-x-4">
                <SearchBar isLoading={isLoading} />
                <button 
                  onClick={handleCompareClick}
                  className="px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                >
                  Compare
                </button>
              </div>
            )}
          </div>
          
          {/* Login Button - Desktop */}
          <div className="hidden lg:flex items-center space-x-3">
            <ThemeToggle 
              size="md" 
              variant="minimal" 
              className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
              aria-label="Toggle dark mode"
            />
            <WalletConnect 
              variant="default"
              size="md"
              className="bg-[#2a2a2a] hover:bg-gray-800 dark:hover:bg-gray-700"
            />
          </div>
          
          {/* Login Button - Mobile */}
          <div className="lg:hidden flex items-center space-x-2">
            <ThemeToggle 
              size="sm" 
              variant="minimal" 
              className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
              aria-label="Toggle dark mode"
            />
            <WalletConnect 
              variant="default"
              size="sm"
              className="bg-[#2a2a2a] hover:bg-gray-800 dark:hover:bg-gray-700"
            />
          </div>
        </div>
        
        {/* Mobile Search and Compare - Only show on player pages */}
        {pathname.includes('/players/') && (
          <div className="mt-4 lg:hidden">
            <div className="flex items-center space-x-4 mb-4">
              <div className="flex-1">
                <SearchBar isLoading={isLoading} />
              </div>
              <button 
                onClick={handleCompareClick}
                className="px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer text-sm"
              >
                Compare
              </button>
            </div>
          </div>
        )}
      </header>

    </>
  );
};

export default Header;
