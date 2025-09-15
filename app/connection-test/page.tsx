'use client'

import { useState } from 'react'
import { supabase } from '../../src/lib/supabase'

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
      addResult('🔍 Testing database connection...')
      
      
      // Test 1: Basic connection
      const { data, error } = await supabase
        .from('users')
        .select('count')
        .limit(1)

      if (error) {
        addResult(`❌ Connection failed: ${error.message}`)
        addResult(`   Error code: ${error.code}`)
        addResult(`   Error details: ${JSON.stringify(error.details)}`)
        return
      }

      addResult('✅ Basic connection successful')
      
      // Test 2: Check if tables exist
      addResult('🔍 Checking table structure...')
      
      const tables = ['users', 'clubs', 'matches', 'sync_status']
      for (const table of tables) {
        try {
          const { error: tableError } = await supabase
            .from(table)
            .select('count')
            .limit(1)
          
          if (tableError) {
            addResult(`❌ Table '${table}' error: ${tableError.message}`)
          } else {
            addResult(`✅ Table '${table}' accessible`)
          }
        } catch (err) {
          addResult(`❌ Table '${table}' failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
        }
      }
      
      // Test 3: Try to insert test data
      addResult('🔍 Testing data insertion...')
      
      const testData = {
        wallet_address: 'test-connection',
        data: { test: true, timestamp: new Date().toISOString() },
        last_synced: new Date().toISOString()
      }
      
      const { error: insertError } = await supabase
        .from('users')
        .upsert(testData)
      
      if (insertError) {
        addResult(`❌ Data insertion failed: ${insertError.message}`)
      } else {
        addResult('✅ Data insertion successful')
        
        // Clean up test data
        await supabase
          .from('users')
          .delete()
          .eq('wallet_address', 'test-connection')
        
        addResult('🧹 Test data cleaned up')
      }
      
      addResult('🎉 All tests completed!')
      
    } catch (error) {
      addResult(`💥 Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`)
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
              <span className="font-medium">Database URL:</span> 
              <span className="ml-2 font-mono text-gray-600 dark:text-gray-300">
                https://zafwdjrvzqpqqlcowluf.supabase.co
              </span>
            </div>
            <div>
              <span className="font-medium">API Key:</span> 
              <span className="ml-2 font-mono text-gray-600 dark:text-gray-300">
                eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
