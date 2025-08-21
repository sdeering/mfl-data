"use client";

import React, { useCallback, useState } from 'react';
import { searchMFLPlayerById } from '@/src/services/mflApi';
import type { MFLPlayer } from '@/src/types/player';
import PlayerDetails from '@/src/components/PlayerDetails';

export const PlayerSearch: React.FC = () => {
  const [playerId, setPlayerId] = useState('');
  const [player, setPlayer] = useState<MFLPlayer | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSearch = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    setPlayer(null);
    try {
      const result = await searchMFLPlayerById(playerId.trim());
      setPlayer(result);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [playerId]);

  return (
    <div className="max-w-xl">
      <label htmlFor="player-id" className="block text-sm font-medium">Player ID</label>
      <input
        id="player-id"
        value={playerId}
        onChange={(e) => setPlayerId(e.target.value)}
        placeholder="e.g. 116267"
        className="mt-1 w-full rounded border px-3 py-2 text-sm"
      />

      <button
        onClick={onSearch}
        className="mt-3 rounded bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        disabled={!playerId || isLoading}
      >
        Search
      </button>

      <PlayerDetails player={player} isLoading={isLoading} error={error} />
    </div>
  );
};

export default PlayerSearch;



