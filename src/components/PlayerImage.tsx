"use client";

import React from 'react';
import type { MFLPlayer } from '../types/mflApi';

interface PlayerImageProps {
  player: MFLPlayer;
}

const PlayerImage: React.FC<PlayerImageProps> = ({ player }) => {
  // Get player image URL
  const imageUrl = `https://app.playmfl.com/players/${player.id}/image`;

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Player Image */}
      <div className="relative">
        <img
          src={imageUrl}
          alt={`${player.metadata.firstName} ${player.metadata.lastName}`}
          className="w-32 h-32 rounded-lg object-cover border-2 border-gray-200 dark:border-gray-700"
          onError={(e) => {
            // Fallback to a placeholder image if the player image fails to load
            (e.target as HTMLImageElement).src = 'https://via.placeholder.com/128x128?text=No+Image';
          }}
        />
      </div>
      
      {/* Player Name */}
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          {player.metadata.firstName} {player.metadata.lastName}
        </h2>
      </div>
    </div>
  );
};

export default PlayerImage;
