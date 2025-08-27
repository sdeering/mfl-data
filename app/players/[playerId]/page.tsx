import PlayerResultsPage from '@/src/components/PlayerResultsPage';
import { mflApi } from '@/src/services/mflApi';

interface PlayerPageProps {
  params: Promise<{
    playerId: string;
  }>;
}

export async function generateMetadata({ params }: PlayerPageProps) {
  try {
    const { playerId } = await params;
    const player = await mflApi.getPlayer(playerId);
    const playerName = `${player.metadata.firstName} ${player.metadata.lastName}`;
    return {
      title: `${playerName} (#${playerId}) - MFL Data`,
      description: `View details for ${playerName} in the Meta Football League (MFL)`,
    };
  } catch (error) {
    return {
      title: 'Player Not Found',
      description: 'Player not found in the Meta Football League (MFL)',
    };
  }
}

export default async function PlayerPage({ params }: PlayerPageProps) {
  const { playerId } = await params;
  return <PlayerResultsPage propPlayerId={playerId} />;
}
