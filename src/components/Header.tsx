"use client";

import React, { useState, useRef, useEffect } from 'react';
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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  // Handle hydration
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Menu items
  const menuItems = [
    { label: 'Agency (Players)', path: '/agency' },
    { label: 'Clubs', path: '/clubs' },
    { label: 'Matches', path: '/matches' },
    { label: 'Players Compare', path: '/compare' },
    { label: 'Upcoming Match Tactics', path: '/matches/tactics' },
    { label: 'Useful MFL Resources', path: '/resources' }
  ];

  const handleMenuClick = (path: string) => {
    router.push(path);
    setIsMenuOpen(false);
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
            
            {/* Navigation Dropdown - Only show when logged in and hydrated */}
            {isHydrated ? (
              isConnected && (
                <div className="relative" ref={menuRef}>
                  <button
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                  >
                    <span>Menu</span>
                    <svg 
                      className={`w-4 h-4 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {/* Dropdown Menu */}
                  {isMenuOpen && (
                    <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
                      <div className="py-2">
                        {menuItems.map((item, index) => (
                          <button
                            key={index}
                            onClick={() => handleMenuClick(item.path)}
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                              pathname === item.path 
                                ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20' 
                                : 'text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            ) : (
              // Placeholder to maintain layout during hydration
              <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 opacity-0">
                <span>Menu</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            )}
            

            
            {/* Search Bar and Compare Link - Only show on player pages */}
            {pathname.includes('/players/') && (
              <div className="hidden lg:flex items-center space-x-4">
                <SearchBar isLoading={isLoading} />
                <button 
                  onClick={handleCompareClick}
                  className="px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                >
                  Compare vs Player
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
                Compare vs Player
              </button>
            </div>
          </div>
        )}
      </header>

    </>
  );
};

export default Header;
