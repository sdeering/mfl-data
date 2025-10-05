'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '../contexts/WalletContext';
import { supabaseDataService } from '../services/supabaseDataService';
import { useLoading } from '../contexts/LoadingContext';

// Import the clubsService for utility functions
import { clubsService } from '../services/clubsService';

interface ClubData {
  id: number;
  name: string;
  city: string;
  country: string;
  division: number;
  mainColor: string;
  competitions: Array<{
    id: number;
    name: string;
    code: string;
    type: string;
  }>;
}

export default function ClubsPageSupabase() {
  const router = useRouter();
  const { isConnected, account } = useWallet();
  const { setLoading } = useLoading();
  const [clubs, setClubs] = useState<ClubData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoadingClubs, setIsLoadingClubs] = useState(false);
  const [hasAttemptedFetch, setHasAttemptedFetch] = useState(false);

  useEffect(() => {
    if (isConnected && account) {
      // Add a small delay to ensure wallet state is fully loaded
      const timer = setTimeout(() => {
        fetchClubs();
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [isConnected, account]);

  const fetchClubs = async () => {
    if (!account) {
      return;
    }

    setIsLoadingClubs(true);
    setError(null);
    setHasAttemptedFetch(true);

    try {
      // Use Supabase data service instead of MFL API
      const clubsData = await supabaseDataService.getClubsForWallet(account);
      
      // Transform the data to match the expected format
      const transformedClubs = clubsData.map(clubData => ({
        id: clubData.mfl_club_id,
        name: clubData.data.club.name,
        city: clubData.data.club.city,
        country: clubData.data.club.country,
        division: clubData.data.club.division,
        mainColor: clubData.data.club.mainColor,
        competitions: clubData.data.competitions || []
      }));
      
      setClubs(transformedClubs);
    } catch (err) {
      console.error('Error fetching clubs from database:', err);
      setError('Failed to load clubs data from database');
    } finally {
      setIsLoadingClubs(false);
    }
  };

  const filteredClubs = clubs
    .filter(club => {
      const searchLower = searchTerm.toLowerCase();
      return (
        club.name.toLowerCase().includes(searchLower) ||
        club.city.toLowerCase().includes(searchLower) ||
        club.country.toLowerCase().includes(searchLower) ||
        clubsService.getDivisionName(club.division).toLowerCase().includes(searchLower)
      );
    })
    .sort((a, b) => {
      // Sort by division (ascending - highest division first)
      // Division 1 (Premier League) comes before Division 2 (Championship), etc.
      return a.division - b.division;
    });

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              MFL Clubs
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              Please connect your wallet to view your clubs
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              MFL Clubs
            </h1>
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-red-800 dark:text-red-200">{error}</p>
              <button
                onClick={fetchClubs}
                className="mt-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              MFL Clubs ({clubs.length} clubs)
            </h1>
          </div>
          
          {/* Search */}
          <div className="w-full sm:w-64">
            <input
              type="text"
              placeholder="Search clubs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

        {/* Loading State */}
        {isLoadingClubs && (
          <div className="text-center py-12">
            <div className="text-gray-400 dark:text-gray-500 text-lg">
              Loading clubs from database...
            </div>
          </div>
        )}

        {/* Clubs Grid */}
        {!isLoadingClubs && hasAttemptedFetch && filteredClubs.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 dark:text-gray-500 text-lg mb-4">
              {searchTerm ? 'No clubs found matching your search' : 'No clubs found for this wallet'}
            </div>
            {!searchTerm && (
              <div className="text-gray-500 dark:text-gray-400 text-sm">
                <p>This wallet may not have any clubs associated with it.</p>
                <p className="mt-2">Try refreshing or check if you're using the correct wallet.</p>
              </div>
            )}
          </div>
        )}

        {/* Clubs Display */}
        {!isLoadingClubs && hasAttemptedFetch && filteredClubs.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredClubs.map((club) => {
              return (
                <div
                  key={club.id}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden cursor-pointer"
                  onClick={() => router.push(`/clubs/${club.id}`)}
                >
                  {/* Club Header */}
                  <div 
                    className="h-24 relative"
                    style={{ backgroundColor: club.mainColor }}
                  >
                    <div className="absolute inset-0 bg-black bg-opacity-20"></div>
                    <div className="absolute bottom-4 left-4 right-4">
                      <h3 className="text-xl font-bold text-white drop-shadow-lg">
                        {clubsService.formatClubName(club)}
                      </h3>
                      <p className="text-white text-sm drop-shadow-md opacity-90">
                        {clubsService.formatCityCountry(club)}
                      </p>
                    </div>
                  </div>

                  {/* Club Details */}
                  <div className="p-6">
                    <div className="space-y-4">
                      {/* Division */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Division
                        </span>
                        <span 
                          className={`px-3 py-1 rounded-full text-sm font-semibold ${clubsService.getDivisionColor(club.division)}`}
                        >
                          {clubsService.getDivisionName(club.division)}
                        </span>
                      </div>

                      {/* Competitions */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                          Competitions
                        </h4>
                        <div className="space-y-2">
                          {club.competitions.map((competition) => (
                            <div
                              key={competition.id}
                              className="flex items-center space-x-2 text-sm"
                            >
                              <span className="text-lg">
                                {clubsService.getCompetitionTypeIcon(competition.type)}
                              </span>
                              <span className="text-gray-900 dark:text-white">
                                {competition.name}
                              </span>
                              <span className="text-gray-500 dark:text-gray-400 text-xs">
                                ({competition.code})
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
    </div>
  );
}

