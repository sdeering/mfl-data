"use client";

import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { PlayerStatsGrid } from './PlayerStatsGrid';
import type { MFLPlayer } from '@/src/types/mflApi';

interface PlayerDetailsCardProps {
  playerName?: string;
  playerId?: string;
  ownerAddress?: string;
  description?: string;
  player?: MFLPlayer;
}

export default function PlayerDetailsCard({ player }: PlayerDetailsCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="flex items-start space-x-6">
        <PlayerImage player={player} />
        <div className="flex-1">
          <PlayerMetadata player={player} />
          <PlayerStats player={player} />
        </div>
      </div>
    </div>
  );
}
