"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface RecentSearch {
  id: string;
  name: string;
  overall: number;
  positions: string[];
  timestamp: number;
}

interface SearchBarProps {
  isLoading?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({ isLoading = false }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [showRecentSearches, setShowRecentSearches] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Load recent searches from localStorage on component mount
  useEffect(() => {
    const saved = localStorage.getItem('mfl-recent-searches');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse recent searches:', e);
      }
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          searchInputRef.current && !searchInputRef.current.contains(event.target as Node)) {
        setShowRecentSearches(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Reset local searching state when global loading completes
  useEffect(() => {
    if (!isLoading) {
      setIsSearching(false);
    }
  }, [isLoading]);

  // Clear search query only after navigation completes
  useEffect(() => {
    if (!isLoading && !isSearching) {
      // Small delay to ensure the page has fully loaded
      const timer = setTimeout(() => {
        setSearchQuery('');
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isLoading, isSearching]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setIsSearching(true);
      router.push(`/players/${encodeURIComponent(searchQuery.trim())}`);
      // Don't clear search query immediately - let it stay until page loads
      setShowRecentSearches(false);
    }
  };

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedValue = e.clipboardData.getData('text');
    const playerIdPattern = /^\d{4,6}$/;
    
    if (playerIdPattern.test(pastedValue.trim())) {
      // Auto-search for pasted player IDs
      setTimeout(() => {
        setIsSearching(true);
        router.push(`/players/${encodeURIComponent(pastedValue.trim())}`);
        setShowRecentSearches(false);
      }, 100);
    }
  };

  const handleSearchInputFocus = () => {
    if (recentSearches.length > 0) {
      setShowRecentSearches(true);
    }
  };

  const handleRecentSearchClick = (playerId: string) => {
    setIsSearching(true);
    router.push(`/players/${playerId}`);
    // Don't clear search query immediately - let it stay until page loads
    setShowRecentSearches(false);
  };

  const removeFromRecentSearches = (playerId: string) => {
    setRecentSearches(prev => {
      const updated = prev.filter(search => search.id !== playerId);
      localStorage.setItem('mfl-recent-searches', JSON.stringify(updated));
      return updated;
    });
  };

  const clearAllRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('mfl-recent-searches');
    setShowRecentSearches(false);
  };

  return (
    <div className="relative lg:ml-[10px]">
      <form onSubmit={handleSearch} className="relative">
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={handleSearchInputChange}
          onPaste={handlePaste}
          onFocus={handleSearchInputFocus}
          placeholder="Enter Player ID (numbers only)..."
          disabled={isSearching}
          className={`w-full lg:w-80 px-3 py-2 pr-10 bg-white dark:bg-[#121213] border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 ${
            isSearching ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        />
        <button
          type="submit"
          disabled={isSearching}
          className={`absolute right-2 top-1/2 transform -translate-y-1/2 p-1 transition-all duration-200 rounded ${
            isSearching 
              ? 'text-blue-500 cursor-not-allowed' 
              : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:scale-110 hover:bg-gray-100 dark:hover:bg-gray-700 hover:cursor-pointer cursor-pointer'
          }`}
        >
          {isSearching ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
        </button>
      </form>
      
      {/* Recent Searches Dropdown */}
      {showRecentSearches && recentSearches.length > 0 && (
        <div 
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#121213] border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-80 flex flex-col"
        >
          <div className="flex-1 overflow-y-auto p-2">
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 px-2">
              Recent Searches
            </div>
            {recentSearches.map((search) => (
              <div key={search.id} className="flex items-center justify-between p-2 rounded">
                <button
                  onClick={() => handleRecentSearchClick(search.id)}
                  className="flex-1 text-left cursor-pointer"
                >
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{search.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {search.id} / {search.overall} / {search.positions?.join(', ') || 'No positions'}
                  </p>
                </button>
                <button
                  onClick={() => removeFromRecentSearches(search.id)}
                  className="ml-2 p-1 text-gray-400 hover:text-red-500 transition-all duration-200 hover:scale-110 hover:bg-gray-100 dark:hover:bg-gray-700 rounded hover:cursor-pointer"
                  title="Remove from recent searches"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-200 dark:border-gray-700 p-2 bg-white dark:bg-[#121213]">
            <button
              onClick={clearAllRecentSearches}
              className="w-full px-3 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all duration-200 hover:scale-110 hover:bg-gray-100 dark:hover:bg-gray-700 rounded hover:cursor-pointer"
            >
              Clear All
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchBar;
