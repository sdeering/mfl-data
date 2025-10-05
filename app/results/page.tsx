import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import PlayerResultsPage from '@/src/components/PlayerResultsPage';

interface ResultsPageProps {
  searchParams: { playerId?: string };
}

export default function ResultsPage({ searchParams }: ResultsPageProps) {
  // Redirect to new format if playerId is provided
  if (searchParams.playerId) {
    redirect(`/players/${searchParams.playerId}`);
  }

  // Fallback for when no playerId is provided
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PlayerResultsPage />
    </Suspense>
  );
}
