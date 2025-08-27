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
            // Hide the broken image and show a fallback div instead
            (e.target as HTMLImageElement).style.display = 'none';
            const fallbackDiv = document.createElement('div');
            fallbackDiv.className = 'w-32 h-32 rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm';
            fallbackDiv.textContent = 'No Image';
            (e.target as HTMLImageElement).parentNode?.appendChild(fallbackDiv);
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
