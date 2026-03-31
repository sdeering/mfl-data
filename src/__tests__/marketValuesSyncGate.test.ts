import * as dbHelpers from '../lib/db-helpers'
import { syncService as supabaseSyncService } from '../services/syncService'

// Mock db-helpers
jest.mock('../lib/db-helpers')
const mockDbHelpers = dbHelpers as jest.Mocked<typeof dbHelpers>

// These tests validate that agency player market values do not trigger more than once per 7 days

const TEST_WALLET = '0x1111111111111111'

describe('Agency Market Values 7-day Gate', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('does not start backend sync when last_synced is fresh', async () => {
    const now = new Date().toISOString()
    // Mock db-helpers to return fresh last_synced for sync_status
    mockDbHelpers.selectMaybeOne.mockResolvedValue({ data: { last_synced: now }, error: null })
    mockDbHelpers.selectAll.mockResolvedValue({ data: [], error: null })
    mockDbHelpers.upsertOne.mockResolvedValue({ data: null, error: null })

    const spyFetch: any = jest.spyOn(global as any, 'fetch')
      .mockResolvedValue({ ok: true, json: async () => ({ success: true, activeJobs: [] }) })

    // Call without forceRefresh - should exit early due to freshness gate
    await expect(
      // @ts-ignore - method is private in class, but test calls via any for behavior
      (supabaseSyncService as any).syncAgencyPlayerMarketValues(TEST_WALLET, { forceRefresh: false })
    ).resolves.toBeUndefined()

    // Ensure no POST to start new job happened
    const calls = spyFetch.mock.calls.map((c: any[]) => c[0])
    const startedJob = calls.some((url: string) => typeof url === 'string' && url.includes('/api/sync/player-market-values') )
    expect(startedJob).toBe(false)

    spyFetch.mockRestore()
  })

  test('starts backend sync when forced', async () => {
    // Mock db-helpers to return some agency players so flow proceeds to POST job
    mockDbHelpers.selectMaybeOne.mockResolvedValue({ data: null, error: null })
    mockDbHelpers.selectAll.mockResolvedValue({
      data: [{ mfl_player_id: 123, data: { metadata: { firstName: 'A', lastName: 'B', overall: 80, positions: ['ST'], age: 25, pace: 70, shooting: 70, passing: 70, dribbling: 70, defense: 50, physical: 60, goalkeeping: 1 } } }],
      error: null
    })
    mockDbHelpers.upsertOne.mockResolvedValue({ data: null, error: null })
    mockDbHelpers.upsertMany.mockResolvedValue({ data: null, error: null })

    const started = { posted: false }
    const spyFetch: any = jest.spyOn(global as any, 'fetch')
      .mockImplementation((input: any, init?: any) => {
        const url = typeof input === 'string' ? input : (input?.url || '')
        if (url.includes('/api/sync/player-market-values') && !url.includes('?') && init?.method === 'POST') {
          started.posted = true
          return Promise.resolve({ ok: true, json: async () => ({ jobId: 'job_123' }) })
        }
        // status polling
        if (url.includes('/api/sync/player-market-values?jobId=')) {
          return Promise.resolve({ ok: true, json: async () => ({ status: 'completed', percentage: 1, progress: 1, total: 1, results: [{ success: true }] }) })
        }
        // existing jobs
        if (url.includes('/api/sync/player-market-values?walletAddress=')) {
          return Promise.resolve({ ok: true, json: async () => ({ success: true, activeJobs: [] }) })
        }
        return Promise.resolve({ ok: true, json: async () => ({}) })
      })

    await expect(
      // @ts-ignore - method is private in class, but test calls via any for behavior
      (supabaseSyncService as any).syncAgencyPlayerMarketValues(TEST_WALLET, { forceRefresh: true })
    ).resolves.toBeUndefined()

    expect(started.posted).toBe(true)
    spyFetch.mockRestore()
  })
})


