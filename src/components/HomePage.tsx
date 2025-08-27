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
    
    // Auto-search when a valid player ID (4-6 digits) is pasted
    const trimmedValue = value.trim();
    if (/^\d{4,6}$/.test(trimmedValue)) {
      // Small delay to allow the input to update
      setTimeout(() => {
        router.push(`/players/${encodeURIComponent(trimmedValue)}`);
        setSearchQuery('');
      }, 100);
    }
  };
  return (
    <div className="min-h-screen">

      {/* Main Content - Centered Search */}
      <main className="flex items-center justify-center min-h-[calc(100vh-120px)] px-4 lg:px-6 bg-white dark:bg-[#121213]">
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
                placeholder="Enter player ID..."
                className="w-full px-4 py-3 text-lg bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 dark:text-white"
              />
            </div>
            
                            <button
                  type="submit"
                  disabled={!searchQuery.trim()}
                  className="w-full py-3 bg-black dark:bg-white text-white dark:text-black rounded-lg font-semibold hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
                >
              Search Player
            </button>
          </form>
        </div>
      </main>

      
    </div>
  );
};

export default HomePage;
