"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export const HomePage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Navigate to new player route
      router.push(`/players/${encodeURIComponent(searchQuery.trim())}`);
      // Clear the search box after navigation
      setSearchQuery('');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedValue = e.clipboardData.getData('text');
    const playerIdPattern = /^\d{4,6}$/;
    
    if (playerIdPattern.test(pastedValue.trim())) {
      // Auto-search for pasted player IDs
      setTimeout(() => {
        router.push(`/players/${encodeURIComponent(pastedValue.trim())}`);
        setSearchQuery('');
      }, 100);
    }
  };
  return (
    <div className="min-h-screen">

      {/* Main Content - Centered Search */}
      <main className="flex items-start lg:items-center justify-center min-h-[calc(100vh-120px)] bg-white dark:bg-[#121213] pt-8 lg:pt-0" style={{ marginTop: '-200px' }}>
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
              />
            </div>
            
            <button
              type="submit"
              disabled={!searchQuery.trim()}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
            >
              Search Player
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
                >
                  {playerId}
                </button>
              ))}
            </div>
          </form>
        </div>
      </main>

      
    </div>
  );
};

export default HomePage;
