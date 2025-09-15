'use client'

import { useState } from 'react'
import { SyncTestRunner, TEST_WALLET } from '../../src/tests/syncTests'

interface TestResult {
  name: string
  passed: boolean
  error?: string
  details?: any
}

export default function SyncTestsPage() {
  const [isRunning, setIsRunning] = useState(false)
  const [results, setResults] = useState<TestResult[]>([])
  const [lastRun, setLastRun] = useState<Date | null>(null)

  const runTests = async () => {
    setIsRunning(true)
    setResults([])
    
    try {
      const testRunner = new SyncTestRunner()
      await testRunner.runAllTests()
      setResults(testRunner.getResults())
      setLastRun(new Date())
    } catch (error) {
      console.error('Test runner error:', error)
      setResults([{
        name: 'Test Runner',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }])
    } finally {
      setIsRunning(false)
    }
  }

  const passedCount = results.filter(r => r.passed).length
  const totalCount = results.length
  const successRate = totalCount > 0 ? ((passedCount / totalCount) * 100).toFixed(1) : '0'

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            🧪 Sync Functionality Tests
          </h1>
          
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <h2 className="text-lg font-semibold text-blue-900 mb-2">Test Configuration</h2>
            <p className="text-blue-800">
              <strong>Test Wallet:</strong> {TEST_WALLET}
            </p>
            <p className="text-blue-800">
              <strong>Last Run:</strong> {lastRun ? lastRun.toLocaleString() : 'Never'}
            </p>
          </div>

          <div className="mb-6">
            <button
              onClick={runTests}
              disabled={isRunning}
              className={`px-6 py-3 rounded-lg font-semibold text-white ${
                isRunning
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isRunning ? '🔄 Running Tests...' : '🚀 Run All Tests'}
            </button>
          </div>

          {results.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Test Results</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{passedCount}</div>
                  <div className="text-green-800">Passed</div>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{totalCount - passedCount}</div>
                  <div className="text-red-800">Failed</div>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{successRate}%</div>
                  <div className="text-blue-800">Success Rate</div>
                </div>
              </div>

              <div className="space-y-4">
                {results.map((result, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border-l-4 ${
                      result.passed
                        ? 'bg-green-50 border-green-500'
                        : 'bg-red-50 border-red-500'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className={`font-semibold ${
                        result.passed ? 'text-green-800' : 'text-red-800'
                      }`}>
                        {result.passed ? '✅' : '❌'} {result.name}
                      </h3>
                      <span className={`px-2 py-1 rounded text-sm font-medium ${
                        result.passed
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {result.passed ? 'PASSED' : 'FAILED'}
                      </span>
                    </div>
                    
                    {result.error && (
                      <div className="text-red-700 text-sm mb-2">
                        <strong>Error:</strong> {result.error}
                      </div>
                    )}
                    
                    {result.details && (
                      <div className="text-gray-700 text-sm">
                        <strong>Details:</strong>
                        <pre className="mt-1 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
                          {JSON.stringify(result.details, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Test Coverage</h3>
            <ul className="text-gray-700 space-y-1">
              <li>• User Info Sync - Tests fetching and storing user information</li>
              <li>• Club Data Sync - Tests fetching and storing club data</li>
              <li>• Agency Players Sync - Tests fetching and storing agency players</li>
              <li>• Market Values Sync - Tests calculating and storing market values</li>
              <li>• Full Sync Flow - Tests complete end-to-end sync process</li>
              <li>• Data Validation - Verifies data integrity and completeness</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
