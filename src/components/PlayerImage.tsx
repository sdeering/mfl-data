"use client";

import React from 'react';
import type { MFLPlayer } from '../types/mflApi';

interface PlayerImageProps {
  player: MFLPlayer;
}

const PlayerImage: React.FC<PlayerImageProps> = ({ player }) => {
  // Try different MFL image URL formats
  const imageUrl = `https://d13e14gtps4iwl.cloudfront.net/players/v2/${player.id}/photo.webp`;
  
  // Debug: log the player ID and URL
  console.log('Player ID:', player.id);
  console.log('Image URL:', imageUrl);

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Player Image */}
      <div className="relative">
        <img
          src={imageUrl}
          alt={`${player.metadata.firstName} ${player.metadata.lastName}`}
          className="w-32 h-32 rounded-lg object-cover border-2 border-gray-200 dark:border-gray-700"
          onError={(e) => {
            console.log('Image failed to load:', imageUrl);
            // Hide the broken image and show a fallback div instead
            (e.target as HTMLImageElement).style.display = 'none';
            const fallbackDiv = document.createElement('div');
            fallbackDiv.className = 'w-32 h-32 rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 flex items-center justify-center';
            fallbackDiv.innerHTML = `
              <div class="text-center">
                <div class="text-gray-400 dark:text-gray-500 text-4xl mb-2">👤</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">No Image</div>
              </div>
            `;
            (e.target as HTMLImageElement).parentNode?.appendChild(fallbackDiv);
          }}
          onLoad={() => {
            console.log('Image loaded successfully:', imageUrl);
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
