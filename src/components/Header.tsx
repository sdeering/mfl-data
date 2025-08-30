"use client";

import React, { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import SearchBar from './SearchBar';
import { useLoading } from '../contexts/LoadingContext';

export const Header: React.FC = () => {
  const [showLoginPopup, setShowLoginPopup] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { isLoading } = useLoading();

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

  const handleLoginClick = () => {
    setShowLoginPopup(true);
  };

  const closeLoginPopup = () => {
    setShowLoginPopup(false);
  };

  return (
    <>
      <header className="px-[30px] py-4 lg:py-6 max-[412px]:px-[15px] bg-white dark:bg-[#121213]">
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
            <button 
              onClick={handleLoginClick}
              className="px-4 py-2 text-white rounded-lg transition-all duration-200 cursor-pointer flex items-center space-x-2 hover:bg-gray-800 dark:hover:bg-gray-700 hover:scale-105 hover:shadow-lg"
              style={{ background: '#2a2a2a' }}
            >
              <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" data-slot="icon">
                <path d="M2.273 5.625A4.483 4.483 0 0 1 5.25 4.5h13.5c1.141 0 2.183.425 2.977 1.125A3 3 0 0 0 18.75 3H5.25a3 3 0 0 0-2.977 2.625ZM2.273 8.625A4.483 4.483 0 0 1 5.25 7.5h13.5c1.141 0 2.183.425 2.977 1.125A3 3 0 0 0 18.75 6H5.25a3 3 0 0 0-2.977 2.625ZM5.25 9a3 3 0 0 0-3 3v6a3 3 0 0 0 3 3h13.5a3 3 0 0 0 3-3v-6a3 3 0 0 0-3-3H15a.75.75 0 0 0-.75.75 2.25 2.25 0 0 1-4.5 0A.75.75 0 0 0 9 9H5.25Z"></path>
              </svg>
              <span>Login with wallet</span>
            </button>
          </div>
          
          {/* Login Button - Mobile */}
          <div className="lg:hidden">
            <button 
              onClick={handleLoginClick}
              className="px-3 py-2 text-white rounded-lg transition-all duration-200 cursor-pointer flex items-center space-x-2 hover:bg-gray-800 dark:hover:bg-gray-700 hover:scale-105 hover:shadow-lg"
              style={{ background: '#2a2a2a' }}
            >
              <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" data-slot="icon">
                <path d="M2.273 5.625A4.483 4.483 0 0 1 5.25 4.5h13.5c1.141 0 2.183.425 2.977 1.125A3 3 0 0 0 18.75 3H5.25a3 3 0 0 0-2.977 2.625ZM2.273 8.625A4.483 4.483 0 0 1 5.25 7.5h13.5c1.141 0 2.183.425 2.977 1.125A3 3 0 0 0 18.75 6H5.25a3 3 0 0 0-2.977 2.625ZM5.25 9a3 3 0 0 0-3 3v6a3 3 0 0 0 3 3h13.5a3 3 0 0 0 3-3v-6a3 3 0 0 0-3-3H15a.75.75 0 0 0-.75.75 2.25 2.25 0 0 1-4.5 0A.75.75 0 0 0 9 9H5.25Z"></path>
              </svg>
              <span className="hidden sm:inline">Login</span>
            </button>
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

      {/* Login Popup */}
      {showLoginPopup && (
        <div className="fixed top-20 right-2 lg:right-6 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 lg:p-6 max-w-sm w-full mx-2 lg:mx-4 shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Coming Soon!
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm lg:text-base">
                Wallet login functionality will be available in a future update.
              </p>
              <button
                onClick={closeLoginPopup}
                className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors cursor-pointer"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Header;
