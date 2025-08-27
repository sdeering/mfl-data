"use client";

import React from 'react';
import type { MFLPlayer } from '@/src/types/mflApi';
import { getCountryFlag } from '@/src/utils/countryFlags';
import { useTheme } from '../contexts/ThemeContext';

interface PlayerImageProps {
  player?: MFLPlayer;
}

const getBackgroundImage = (overall: number): string => {
  if (overall >= 95) return 'https://d13e14gtps4iwl.cloudfront.net/players/v2/_elements/ultimate-bg.webp';
  if (overall >= 85) return 'https://d13e14gtps4iwl.cloudfront.net/players/v2/_elements/legendary-bg.webp';
  if (overall >= 75) return 'https://d13e14gtps4iwl.cloudfront.net/players/v2/_elements/rare-bg.webp';
  if (overall >= 65) return 'https://d13e14gtps4iwl.cloudfront.net/players/v2/_elements/uncommon-bg.webp';
  if (overall >= 55) return 'https://d13e14gtps4iwl.cloudfront.net/players/v2/_elements/limited-bg.webp';
  return 'https://d13e14gtps4iwl.cloudfront.net/players/v2/_elements/common-bg.webp';
};

const getRatingTextColor = (overall: number): string => {
  if (overall >= 95) return 'url(#v2-text-ultimate)'; // Ultimate
  if (overall >= 85) return 'url(#v2-text-legendary)'; // Legendary
  if (overall >= 75) return 'url(#v2-text-rare)'; // Rare
  if (overall >= 65) return 'url(#v2-text-uncommon)'; // Uncommon
  if (overall >= 55) return 'url(#v2-text-limited)'; // Limited
  return 'url(#v2-text-common)'; // Common
};

export default function PlayerImage({ player }: PlayerImageProps) {
  const {
    metadata: {
      firstName,
      lastName,
      overall,
      nationalities
    }
  } = player;

  const playerName = `${firstName} ${lastName}`;
  const countryFlag = nationalities?.[0] ? getCountryFlag(nationalities[0]) : null;

  if (!player) {
    return (
      <div className="w-40 sm:w-[280px] md:w-[280px] xl:w-[280px] mb-2">
        <div className="bg-white dark:bg-gray-800 p-6 h-[500px] flex items-center justify-center">
          <div className="text-center">
            <div className="w-24 h-24 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-600 dark:to-gray-700 mx-auto mb-4 flex items-center justify-center rounded-xl shadow-inner">
              <span className="text-gray-500 dark:text-gray-400 text-2xl font-light">?</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white bg-gradient-to-r from-gray-600 to-gray-800 dark:from-gray-300 dark:to-gray-100 bg-clip-text text-transparent">
              No Player Data
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              Search for a player to view their card
            </p>
          </div>
        </div>
      </div>
    );
  }

  const photoUrl = `https://d13e14gtps4iwl.cloudfront.net/players/v2/${player.id}/photo.webp`;
  const backgroundUrl = getBackgroundImage(player.metadata.overall);
  const primaryPosition = player.metadata.positions?.[0] || 'N/A';
  const ratingTextColor = getRatingTextColor(player.metadata.overall);

  return (
    <div className="w-40 sm:w-[280px] md:w-[280px] xl:w-[280px] mb-2">
      {/* Modern container with theme-aware styling */}
      <div className="relative">
        {/* Card container */}
        <div className="relative bg-white dark:bg-gray-900 rounded-xl">
          <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 -14 128.27 214.118" 
        fontFamily="Oxanium, sans-serif" 
        className="uppercase"
      >
        <defs>
          <linearGradient id="v2-text-rare" x1="100%" y1="34%" x2="0%" y2="66%">
            <stop stopColor="#97e5ff" offset="0"></stop>
            <stop stopColor="#1f8eff" offset="0.51"></stop>
            <stop stopColor="#3992ff" offset="1"></stop>
          </linearGradient>
          <linearGradient id="v2-text-legendary" x1="100%" y1="34%" x2="0%" y2="66%">
            <stop stopColor="#fa53ff" offset="0"></stop>
            <stop stopColor="#fa53ff" offset="0.51"></stop>
            <stop stopColor="#fa53ff" offset="1"></stop>
          </linearGradient>
          <linearGradient id="v2-text-ultimate" x1="100%" y1="34%" x2="0%" y2="66%">
            <stop stopColor="#87f6f8" offset="0"></stop>
            <stop stopColor="#87f6f8" offset="0.51"></stop>
            <stop stopColor="#87f6f8" offset="1"></stop>
          </linearGradient>
          <linearGradient id="v2-text-uncommon" x1="100%" y1="34%" x2="0%" y2="66%">
            <stop stopColor="#90ee90" offset="0"></stop>
            <stop stopColor="#32cd32" offset="0.51"></stop>
            <stop stopColor="#228b22" offset="1"></stop>
          </linearGradient>
          <linearGradient id="v2-text-limited" x1="100%" y1="34%" x2="0%" y2="66%">
            <stop stopColor="#ffd700" offset="0"></stop>
            <stop stopColor="#ffa500" offset="0.51"></stop>
            <stop stopColor="#ff8c00" offset="1"></stop>
          </linearGradient>
          <linearGradient id="v2-text-common" x1="100%" y1="34%" x2="0%" y2="66%">
            <stop stopColor="#c0c0c0" offset="0"></stop>
            <stop stopColor="#a0a0a0" offset="0.51"></stop>
            <stop stopColor="#808080" offset="1"></stop>
          </linearGradient>
          <linearGradient id="v2-b">
            <stop offset="0.22" stopColor="#000"></stop>
            <stop offset="1" stopColor="#FFF"></stop>
          </linearGradient>
          <linearGradient id="v2-glass-line" x1="45" x2="71" y1="94" y2="94" gradientUnits="userSpaceOnUse">
            <stop offset="0.08" stopColor="#FFF" stopOpacity="0"></stop>
            <stop offset="0.5" stopColor="#FFF"></stop>
            <stop offset="0.92" stopColor="#FFF" stopOpacity="0"></stop>
          </linearGradient>
          <linearGradient href="#v2-b" id="v2-a" x1="106" x2="106" y1="151" y2="116" gradientUnits="userSpaceOnUse"></linearGradient>
          <mask id="v2-flag-clip" clipPathUnits="userSpaceOnUse">
            <g transform="translate(41.916 35.258)">
              <path fill="#FFF" d="M9 82.227h13.547V88.5c0 2.534-2.547 2.556-2.547 2.556H9Z"></path>
            </g>
          </mask>
          <clipPath id="v2-c" clipPathUnits="userSpaceOnUse">
            <rect width="121.401" height="210.351" x="3.457" y="-70.558" ry="0" fill="#000" stroke="none"></rect>
          </clipPath>
          <clipPath id="v2-f" clipPathUnits="userSpaceOnUse" transform="translate(0 -20)">
            <path d="M77.517 43.88h57.075l4.214 12.707s.577 2.31 3.385 2.31h24.583v123.53H45.31V58.932h24.805s2.406.01 3.087-2.079c.68-2.088 4.315-12.972 4.315-12.972z" fill="#000" stroke="none"></path>
          </clipPath>
          <filter id="v2-e" width="1.048" height="1.048" x="-.024" y="-.024">
            <feGaussianBlur result="fbSourceGraphic" stdDeviation="1.582"></feGaussianBlur>
            <feColorMatrix in="fbSourceGraphic" result="fbSourceGraphicAlpha" values="0 0 0 -1 0 0 0 0 -1 0 0 0 0 -1 0 0 0 0 1 0"></feColorMatrix>
            <feColorMatrix in="fbSourceGraphic" result="fbSourceGraphic" values="-10 -10 -10 -10 0 -10 -10 -10 -10 0 -10 -10 -10 -10 0 0 0 0 1 0"></feColorMatrix>
            <feColorMatrix in="fbSourceGraphic" result="fbSourceGraphicAlpha" values="0 0 0 -1 0 0 0 0 -1 0 0 0 0 -1 0 0 0 0 1 0"></feColorMatrix>
            <feColorMatrix in="fbSourceGraphic" values="-10 -10 -10 -10 0 -10 -10 -10 -10 0 -10 -10 -10 -10 0 0 0 0 1 0"></feColorMatrix>
          </filter>
          <mask id="v2-d">
            <rect width="121.401" height="169" x="45.304" y="-14" fill="url(#v2-a)" stroke="none"></rect>
          </mask>
          <clipPath id="v2-glass-mask" clipPathUnits="userSpaceOnUse">
            <path d="M45.256 60.348h24.66s.734-.018 1.466-.286c.522-.191-.021 75.477-.021 75.477H45.256Z"></path>
          </clipPath>
          <linearGradient id="v2-glass-bg" x1="57.988" x2="57.988" y1="109.507" y2="84.028" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#8f8f8f" stopOpacity=".65"></stop>
            <stop offset=".6" stopColor="#888" stopOpacity=".4"></stop>
            <stop offset="1" stopColor="#fff" stopOpacity=".09"></stop>
          </linearGradient>
          <linearGradient id="v2-glass-border" x1="57.988426" y1="109.63931" x2="57.988426" y2="83.896194" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFF" stopOpacity="0.6" offset="0"></stop>
            <stop stopColor="#FFF" stopOpacity="0.16" offset="1"></stop>
          </linearGradient>
          <linearGradient id="v2-photo-mask-gradient" gradientUnits="userSpaceOnUse" gradientTransform="matrix(1,0,0,1.25,0,-32.9)" x1="64.1" y1="173.75" x2="64.1" y2="50.85">
            <stop stopColor="#FFF" offset="0.45"></stop>
            <stop stopColor="#FFF" stopOpacity="0" offset="0.62"></stop>
          </linearGradient>
          <mask maskUnits="userSpaceOnUse" id="v2-photo-mask">
            <g transform="translate(41.915516,35.258179)">
              <path fill="#FFF" d="m 45.249161,59.87824 h 25.478533 v 63.87393 c -0.0057,5.36472 -4.453311,9.89206 -9.6102,9.87001 -4.898883,0.0789 -15.867979,0 -15.867979,0 0.005,-24.58297 -3.44e-4,-49.160854 -3.44e-4,-73.74394 z" transform="translate(-41.915517,-55.258179)"></path>
              <rect fill="url(#v2-photo-mask-gradient)" width="123" height="53.018681" x="2.6" y="80.6"></rect>
            </g>
          </mask>
          <filter id="v2-photo-blur" x="-0.015578374" y="-0.015578374" width="1.0311567" height="1.0311567">
            <feGaussianBlur stdDeviation="1.0301174"></feGaussianBlur>
          </filter>
        </defs>
        
        <g transform="translate(-41.916 -35.258)">
          <image href={backgroundUrl} width="128.27" height="194.818" x="41.916" y="40.558" preserveAspectRatio="none" className="v2-bg"></image>
          
          <g transform="translate(0 20)" className="v2-photo">
            <g clipPath="url(#v2-c)" transform="translate(41.916 56.558)">
              <g mask="url(#v2-d)" transform="translate(-41.916 -56.558)">
                <image href={photoUrl} height="160" width="160" x="32.766" y="0" clipPath="url(#v2-f)" preserveAspectRatio="none" opacity="0.42" filter="url(#v2-e)"></image>
                <image href={photoUrl} height="160" width="160" x="26.066" y="2.6" preserveAspectRatio="none" filter="brightness(1.1)"></image>
                <image href={photoUrl} height="160" width="160" x="26.066" y="2.6" preserveAspectRatio="none" mask="url(#v2-photo-mask)" filter="url(#v2-photo-blur)" className="v2-photo-blur"></image>
              </g>
            </g>
          </g>
          
          <g clipPath="url(#v2-glass-mask)">
            <g className="v2-glass">
              <path d="M45.25 59.878h25.478v63.874c-.006 5.365-4.454 9.892-9.61 9.87-4.9.08-15.868 0-15.868 0 .005-24.583 0-49.16 0-73.744z" fill="url(#v2-glass-bg)" stroke="url(#v2-glass-border)" strokeWidth="0.26"></path>
              <path d="M45.27 94h25.3" stroke="url(#v2-glass-line)" strokeOpacity="0.5" strokeWidth="0.26"></path>
              <text>
                <tspan x="57.94" y="74" fontSize="17.1" fontWeight="600" fill={ratingTextColor} dominantBaseline="middle" textAnchor="middle" className="v2-ovr">{player.metadata.overall}</tspan>
              </text>
              <text>
                <tspan x="57.94" y="87" fontSize="8.3" fontWeight="600" fill="#FFF" dominantBaseline="middle" textAnchor="middle" className="v2-position">{primaryPosition}</tspan>
              </text>
              <g className="v2-age-group">
                <text>
                  <tspan x="57.94" y="102" fontSize="4.4" fontWeight="500" fill="#FFF" dominantBaseline="middle" textAnchor="middle">age</tspan>
                </text>
                <text>
                  <tspan x="57.94" y="109.5" fontSize="9" fontWeight="500" fill="#FFF" dominantBaseline="middle" textAnchor="middle">{player.metadata.age}</tspan>
                </text>
              </g>
              <image href={`https://app.playmfl.com/img/flags/${nationalities?.[0]}.svg`} width="13.3" height="8.8" preserveAspectRatio="none" y="117.7" x="51.2" className="v2-nationality" mask="url(#v2-flag-clip)"></image>
            </g>
          </g>
        </g>
        
        <g transform="translate(0, 122)">
          <g className="v2-names">
            <text className="v2-fn">
              <tspan x="64.2" y="0" dominantBaseline="middle" textAnchor="middle" fill="#FFF" fontWeight="400" fontSize="12.3">{firstName}</tspan>
            </text>
            <text className="v2-ln">
              <tspan x="64.2" y="12.5" dominantBaseline="middle" textAnchor="middle" fill={ratingTextColor} style={{fontWeight: 600, fontSize: 14.2}}>{lastName}</tspan>
            </text>
          </g>
        </g>
        
        <g fill="#FFF" className="v2-stats">
          <path d="M64.2 146.8v28.5" stroke="#175BD6" strokeWidth="0.35"></path>
          <text className="v2-pace" fontSize="8.7" dominantBaseline="middle">
            <tspan x="31.999999999999996" y="150.2" fontWeight="600" textAnchor="end">{player.metadata.pace || 0}</tspan>
            <tspan x="34.8" y="150.2" fontWeight="300">pac</tspan>
          </text>
          <text className="v2-shooting" fontSize="8.7" dominantBaseline="middle">
            <tspan x="31.999999999999996" y="161.5" fontWeight="600" textAnchor="end">{player.metadata.shooting || 0}</tspan>
            <tspan x="34.8" y="161.5" fontWeight="300">sho</tspan>
          </text>
          <text className="v2-passing" fontSize="8.7" dominantBaseline="middle">
            <tspan x="31.999999999999996" y="172.79999999999998" fontWeight="600" textAnchor="end">{player.metadata.passing || 0}</tspan>
            <tspan x="34.8" y="172.79999999999998" fontWeight="300">pas</tspan>
          </text>
          <text className="v2-dribbling" fontSize="8.7" dominantBaseline="middle">
            <tspan x="86.5" y="150.2" fontWeight="600" textAnchor="end">{player.metadata.dribbling || 0}</tspan>
            <tspan x="89.3" y="150.2" fontWeight="300">dri</tspan>
          </text>
          <text className="v2-defense" fontSize="8.7" dominantBaseline="middle">
            <tspan x="86.5" y="161.5" fontWeight="600" textAnchor="end">{player.metadata.defense || 0}</tspan>
            <tspan x="89.3" y="161.5" fontWeight="300">def</tspan>
          </text>
          <text className="v2-physical" fontSize="8.7" dominantBaseline="middle">
            <tspan x="86.5" y="172.79999999999998" fontWeight="600" textAnchor="end">{player.metadata.physical || 0}</tspan>
            <tspan x="89.3" y="172.79999999999998" fontWeight="300">phy</tspan>
          </text>
        </g>
          </svg>
        </div>
      </div>
    </div>
  );
};
