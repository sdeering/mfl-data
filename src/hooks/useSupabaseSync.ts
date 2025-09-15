'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { supabaseSyncService, type SyncProgress } from '../services/supabaseSyncService'
import { useWallet } from '../contexts/WalletContext'

export const useSupabaseSync = () => {
  const [isVisible, setIsVisible] = useState(false)
  const [progress, setProgress] = useState<SyncProgress[]>([])
  const [isSyncing, setIsSyncing] = useState(false)
  const hasAutoSyncedRef = useRef(false)
  const syncInProgressRef = useRef(false)
  const autoSyncTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Cross-tab sync coordination
  const AUTO_SYNC_KEY = 'mfl-auto-sync-status'
  const AUTO_SYNC_TIMEOUT = 30000 // 30 seconds timeout for sync lock
  const { account, isConnected } = useWallet()
  const pathname = usePathname()

  // Cross-tab sync coordination helpers
  const setAutoSyncLock = useCallback((walletAddress: string) => {
    try {
      const lockData = {
        walletAddress,
        timestamp: Date.now(),
        tabId: Math.random().toString(36).substr(2, 9) // Simple tab identifier
      }
      sessionStorage.setItem(AUTO_SYNC_KEY, JSON.stringify(lockData))
    } catch (error) {
      console.warn('Failed to set auto-sync lock:', error)
    }
  }, [])

  const clearAutoSyncLock = useCallback(() => {
    try {
      sessionStorage.removeItem(AUTO_SYNC_KEY)
    } catch (error) {
      console.warn('Failed to clear auto-sync lock:', error)
    }
  }, [])

  const isAutoSyncLocked = useCallback((walletAddress: string) => {
    try {
      const lockData = sessionStorage.getItem(AUTO_SYNC_KEY)
      if (!lockData) return false

      const parsed = JSON.parse(lockData)
      const now = Date.now()
      
      // Check if lock is for the same wallet and not expired
      if (parsed.walletAddress === walletAddress && (now - parsed.timestamp) < AUTO_SYNC_TIMEOUT) {
        return true
      }
      
      // Clean up expired lock
      if ((now - parsed.timestamp) >= AUTO_SYNC_TIMEOUT) {
        clearAutoSyncLock()
      }
      
      return false
    } catch (error) {
      console.warn('Failed to check auto-sync lock:', error)
      return false
    }
  }, [clearAutoSyncLock])

  // Start sync process
  const startSync = useCallback(async (forceRefresh = false, showDisplay = false) => {
    console.log('🚀 startSync called with:', { forceRefresh, showDisplay, account, isConnected, isSyncing })
    if (!account || !isConnected) {
      console.warn('Cannot start sync: wallet not connected')
      return
    }

    if (isSyncing || syncInProgressRef.current) {
      console.log('Sync already in progress, skipping...')
      return
    }

    console.log('🔄 Starting sync process...')
    setIsSyncing(true)
    syncInProgressRef.current = true
    
    // Clear any pending auto-sync timeout
    if (autoSyncTimeoutRef.current) {
      clearTimeout(autoSyncTimeoutRef.current)
      autoSyncTimeoutRef.current = null
    }
    
    // Show sync display if requested (for manual sync from agency page)
    if (showDisplay) {
      console.log('🚀 Setting sync display visible and clearing progress')
      setIsVisible(true)
      setProgress([]) // Clear any existing progress to show fresh state
    }

    try {
      // Check connection first
      const isConnected = await supabaseSyncService.testConnection()
      if (!isConnected) {
        throw new Error('Cannot connect to data service. Please check your connection and try again.')
      }
      
      await supabaseSyncService.syncAllData(account, {
        forceRefresh,
        onProgress: (progressUpdate) => {
          setProgress(prev => {
            const existingIndex = prev.findIndex(p => p.dataType === progressUpdate.dataType)
            if (existingIndex >= 0) {
              // Update existing item
              const updated = [...prev]
              updated[existingIndex] = progressUpdate
              return updated
            } else {
              // Add new item at the top of the list
              return [progressUpdate, ...prev]
            }
          })
        },
        onComplete: () => {
          setIsSyncing(false)
          syncInProgressRef.current = false
          clearAutoSyncLock() // Clear cross-tab lock
          // Keep visible for a few seconds to show completion
          setTimeout(() => {
            setIsVisible(false)
          }, 5000)
        },
        onError: (error) => {
          console.error('Sync error:', error)
          setIsSyncing(false)
          syncInProgressRef.current = false
          clearAutoSyncLock() // Clear cross-tab lock
          // Keep visible to show error
        }
      })
    } catch (error) {
      console.error('Sync failed:', error)
      setIsSyncing(false)
      syncInProgressRef.current = false
      clearAutoSyncLock() // Clear cross-tab lock
    }
  }, [account, isConnected, isSyncing, clearAutoSyncLock])

  // Auto-sync when wallet connects (only once per session)
  useEffect(() => {
    // Don't auto-sync on test pages
    const isTestPage = pathname?.includes('/sync-test') || pathname?.includes('/cache-test') || pathname?.includes('/supabase-test')
    
    // Only run if we have a connected account, not currently syncing, haven't auto-synced yet, and not on a test page
    if (isConnected && account && !isSyncing && !syncInProgressRef.current && !hasAutoSyncedRef.current && !isTestPage && !autoSyncTimeoutRef.current) {
      
      // Check if another tab is already running auto-sync for this wallet
      if (isAutoSyncLocked(account)) {
        console.log('🔄 Auto-sync already running in another tab for wallet:', account)
        // Still show sync status from the other tab
        const checkSyncStatus = async () => {
          try {
            setIsVisible(true)
            const syncStatus = await supabaseSyncService.getSyncStatus()
            setProgress(syncStatus)
          } catch (error) {
            console.warn('Failed to check sync status from other tab:', error)
          }
        }
        checkSyncStatus()
        return
      }
      
      hasAutoSyncedRef.current = true // Mark as attempted immediately
      setAutoSyncLock(account) // Set cross-tab lock
      console.log('🔄 Auto-sync triggered for wallet:', account)
      
      // Add a small delay to prevent multiple rapid executions
      autoSyncTimeoutRef.current = setTimeout(() => {
        // Double-check we haven't already synced (race condition protection)
        if (hasAutoSyncedRef.current && !isSyncing && !syncInProgressRef.current) {
          // Always show sync display and check status
          const checkAndSync = async () => {
            try {
              // Show sync display immediately
              setIsVisible(true)
              
              const syncStatus = await supabaseSyncService.getSyncStatus()
              console.log('🔍 Sync status check:', syncStatus)
              const hasRecentData = syncStatus.some(status => 
                status.status === 'completed' && 
                status.dataType !== 'sync_error'
              )
              
              if (hasRecentData) {
                // Check if all sync items are 100% complete
                const allCompleted = syncStatus.every(status => 
                  status.progress === 100 && status.status === 'completed'
                )
                const hasErrors = syncStatus.some(status => status.status === 'failed')
                
                console.log('📊 Sync status analysis:', {
                  hasRecentData,
                  allCompleted,
                  hasErrors,
                  statusCount: syncStatus.length,
                  statuses: syncStatus.map(s => ({ dataType: s.dataType, status: s.status, progress: s.progress }))
                })
                
                if (allCompleted && !hasErrors) {
                  console.log('✅ All sync items are 100% complete, not showing sync display')
                  // Don't show the sync display if everything is complete
                  setIsVisible(false)
                } else {
                  console.log('⚠️ Recent data found but not all complete, running sync to complete missing data...')
                  // Show current status and run sync to complete missing data
                  setProgress(syncStatus)
                  startSync()
                }
              } else {
                console.log('🔄 No recent data found, starting auto-sync...')
                startSync()
              }
            } catch (error) {
              console.warn('Failed to check sync status, starting sync anyway:', error)
              startSync()
            }
          }
          
          checkAndSync()
        }
      }, 100) // 100ms delay to prevent multiple rapid executions
      
      // Cleanup function to clear timeout
      return () => {
        if (autoSyncTimeoutRef.current) {
          clearTimeout(autoSyncTimeoutRef.current)
          autoSyncTimeoutRef.current = null
        }
      }
    }
  }, [isConnected, account, isSyncing, pathname, isAutoSyncLocked, setAutoSyncLock, clearAutoSyncLock]) // Added cross-tab coordination dependencies

  // Stop sync when user disconnects
  useEffect(() => {
    if (!isConnected || !account) {
      if (isSyncing) {
        console.log('User disconnected, stopping sync...')
        supabaseSyncService.cancelSync()
        setIsSyncing(false)
        setIsVisible(false)
        setProgress([])
      }
      // Reset auto-sync flag when disconnected
      hasAutoSyncedRef.current = false
      clearAutoSyncLock() // Clear cross-tab lock
      if (autoSyncTimeoutRef.current) {
        clearTimeout(autoSyncTimeoutRef.current)
        autoSyncTimeoutRef.current = null
      }
    }
  }, [isConnected, account, isSyncing, clearAutoSyncLock])

  // Update progress from service
  useEffect(() => {
    if (!isVisible) return

    const interval = setInterval(() => {
      const currentProgress = supabaseSyncService.getCurrentProgress()
      const isSyncInProgress = supabaseSyncService.isSyncInProgress()
      
      // Only log and update if there's actual activity
      if (currentProgress.length > 0 || isSyncInProgress) {
        console.log('🔄 Progress update interval - current progress:', currentProgress.length, 'items, sync in progress:', isSyncInProgress)
        if (currentProgress.length > 0) {
          setProgress(currentProgress)
        }
        setIsSyncing(isSyncInProgress)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [isVisible])

  // Close progress indicator
  const closeProgress = useCallback(() => {
    setIsVisible(false)
    setProgress([])
  }, [])

  // Retry failed sync
  const retrySync = useCallback(() => {
    if (account && isConnected) {
      startSync(true) // Force refresh on retry
    }
  }, [account, isConnected, startSync])

  return {
    isVisible,
    progress,
    isSyncing,
    startSync,
    closeProgress,
    retrySync
  }
}
