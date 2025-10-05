import { Suspense } from 'react';
import PlayerResultsPage from '@/src/components/PlayerResultsPage';

interface PlayerPageProps {
  params: {
    playerId: string;
  };
}

export default async function PlayerPage({ params }: PlayerPageProps) {
  const { playerId } = await params;

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PlayerResultsPage propPlayerId={playerId} />
    </Suspense>
  );
}
