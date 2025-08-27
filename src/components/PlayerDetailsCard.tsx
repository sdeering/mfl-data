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

export const PlayerDetailsCard: React.FC<PlayerDetailsCardProps> = ({
  playerName,
  playerId,
  ownerAddress,
  description,
  player
}) => {
  const { theme } = useTheme();
  
  const handleViewOnMFL = () => {
    if (playerId) {
      window.open(`https://app.playmfl.com/players/${playerId}`, '_blank');
    }
  };

  const handleViewOnMFLPlayer = () => {
    if (playerId) {
      window.open(`https://mflplayer.info/player/${playerId}`, '_blank');
    }
  };

  return (
    <div className="relative group">
      {/* Gradient background glow */}
      <div className="absolute -inset-0.5 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-xl blur opacity-20 group-hover:opacity-30 transition duration-300"></div>
      
      {/* Main card */}
      <div className="relative bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 min-h-[240px] shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.01]">
        <div className="flex justify-between items-start mb-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            {playerName || 'Unknown Player'}
          </h3>
          {playerId && (
            <div className="flex flex-col space-y-2">
              <button
                onClick={handleViewOnMFL}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-medium rounded-lg shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer flex items-center space-x-2 group/btn hover:scale-105"
                style={{
                  '--hover-bg': 'rgb(222, 222, 222)',
                  '--hover-color': 'rgb(39, 39, 39)',
                  '--hover-border': '1px solid rgb(0, 0, 0)'
                } as React.CSSProperties}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgb(222, 222, 222)';
                  e.currentTarget.style.color = 'rgb(39, 39, 39)';
                  e.currentTarget.style.border = '1px solid rgb(0, 0, 0)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '';
                  e.currentTarget.style.color = '';
                  e.currentTarget.style.border = '';
                }}
              >
                <span>View on mfl.com</span>
                <svg className="w-4 h-4 transform group-hover/btn:translate-x-1 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </button>
              <button
                onClick={handleViewOnMFLPlayer}
                className="px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white text-sm font-medium rounded-lg shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer flex items-center space-x-2 group/btn hover:scale-105"
                style={{
                  '--hover-bg': 'rgb(222, 222, 222)',
                  '--hover-color': 'rgb(39, 39, 39)',
                  '--hover-border': '1px solid rgb(0, 0, 0)'
                } as React.CSSProperties}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgb(222, 222, 222)';
                  e.currentTarget.style.color = 'rgb(39, 39, 39)';
                  e.currentTarget.style.border = '1px solid rgb(0, 0, 0)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '';
                  e.currentTarget.style.color = '';
                  e.currentTarget.style.border = '';
                }}
              >
                <span>mflplayer.info</span>
                <svg className="w-4 h-4 transform group-hover/btn:translate-x-1 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </button>
            </div>
          )}
        </div>
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 transition-all duration-200">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">Player name</p>
            <p className="text-gray-900 dark:text-white font-bold text-lg">
              {playerName || 'Unknown Player'}
            </p>
          </div>
          
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 transition-all duration-200">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">Player ID</p>
            <p className="text-gray-900 dark:text-white font-mono text-base font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              {playerId || 'N/A'}
            </p>
          </div>
          
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 transition-all duration-200">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">Owner address</p>
            <p className="text-gray-900 dark:text-white font-mono text-sm break-all leading-relaxed">
              {ownerAddress || 'N/A'}
            </p>
          </div>
          
          {description && (
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 transition-all duration-200">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">Description</p>
              <p className="text-gray-900 dark:text-white text-sm leading-relaxed">
                {description}
              </p>
            </div>
          )}
        </div>
        
        {/* Player Stats Grid */}
        {player && (
          <div className="mt-6">
            <PlayerStatsGrid player={player} />
          </div>
        )}
      </div>
    </div>
  );
};

export default PlayerDetailsCard;
