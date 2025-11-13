'use client'

import React, { useState, useEffect } from 'react'
import { useWallet } from '../contexts/WalletContext'
import { supabaseSyncService, type SyncProgress } from '../services/supabaseSyncService'

interface GlobalSyncProgressProps {
  isVisible: boolean
  isSyncing: boolean
  onClose: () => void
}

export const GlobalSyncProgress: React.FC<GlobalSyncProgressProps> = ({ isVisible, isSyncing, onClose }) => {
  const { account } = useWallet()
  const [progress, setProgress] = useState<SyncProgress[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isMinimized, setIsMinimized] = useState(true)

  const [hasInitialized, setHasInitialized] = useState(false)

  useEffect(() => {
    if (!isVisible) {
      console.log('🔄 GlobalSyncProgress: Component becoming invisible, resetting state');
      setIsLoading(true)
      setHasInitialized(false)
      setProgress([])
      setIsMinimized(true) // Keep dialog minimized by default when hidden
      return
    }
    
    console.log('🔄 GlobalSyncProgress: Component becoming visible, isMinimized:', isMinimized);

    // Auto-close after 5 seconds if manually triggered but no sync is active
    const autoCloseTimeout = setTimeout(() => {
      if (isVisible && !isSyncing && hasInitialized && progress.length === 0) {
        console.log('🔄 Auto-closing sync progress - timeout (no active sync)')
        onClose()
      }
    }, 5000)

    // Get initial sync status
    const fetchSyncStatus = async () => {
      try {
        const status = await supabaseSyncService.getSyncStatus()
        // Only show status if there's an active sync or recent completed syncs (within last 5 minutes)
        let recentStatus = status.filter(item => {
          if (item.status === 'in_progress') return true
          if (item.status === 'completed' && item.dataType !== 'sync_error') {
            // Check if this is a recent completion (within last 5 minutes)
            // For now, we'll show all completed statuses, but this could be filtered by timestamp
            return true
          }
          return false
        })
        
        // Filter by logged-in wallet if dataType is wallet-scoped (format: type:wallet)
        if (account) {
          const walletLc = account.toLowerCase()
          recentStatus = recentStatus.filter(item => {
            const parts = item.dataType.split(':')
            if (parts.length > 1) {
              return parts[parts.length - 1].toLowerCase() === walletLc
            }
            // Keep global statuses
            return true
          })
        }
        
        // Check if all items are 100% complete and there are no errors
        const allCompleted = recentStatus.length > 0 && recentStatus.every(item => 
          item.progress === 100 && item.status === 'completed'
        )
        const hasErrors = recentStatus.some(item => item.status === 'failed')
        
        // Only set progress if not all items are complete or there are errors
        if (!allCompleted || hasErrors) {
          setProgress(recentStatus)
        } else {
          // If all items are complete and no errors, hide the display
          setProgress([])
          onClose()
        }
        setIsLoading(false)
        setHasInitialized(true)
      } catch (error) {
        console.warn('Failed to fetch initial sync status:', error)
        setIsLoading(false)
        setHasInitialized(true)
      }
    }

    fetchSyncStatus()

    // Set up interval to update progress (reduced frequency to 3 seconds)
    const interval = setInterval(() => {
      const currentProgress = supabaseSyncService.getCurrentProgress()
      if (currentProgress.length > 0) {
        // Merge with existing progress, keeping new items at the top
        setProgress(prev => {
          const merged = [...currentProgress]
          // Add any existing items that aren't in current progress (to maintain order)
          prev.forEach(existing => {
            if (!merged.find(item => item.dataType === existing.dataType)) {
              merged.push(existing)
            }
          })
          return merged
        })
        setIsLoading(false)
      }
      
      const syncing = supabaseSyncService.isSyncInProgress()
      
      // Check if all items are completed and auto-close
      const allCompleted = currentProgress.length > 0 && currentProgress.every(p => p.progress === 100 && p.status === 'completed')
      const hasErrors = currentProgress.some(p => p.status === 'failed')
      
      // If sync is not in progress and we have no progress data, hide the component
      if (!syncing && currentProgress.length === 0 && hasInitialized) {
        onClose()
      }
      
      // Auto-close when all items are completed (unless there are errors)
      if (allCompleted && !hasErrors && hasInitialized) {
        console.log('🔄 Auto-closing sync progress - all completed')
        onClose()
      }
    }, 3000) // Reduced from 1000ms to 3000ms (3 seconds)

    return () => {
      clearInterval(interval)
      clearTimeout(autoCloseTimeout)
    }
  }, [isVisible, hasInitialized, onClose, isSyncing, progress.length])


  // Don't show if not visible or still loading initial data
  if (!isVisible || isLoading) {
    return null
  }
  
  // If manually triggered (isVisible is true), always show the component
  // This ensures the sync dialog appears immediately when user clicks sync
  if (isVisible) {
    // Show the component
  } else {
    // Don't show if we have no progress data and no active sync (for auto-sync)
    if (progress.length === 0 && !isSyncing && hasInitialized) {
      return null
    }
  }
  
  // Don't show if all sync items are 100% complete (unless there are errors)
  const allCompleted = progress.length > 0 && progress.every(p => p.progress === 100 && p.status === 'completed')
  const hasErrors = progress.some(p => p.status === 'failed')
  if (allCompleted && !hasErrors) {
    return null
  }

  const totalProgress = progress.length > 0 
    ? Math.round(progress.reduce((sum, p) => sum + p.progress, 0) / progress.length)
    : 0

  const isCompleted = progress.length > 0 && progress.every(p => p.status === 'completed')
  const isInProgress = progress.some(p => p.status === 'in_progress')
  
  // If we have no progress data but sync is in progress, show a loading state
  const showLoadingState = progress.length === 0 && isSyncing

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 shadow-lg">
      <div className="max-w-4xl mx-auto p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              {isInProgress && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              )}
              {isCompleted && (
                <div className="h-4 w-4 rounded-full bg-green-500 flex items-center justify-center">
                  <svg className="h-2 w-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
              {hasErrors && (
                <div className="h-4 w-4 rounded-full bg-red-500 flex items-center justify-center">
                  <svg className="h-2 w-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {isInProgress ? 'Syncing Data from MFL.com' : 
               isCompleted ? 'Data Sync Completed' : 
               hasErrors ? 'Sync Completed with Errors' : 'Data Sync Status'}
            </h3>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {totalProgress}%
            </span>
            {isInProgress && (
              <button
                onClick={() => {
                  supabaseSyncService.stopSync()
                  setIsMinimized(true)
                  // Close the progress display after a short delay
                  setTimeout(() => {
                    onClose()
                  }, 1000)
                }}
                className="px-3 py-1 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                title="Stop Sync"
              >
                Stop Sync
              </button>
            )}
            <button
              onClick={() => {
                console.log('🔄 Minimize button clicked, current state:', isMinimized);
                setIsMinimized(prev => {
                  const newState = !prev;
                  console.log('🔄 Minimize state changing from', prev, 'to', newState);
                  return newState;
                });
              }}
              className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title={isMinimized ? "Maximize" : "Minimize"}
            >
              <svg className="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMinimized ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                )}
              </svg>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <svg className="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Minimized content - only show header and progress bar */}
        {!isMinimized && (
          <>
            {/* Overall Progress Bar */}
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                <span>Overall Progress</span>
                <span>{totalProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    hasErrors ? 'bg-red-500' : 
                    isCompleted ? 'bg-green-500' : 
                    'bg-blue-500'
                  }`}
                  style={{ width: `${totalProgress}%` }}
                />
              </div>
            </div>

            {/* Individual Progress Items */}
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {showLoadingState ? (
                <div className="flex items-center justify-center p-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Starting sync...</span>
                </div>
              ) : (
                progress
                  .sort((a, b) => {
                    // Sort by status priority: in_progress first, then pending, then completed, then failed
                    const statusOrder = { 'in_progress': 0, 'pending': 1, 'completed': 2, 'failed': 3 }
                    const aOrder = statusOrder[a.status as keyof typeof statusOrder] ?? 4
                    const bOrder = statusOrder[b.status as keyof typeof statusOrder] ?? 4
                    
                    if (aOrder !== bOrder) {
                      return aOrder - bOrder
                    }
                    
                    // If same status, sort by progress (higher progress first for completed items)
                    if (a.status === 'completed' && b.status === 'completed') {
                      return b.progress - a.progress
                    }
                    
                    // For other statuses, sort by progress (lower progress first)
                    return a.progress - b.progress
                  })
                  .map((item, index) => (
                    <div 
                      key={`${item.dataType}-${index}`} 
                      className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg transition-all duration-300"
                    >
                      <div className="flex items-center space-x-3 flex-1">
                        <div className="flex items-center space-x-2">
                          {item.status === 'in_progress' && (
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                          )}
                          {item.status === 'completed' && (
                            <div className="h-3 w-3 rounded-full bg-green-500"></div>
                          )}
                          {item.status === 'failed' && (
                            <div className="h-3 w-3 rounded-full bg-red-500"></div>
                          )}
                          {item.status === 'pending' && (
                            <div className="h-3 w-3 rounded-full bg-gray-400"></div>
                          )}
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                              {item.dataType.split(':')[0].replace(/_/g, ' ')}
                            </span>
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            {item.message}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {item.progress}%
                        </span>
                        <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                          <div 
                            className={`h-1 rounded-full transition-all duration-300 ${
                              item.status === 'failed' ? 'bg-red-500' : 
                              item.status === 'completed' ? 'bg-green-500' : 
                              'bg-blue-500'
                            }`}
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>

            {/* Error Details */}
            {hasErrors && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="text-sm text-red-800 dark:text-red-200">
                  <strong>Errors occurred during sync:</strong>
                  <ul className="mt-1 space-y-1">
                    {progress
                      .filter(p => p.status === 'failed')
                      .map((item, index) => (
                        <li key={index} className="text-xs">
                          • {item.dataType.split(':')[0].replace(/_/g, ' ')}: {item.error}
                        </li>
                      ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-4 flex justify-end space-x-2">
              {isCompleted && (
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                >
                  Done
                </button>
              )}
              {hasErrors && (
                <button
                  onClick={() => {
                    // Retry sync logic here
                    onClose()
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  Retry
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
