'use client'

import { useState } from 'react'

export default function ConnectionTestPage() {
  const [testResults, setTestResults] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`])
  }

  const testConnection = async () => {
    setIsLoading(true)
    setTestResults([])

    try {
      addResult('Testing database connection via API...')

      // Test 1: Basic connection via db-stats endpoint
      const res = await fetch('/api/data/db-stats')

      if (!res.ok) {
        addResult(`Connection failed: HTTP ${res.status}`)
        return
      }

      const dbStats = await res.json()

      if (dbStats.healthy) {
        addResult('Basic connection successful')
      } else {
        addResult('Connection returned unhealthy status')
      }

      // Test 2: Check if tables exist
      addResult('Checking table structure...')

      const tables = ['users', 'clubs', 'matches', 'sync_status']
      for (const table of tables) {
        const tableData = dbStats.tables?.[table]
        if (tableData && tableData.error == null) {
          addResult(`Table '${table}' accessible (${tableData.count || 0} records)`)
        } else {
          addResult(`Table '${table}' error: ${tableData?.error || 'not found in response'}`)
        }
      }

      addResult('All tests completed!')

    } catch (error) {
      addResult(`Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
          Database Connection Test
        </h1>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Connection Diagnostics
          </h2>

          <button
            onClick={testConnection}
            disabled={isLoading}
            className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Testing...' : 'Run Connection Test'}
          </button>
        </div>

        {testResults.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Test Results
            </h2>

            <div className="space-y-2">
              {testResults.map((result, index) => (
                <div key={index} className="text-sm font-mono bg-gray-50 dark:bg-gray-700 p-2 rounded">
                  {result}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mt-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Configuration Info
          </h2>

          <div className="space-y-2 text-sm">
            <div>
              <span className="font-medium">Database:</span>
              <span className="ml-2 font-mono text-gray-600 dark:text-gray-300">
                Turso (libSQL)
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
