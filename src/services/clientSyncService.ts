import type { SyncStatus } from '../lib/database'

export interface SyncProgress {
  dataType: string
  status: SyncStatus
  progress: number
  message: string
  error?: string
}

export interface SyncOptions {
  forceRefresh?: boolean
  onProgress?: (progress: SyncProgress) => void
  onComplete?: () => void
  onError?: (error: Error) => void
}

class ClientSyncService {
  private pollInterval: NodeJS.Timeout | null = null

  async syncAllData(walletAddress: string, options: SyncOptions = {}) {
    try {
      const res = await fetch('/api/data/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, options: { forceRefresh: options.forceRefresh } })
      })
      if (!res.ok) throw new Error('Failed to start sync')

      // Start polling for progress if callback provided
      if (options.onProgress) {
        this.startPolling(options)
      }
    } catch (error) {
      if (options.onError) options.onError(error instanceof Error ? error : new Error(String(error)))
    }
  }

  private startPolling(options: SyncOptions) {
    this.stopPolling()
    this.pollInterval = setInterval(async () => {
      try {
        const progress = await this.getCurrentProgress()
        if (progress.length > 0 && options.onProgress) {
          progress.forEach(p => options.onProgress!(p))
        }
        // Check if all completed
        const syncing = await this.isSyncInProgress()
        if (!syncing) {
          this.stopPolling()
          if (options.onComplete) options.onComplete()
        }
      } catch {}
    }, 1000)
  }

  private stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
    }
  }

  async getCurrentProgress(): Promise<SyncProgress[]> {
    const res = await fetch('/api/data/sync?action=progress')
    if (!res.ok) return []
    return res.json()
  }

  async isSyncInProgress(): Promise<boolean> {
    const res = await fetch('/api/data/sync?action=isSyncing')
    if (!res.ok) return false
    const data = await res.json()
    return data.isSyncing
  }

  stopSync() {
    this.stopPolling()
    fetch('/api/data/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'stop' })
    }).catch(() => {})
  }

  async getSyncStatus(): Promise<SyncProgress[]> {
    const res = await fetch('/api/data/sync-status')
    if (!res.ok) return []
    return res.json()
  }

  async testConnection(): Promise<boolean> {
    try {
      const res = await fetch('/api/data/db-stats')
      const data = await res.json()
      return data.healthy === true
    } catch { return false }
  }

  isConnectionAvailable(): boolean { return true }
  cancelSync() { this.stopSync() }
}

export const clientSyncService = new ClientSyncService()
export const supabaseSyncService = clientSyncService // backward compat
