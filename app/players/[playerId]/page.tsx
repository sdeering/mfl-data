import { Suspense } from 'react';
import PlayerResultsPage from '@/src/components/PlayerResultsPage';
import { mflApi } from '@/src/services/mflApi';

interface PlayerPageProps {
  params: {
    playerId: string;
  };
}

async function getPlayerData(playerId: string) {
  try {
    const player = await mflApi.getPlayer(playerId);
    return { player, error: null };
  } catch {
    return { player: null, error: 'Player not found' };
  }
}

export default async function PlayerPage({ params }: PlayerPageProps) {
  const { playerId } = await params;
  await getPlayerData(playerId);

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PlayerResultsPage propPlayerId={playerId} />
    </Suspense>
  );
}
