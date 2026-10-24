'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '../contexts/WalletContext';
import { clubsService, MFLClubData } from '../services/clubsService';
import { PageHeader, Panel, SearchField, btnSecondary } from './ui';

export default function ClubsPage() {
  const router = useRouter();
  const { isConnected, account } = useWallet();
  const [clubs, setClubs] = useState<MFLClubData[]>([]);
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
      const clubsData = await clubsService.fetchClubsForWallet(account);
      setClubs(clubsData);
    } catch (err) {
      console.error('Error fetching clubs:', err);
      setError('Failed to load clubs data');
    } finally {
      setIsLoadingClubs(false);
    }
  };

  const filteredClubs = clubs
    .filter(clubData => {
      const club = clubData.club;
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
      return a.club.division - b.club.division;
    });

  if (!isConnected) {
    return (
      <div className="flex flex-col gap-[22px]">
        <PageHeader title="MFL Clubs" />
        <Panel className="px-6 py-16 text-center">
          <p className="m-0 text-[15px] font-medium text-muted">
            Please connect your wallet to view your clubs
          </p>
        </Panel>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-[22px]">
        <PageHeader title="MFL Clubs" />
        <Panel className="flex flex-col items-center gap-4 px-6 py-16 text-center">
          <p className="m-0 text-[15px] font-semibold text-danger-ink">{error}</p>
          <button onClick={fetchClubs} className={btnSecondary}>
            Try Again
          </button>
        </Panel>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[22px]">
      <PageHeader
        title="MFL Clubs"
        count={`(${clubs.length} clubs)`}
        actions={
          <SearchField
            placeholder="Search clubs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        }
      />

      {isLoadingClubs && (
        <Panel className="flex items-center justify-center gap-3 px-6 py-16">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent"></div>
          <span className="text-[15px] font-medium text-muted">Loading clubs...</span>
        </Panel>
      )}

      {!isLoadingClubs && hasAttemptedFetch && filteredClubs.length === 0 && (
        <Panel className="flex flex-col items-center gap-3 px-6 py-16 text-center">
          <p className="m-0 font-display text-lg font-bold text-fg">
            {searchTerm ? 'No clubs found matching your search' : 'No clubs found for this wallet'}
          </p>
          {!searchTerm && (
            <div className="text-sm text-muted">
              <p className="m-0">This wallet may not have any clubs associated with it.</p>
              <p className="m-0 mt-2">Try refreshing or check if you&apos;re using the correct wallet.</p>
            </div>
          )}
        </Panel>
      )}

      {!isLoadingClubs && hasAttemptedFetch && filteredClubs.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClubs.map((clubData) => {
            const club = clubData.club;
            return (
              <div
                key={club.id}
                className="group relative flex flex-col overflow-hidden rounded-[22px] border border-line bg-panel/92 backdrop-blur-md cursor-pointer transition-colors hover:border-line-hover"
                onClick={() => router.push(`/clubs/${club.id}`)}
              >
                <div className="h-1" style={{ background: club.mainColor }} />

                {/* Club Header */}
                <div
                  className="flex items-center gap-3.5 px-5 pt-5 pb-4"
                  style={{ background: `linear-gradient(160deg, color-mix(in srgb, ${club.mainColor} 16%, transparent), transparent 70%)` }}
                >
                  <div
                    className="flex-none grid place-items-center w-10 h-12 [clip-path:polygon(50%_0,100%_14%,100%_55%,50%_100%,0_55%,0_14%)]"
                    style={{ background: club.secondaryColor || club.mainColor }}
                    aria-hidden="true"
                  >
                    <div
                      className="w-8 h-[38px] [clip-path:polygon(50%_0,100%_14%,100%_55%,50%_100%,0_55%,0_14%)]"
                      style={{ background: club.mainColor }}
                    />
                  </div>
                  <div className="flex flex-col gap-1 min-w-0">
                    <h3 className="m-0 font-display text-xl font-bold tracking-[-0.01em] text-fg truncate transition-colors group-hover:text-accent-ink">
                      {clubsService.formatClubName(club)}
                    </h3>
                    <p className="m-0 text-[13px] font-medium text-muted truncate">
                      {clubsService.formatCityCountry(club)}
                    </p>
                  </div>
                </div>

                {/* Club Details */}
                <div className="flex flex-col gap-4 px-5 pb-5">
                  {/* Division */}
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[13px] font-semibold text-muted">
                      Division
                    </span>
                    <span
                      className={`inline-flex items-center h-6 px-2.5 rounded-full text-[11px] font-bold whitespace-nowrap ${clubsService.getDivisionColor(club.division)}`}
                    >
                      {clubsService.getDivisionName(club.division)}
                    </span>
                  </div>

                  {/* Competitions */}
                  <div className="flex flex-col gap-2 pt-4 border-t border-divider">
                    <h4 className="m-0 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-2">
                      Competitions
                    </h4>
                    <div className="flex flex-col gap-1.5">
                      {clubData.competitions.map((competition) => (
                        <div
                          key={competition.id}
                          className="flex items-center gap-2 text-[13px] font-medium text-muted"
                        >
                          <span aria-hidden="true">
                            {clubsService.getCompetitionTypeIcon(competition.type)}
                          </span>
                          <span className="text-fg-4">
                            {competition.name}
                          </span>
                          <span className="text-xs text-muted-3">
                            ({competition.code})
                          </span>
                        </div>
                      ))}
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
