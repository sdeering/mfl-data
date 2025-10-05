'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../src/lib/supabase'

export default function SupabaseTestPage() {
  const [connectionStatus, setConnectionStatus] = useState<'testing' | 'connected' | 'error'>('testing')
  const [error, setError] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<any[]>([])

  useEffect(() => {
    testSupabaseConnection()
  }, [])

  const testSupabaseConnection = async () => {
    try {
      setConnectionStatus('testing')
      setError(null)
      setTestResults([])

      // Test 1: Basic connection
      const { data: connectionTest, error: connectionError } = await supabase
        .from('users')
        .select('count')
        .limit(1)

      if (connectionError) throw connectionError

      setTestResults(prev => [...prev, {
        test: 'Database Connection',
        status: 'success',
        message: 'Successfully connected to Supabase'
      }])

      // Test 2: Check table structure
      const { data: tables, error: tablesError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')

      if (tablesError) {
        setTestResults(prev => [...prev, {
          test: 'Table Structure Check',
          status: 'warning',
          message: 'Could not check table structure (this is normal)'
        }])
      } else {
        setTestResults(prev => [...prev, {
          test: 'Table Structure Check',
          status: 'success',
          message: `Found ${tables?.length || 0} tables`
        }])
      }

      // Test 3: Test insert/update (users table)
      const testWalletAddress = '0x95dc70d7d39f6f76'
      const testUserData = {
        wallet_address: testWalletAddress,
        data: {
          walletAddress: testWalletAddress,
          username: 'Test User',
          experience: 1000
        },
        last_synced: new Date().toISOString()
      }

      const { error: insertError } = await supabase
        .from('users')
        .upsert(testUserData)

      if (insertError) throw insertError

      setTestResults(prev => [...prev, {
        test: 'Data Insert/Update',
        status: 'success',
        message: 'Successfully inserted test user data'
      }])

      // Test 4: Test query
      const { data: userData, error: queryError } = await supabase
        .from('users')
        .select('*')
        .eq('wallet_address', testWalletAddress)
        .single()

      if (queryError) throw queryError

      setTestResults(prev => [...prev, {
        test: 'Data Query',
        status: 'success',
        message: `Successfully queried user data: ${userData?.data?.username || 'Unknown'}`
      }])

      setConnectionStatus('connected')

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      setConnectionStatus('error')
      
      setTestResults(prev => [...prev, {
        test: 'Error Test',
        status: 'error',
        message: errorMessage
      }])
    }
  }

  const runSyncTest = async () => {
    try {
      setTestResults(prev => [...prev, {
        test: 'Sync Service Test',
        status: 'testing',
        message: 'Testing sync service...'
      }])

      // Import the sync service dynamically to avoid SSR issues
      const { supabaseSyncService } = await import('../../src/services/supabaseSyncService')
      
      // Test sync with your wallet address
      const walletAddress = '0x95dc70d7d39f6f76'
      
      await supabaseSyncService.syncAllData(walletAddress, {
        forceRefresh: true,
        onProgress: (progress) => {
          setTestResults(prev => [...prev, {
            test: 'Sync Progress',
            status: 'info',
            message: `${progress.dataType}: ${progress.message} (${progress.progress}%)`
          }])
        }
      })

      setTestResults(prev => [...prev, {
        test: 'Sync Service Test',
        status: 'success',
        message: 'Sync service test completed successfully'
      }])

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setTestResults(prev => [...prev, {
        test: 'Sync Service Test',
        status: 'error',
        message: `Sync test failed: ${errorMessage}`
      }])
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
          Database Integration Test
        </h1>

        {/* Connection Status */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Connection Status
          </h2>
          
          <div className="flex items-center space-x-3">
            {connectionStatus === 'testing' && (
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            )}
            {connectionStatus === 'connected' && (
              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
            {connectionStatus === 'error' && (
              <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            )}
            
            <span className={`text-lg font-medium ${
              connectionStatus === 'connected' ? 'text-green-600 dark:text-green-400' :
              connectionStatus === 'error' ? 'text-red-600 dark:text-red-400' :
              'text-blue-600 dark:text-blue-400'
            }`}>
              {connectionStatus === 'testing' && 'Testing Connection...'}
              {connectionStatus === 'connected' && 'Connected Successfully'}
              {connectionStatus === 'error' && 'Connection Failed'}
            </span>
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Test Results */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Test Results
          </h2>
          
          <div className="space-y-3">
            {testResults.map((result, index) => (
              <div key={index} className="flex items-center space-x-3 p-3 rounded-md bg-gray-50 dark:bg-gray-700">
                {result.status === 'success' && (
                  <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
                {result.status === 'error' && (
                  <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                )}
                {result.status === 'warning' && (
                  <div className="w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                )}
                {result.status === 'info' && (
                  <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                )}
                {result.status === 'testing' && (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                )}
                
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{result.test}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{result.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Actions
          </h2>
          
          <div className="space-x-4">
            <button
              onClick={testSupabaseConnection}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Test Connection
            </button>
            
            <button
              onClick={runSyncTest}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              Test Sync Service
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}