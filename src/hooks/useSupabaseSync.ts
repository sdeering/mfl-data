'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { supabaseSyncService, type SyncProgress } from '../services/clientSyncService'
import { useWallet } from '../contexts/WalletContext'

// Sync status rows can be wallet-scoped (format: type:wallet); unscoped rows are global
const isStatusForWallet = (dataType: string, walletAddress: string) => {
  const parts = dataType.split(':')
  return parts.length === 1 || parts[parts.length - 1].toLowerCase() === walletAddress.toLowerCase()
}

export const useSupabaseSync = () => {
  const [progress, setProgress] = useState<SyncProgress[]>([])
  const [isSyncing, setIsSyncing] = useState(false)
  const hasAutoSyncedRef = useRef(false)
  const syncInProgressRef = useRef(false)
  const { account, isConnected } = useWallet()
  const pathname = usePathname()

  const finishSync = useCallback(() => {
    syncInProgressRef.current = false
    setIsSyncing(false)
  }, [])

  // Start sync process. The server ignores the request if a sync is already running,
  // so calling this mid-sync (e.g. after a reload) just attaches to the running sync.
  const startSync = useCallback(async (forceRefresh = false) => {
    if (!account || !isConnected) {
      console.warn('Cannot start sync: wallet not connected')
      return
    }

    if (syncInProgressRef.current) return

    syncInProgressRef.current = true
    setIsSyncing(true)
    setProgress([])

    try {
      const canConnect = await supabaseSyncService.testConnection()
      if (!canConnect) {
        throw new Error('Cannot connect to data service. Please check your connection and try again.')
      }

      await supabaseSyncService.syncAllData(account, {
        forceRefresh,
        onProgress: (progressUpdate) => {
          setProgress(prev => {
            const existingIndex = prev.findIndex(p => p.dataType === progressUpdate.dataType)
            if (existingIndex >= 0) {
              const updated = [...prev]
              updated[existingIndex] = progressUpdate
              return updated
            }
            return [...prev, progressUpdate]
          })
        },
        onComplete: finishSync,
        onError: (error) => {
          console.error('Sync error:', error)
          finishSync()
        }
      })
    } catch (error) {
      console.error('Sync failed:', error)
      finishSync()
    }
  }, [account, isConnected, finishSync])

  // Stop the running sync
  const stopSync = useCallback(() => {
    supabaseSyncService.stopSync()
    finishSync()
    setProgress([])
  }, [finishSync])

  // Auto-sync when wallet connects (only once per session)
  useEffect(() => {
    // Don't auto-sync on test pages
    const isTestPage = pathname?.includes('/sync-test') || pathname?.includes('/cache-test') || pathname?.includes('/supabase-test')
    if (!isConnected || !account || isTestPage || hasAutoSyncedRef.current) return

    // Set when the effect re-runs or unmounts mid-check; the next run redoes the check
    let cancelled = false

    const checkAndSync = async () => {
      let isUpToDate = false
      try {
        const syncStatus = (await supabaseSyncService.getSyncStatus())
          .filter(status => isStatusForWallet(status.dataType, account))
        isUpToDate = syncStatus.length > 0 && syncStatus.every(status =>
          status.progress === 100 && status.status === 'completed'
        )
      } catch (error) {
        console.warn('Failed to check sync status, starting sync anyway:', error)
      }
      if (cancelled) return

      hasAutoSyncedRef.current = true
      if (!isUpToDate) startSync()
    }

    checkAndSync()

    return () => {
      cancelled = true
    }
  }, [isConnected, account, pathname, startSync])

  // Stop sync when user disconnects
  useEffect(() => {
    if (isConnected && account) return

    if (syncInProgressRef.current) {
      supabaseSyncService.cancelSync()
      finishSync()
      setProgress([])
    }
    // Allow auto-sync again on the next connect
    hasAutoSyncedRef.current = false
  }, [isConnected, account, finishSync])

  // Retry failed sync
  const retrySync = useCallback(() => {
    startSync(true) // Force refresh on retry
  }, [startSync])

  return {
    progress,
    isSyncing,
    startSync,
    stopSync,
    retrySync
  }
}
