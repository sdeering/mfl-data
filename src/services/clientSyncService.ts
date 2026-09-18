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

// Stop polling after this many consecutive failed polls so callers don't wait forever
const MAX_POLL_FAILURES = 10
const POLL_INTERVAL_MS = 1000

class ClientSyncService {
  private pollTimeout: NodeJS.Timeout | null = null
  private pollId = 0

  async syncAllData(walletAddress: string, options: SyncOptions = {}) {
    try {
      const res = await fetch('/api/data/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, options: { forceRefresh: options.forceRefresh } })
      })
      if (!res.ok) throw new Error('Failed to start sync')

      this.startPolling(options)
    } catch (error) {
      if (options.onError) options.onError(error instanceof Error ? error : new Error(String(error)))
    }
  }

  private startPolling(options: SyncOptions) {
    this.stopPolling()
    const pollId = this.pollId
    let failures = 0

    // Each poll is scheduled after the previous one settles, so requests never overlap
    const poll = async () => {
      let done = false
      try {
        const { isSyncing, progress } = await this.getSyncState()
        if (pollId !== this.pollId) return
        failures = 0
        const { onProgress } = options
        if (onProgress) progress.forEach(p => onProgress(p))
        if (!isSyncing) {
          done = true
          if (options.onComplete) options.onComplete()
        }
      } catch (error) {
        if (pollId !== this.pollId) return
        failures++
        if (failures >= MAX_POLL_FAILURES) {
          done = true
          if (options.onError) options.onError(error instanceof Error ? error : new Error(String(error)))
        }
      }
      if (!done) this.pollTimeout = setTimeout(poll, POLL_INTERVAL_MS)
    }

    this.pollTimeout = setTimeout(poll, POLL_INTERVAL_MS)
  }

  private stopPolling() {
    this.pollId++
    if (this.pollTimeout) {
      clearTimeout(this.pollTimeout)
      this.pollTimeout = null
    }
  }

  private async getSyncState(): Promise<{ isSyncing: boolean; progress: SyncProgress[] }> {
    const res = await fetch('/api/data/sync?action=state')
    if (!res.ok) throw new Error(`Failed to fetch sync state (${res.status})`)
    const data = await res.json()
    return {
      isSyncing: data.isSyncing === true,
      progress: Array.isArray(data.progress) ? data.progress : []
    }
  }

  async getCurrentProgress(): Promise<SyncProgress[]> {
    const res = await fetch('/api/data/sync?action=progress')
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : []
  }

  async isSyncInProgress(): Promise<boolean> {
    const res = await fetch('/api/data/sync?action=isSyncing')
    if (!res.ok) return false
    const data = await res.json()
    return data.isSyncing === true
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
    const data = await res.json()
    return Array.isArray(data) ? data : []
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
