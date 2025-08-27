import React from 'react';
import type { MFLPlayer } from '@/src/types/player';

interface PlayerDetailsProps {
  player?: MFLPlayer | null;
  isLoading?: boolean;
  error?: string | null;
}

export const PlayerDetails: React.FC<PlayerDetailsProps> = ({ player, isLoading, error }) => {
  if (isLoading) return <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">Loading…</div>;
  if (error) return <div className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</div>;
  if (!player) return <div className="mt-4 text-sm text-gray-400 dark:text-gray-500">No player selected.</div>;

  return (
    <div className="mt-4 rounded border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800">
      <div className="flex items-center gap-4">
        {player.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={player.thumbnail} alt={player.name} className="h-16 w-16 rounded object-cover" />
        ) : (
          <div className="h-16 w-16 rounded bg-gray-200 dark:bg-gray-700" />
        )}
        <div>
          <div className="text-lg font-semibold text-gray-900 dark:text-white">{player.name}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">ID: {player.id}{player.owner ? ` • Owner: ${player.owner}` : ''}</div>
        </div>
      </div>
      {player.description && <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">{player.description}</p>}
    </div>
  );
};

export default PlayerDetails;



