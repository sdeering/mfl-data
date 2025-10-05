"use client";

import React, { useState, useEffect } from 'react';

interface SyncJob {
  jobId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  total: number;
  percentage: number;
  currentPlayer?: string;
  error?: string;
  results: Array<{ playerId: string; marketValue: number; success: boolean }>;
}

interface MarketValueSyncProgressProps {
  jobId: string | null;
  onComplete?: (results: SyncJob['results']) => void;
  onClose?: () => void;
}

export default function MarketValueSyncProgress({ 
  jobId, 
  onComplete, 
  onClose 
}: MarketValueSyncProgressProps) {
  const [job, setJob] = useState<SyncJob | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!jobId) {
      setIsVisible(false);
      return;
    }

    setIsVisible(true);
    
    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/sync/player-market-values?jobId=${jobId}`);
        if (response.ok) {
          const jobData = await response.json();
          setJob(jobData);
          
          // If completed or failed, stop polling
          if (jobData.status === 'completed' || jobData.status === 'failed') {
            if (jobData.status === 'completed' && onComplete) {
              onComplete(jobData.results);
            }
            return;
          }
          
          // Continue polling every 2 seconds
          setTimeout(pollStatus, 2000);
        }
      } catch (error) {
        console.error('Error polling sync status:', error);
      }
    };

    pollStatus();
  }, [jobId, onComplete]);

  if (!isVisible || !job) {
    return null;
  }

  const getStatusColor = () => {
    switch (job.status) {
      case 'pending': return 'text-yellow-600';
      case 'running': return 'text-blue-600';
      case 'completed': return 'text-green-600';
      case 'failed': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = () => {
    switch (job.status) {
      case 'pending': return '⏳';
      case 'running': return '🔄';
      case 'completed': return '✅';
      case 'failed': return '❌';
      default: return '❓';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Market Value Sync
          </h3>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              ✕
            </button>
          )}
        </div>

        <div className="space-y-4">
          {/* Status */}
          <div className="flex items-center space-x-2">
            <span className="text-2xl">{getStatusIcon()}</span>
            <span className={`font-medium ${getStatusColor()}`}>
              {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${job.percentage}%` }}
            />
          </div>

          {/* Progress Text */}
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {job.progress} of {job.total} players processed ({job.percentage}%)
          </div>

          {/* Current Player */}
          {job.currentPlayer && (
            <div className="text-sm text-gray-700 dark:text-gray-300">
              {job.currentPlayer}
            </div>
          )}

          {/* Error Message */}
          {job.error && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">
              Error: {job.error}
            </div>
          )}

          {/* Results Summary */}
          {job.status === 'completed' && job.results.length > 0 && (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <div className="flex justify-between">
                <span>Successful: {job.results.filter(r => r.success).length}</span>
                <span>Failed: {job.results.filter(r => !r.success).length}</span>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex justify-end space-x-2">
          {job.status === 'completed' && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Done
            </button>
          )}
          {job.status === 'failed' && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
