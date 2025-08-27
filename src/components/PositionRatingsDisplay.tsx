'use client';

import React from 'react';
import { useScrapedPositionRatings } from '../hooks/useScrapedPositionRatings';
import type { ScrapedPositionRating } from '../types/positionOvr';

interface PositionRatingsDisplayProps {
  player: {
    id: number;
    metadata: {
      firstName: string;
      lastName: string;
      overall: number;
      positions: string[];
    };
  };
}

export default function PositionRatingsDisplay({ player }: PositionRatingsDisplayProps) {
  const { positionRatings, isLoading, error } = useScrapedPositionRatings(player);

  // Loading state
  if (isLoading) {
    return (
      <div className="text-gray-600 dark:text-gray-400 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p>Loading position ratings...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="text-gray-600 dark:text-gray-400 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="text-center">
          <p>No position ratings available</p>
        </div>
      </div>
    );
  }

  // No ratings available
  if (!positionRatings || positionRatings.length === 0) {
    return (
      <div className="text-gray-600 dark:text-gray-400 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="text-center">
          <p>No position ratings available</p>
        </div>
      </div>
    );
  }

  // Sort ratings: Primary first, then Secondary, then by rating (descending)
  const sortedRatings = [...positionRatings].sort((a, b) => {
    const familiarityOrder = { PRIMARY: 0, SECONDARY: 1, UNFAMILIAR: 2 };
    const aOrder = familiarityOrder[a.familiarity as keyof typeof familiarityOrder] ?? 2;
    const bOrder = familiarityOrder[b.familiarity as keyof typeof familiarityOrder] ?? 2;
    
    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }
    
    return b.rating - a.rating;
  });

  return (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
        Position Ratings
      </h3>
      
      <div className="space-y-2">
        {sortedRatings.map((rating: ScrapedPositionRating, index: number) => {
          const isPrimary = rating.familiarity === 'PRIMARY';
          const isSecondary = rating.familiarity === 'SECONDARY';
          
          // Background color based on difference
          let bgColor = 'bg-gray-100 dark:bg-gray-700';
          if (rating.difference > 0) {
            bgColor = 'bg-green-100 dark:bg-green-900/20';
          } else if (rating.difference < 0) {
            bgColor = 'bg-red-100 dark:bg-red-900/20';
          }
          
          // Border color based on familiarity
          let borderColor = 'border-gray-200 dark:border-gray-600';
          if (isPrimary) {
            borderColor = 'border-green-500';
          } else if (isSecondary) {
            borderColor = 'border-orange-500';
          }
          
          // Font size for difference
          let diffFontSize = 'text-sm';
          if (rating.difference > 0) {
            diffFontSize = 'text-base';
          }
          
          return (
            <div
              key={`${rating.position}-${index}`}
              className={`flex items-center justify-between px-3 py-2 rounded-lg border ${bgColor} ${borderColor} transition-all duration-200`}
            >
              <div className="flex items-center space-x-3">
                {/* Position */}
                <span className={`font-semibold text-gray-900 dark:text-white ${
                  isPrimary ? 'text-green-700 dark:text-green-400' : 
                  isSecondary ? 'text-orange-700 dark:text-orange-400' : 
                  'text-gray-700 dark:text-gray-300'
                }`}>
                  {rating.position}
                </span>
                
                {/* Familiarity Badge */}
                {isPrimary && (
                  <span className="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded">
                    Primary
                  </span>
                )}
                {isSecondary && (
                  <span className="px-2 py-1 text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 rounded">
                    Secondary
                  </span>
                )}
              </div>
              
              <div className="flex items-center space-x-3">
                {/* Difference */}
                {rating.difference !== 0 && (
                  <span className={`${diffFontSize} font-medium ${
                    rating.difference > 0 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {rating.difference > 0 ? '+' : ''}{rating.difference}
                  </span>
                )}
                
                {/* Rating */}
                <div className="flex items-center justify-center rounded-md border p-1 text-center font-semibold size-8 text-sm text-[var(--tier-legendary-foreground)] bg-[var(--tier-legendary)] border-[var(--tier-common-foreground)]/15">
                  {rating.rating}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
