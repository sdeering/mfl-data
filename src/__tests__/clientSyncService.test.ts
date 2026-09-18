import { clientSyncService, type SyncProgress } from '../services/clientSyncService'

// These tests validate the client-side sync polling: progress is forwarded, polling ends
// when the server reports the sync finished, and it can't get stuck polling forever

const TEST_WALLET = '0x1111111111111111'

const progressItem = (status: SyncProgress['status'], progress: number): SyncProgress => ({
  dataType: 'agency_players',
  status,
  progress,
  message: 'test'
})

const jsonResponse = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => body })

describe('clientSyncService polling', () => {
  let fetchMock: jest.Mock

  beforeEach(() => {
    jest.useFakeTimers()
    fetchMock = jest.fn()
    ;(global as any).fetch = fetchMock
  })

  afterEach(() => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true }))
    clientSyncService.stopSync()
    jest.useRealTimers()
  })

  test('forwards progress and completes when the server stops syncing', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ success: true })) // POST start
      .mockResolvedValueOnce(jsonResponse({ isSyncing: true, progress: [progressItem('in_progress', 40)] }))
      .mockResolvedValueOnce(jsonResponse({ isSyncing: false, progress: [progressItem('completed', 100)] }))

    const onProgress = jest.fn()
    const onComplete = jest.fn()
    await clientSyncService.syncAllData(TEST_WALLET, { onProgress, onComplete })

    await jest.advanceTimersByTimeAsync(1000)
    expect(onProgress).toHaveBeenLastCalledWith(progressItem('in_progress', 40))
    expect(onComplete).not.toHaveBeenCalled()

    await jest.advanceTimersByTimeAsync(1000)
    expect(onProgress).toHaveBeenLastCalledWith(progressItem('completed', 100))
    expect(onComplete).toHaveBeenCalledTimes(1)

    // Polling has ended: no further requests
    const callsAfterComplete = fetchMock.mock.calls.length
    await jest.advanceTimersByTimeAsync(5000)
    expect(fetchMock.mock.calls.length).toBe(callsAfterComplete)
  })

  test('reports an error when the sync fails to start', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'boom' }, false))

    const onError = jest.fn()
    await clientSyncService.syncAllData(TEST_WALLET, { onError })

    expect(onError).toHaveBeenCalledTimes(1)
    await jest.advanceTimersByTimeAsync(5000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test('gives up after repeated poll failures instead of polling forever', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ success: true })) // POST start
      .mockRejectedValue(new Error('network down'))

    const onComplete = jest.fn()
    const onError = jest.fn()
    await clientSyncService.syncAllData(TEST_WALLET, { onComplete, onError })

    await jest.advanceTimersByTimeAsync(9000)
    expect(onError).not.toHaveBeenCalled()

    await jest.advanceTimersByTimeAsync(1000)
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onComplete).not.toHaveBeenCalled()

    const callsAfterError = fetchMock.mock.calls.length
    await jest.advanceTimersByTimeAsync(5000)
    expect(fetchMock.mock.calls.length).toBe(callsAfterError)
  })

  test('stopSync ends polling without completing', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ isSyncing: true, progress: [] }))

    const onComplete = jest.fn()
    await clientSyncService.syncAllData(TEST_WALLET, { onComplete })
    await jest.advanceTimersByTimeAsync(1000)

    clientSyncService.stopSync()
    const callsAfterStop = fetchMock.mock.calls.length
    await jest.advanceTimersByTimeAsync(5000)

    expect(fetchMock.mock.calls.length).toBe(callsAfterStop)
    expect(onComplete).not.toHaveBeenCalled()
  })

  test('status helpers always return arrays', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'not an array' }))

    await expect(clientSyncService.getCurrentProgress()).resolves.toEqual([])
    await expect(clientSyncService.getSyncStatus()).resolves.toEqual([])
  })
})
