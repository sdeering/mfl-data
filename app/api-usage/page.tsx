'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface UsageRow {
  date: string
  source: string
  count: number
}

export default function ApiUsagePage() {
  const [rows, setRows] = useState<UsageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({})

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        setError(null)
        // Prefer client-side Supabase RPC to bypass server env issues; on any failure, fall back to API route
        let loaded = false
        if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
          try {
            const { createClient } = await import('@supabase/supabase-js')
            const supabase = createClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL as string,
              process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
              { auth: { persistSession: false } }
            )
            const fromDate = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
            const { data, error } = await supabase.rpc('get_api_usage', { from_date: fromDate, src: null })
            if (!error && Array.isArray(data)) {
              setRows(data as any)
              loaded = true
            }
          } catch {}
        }
        if (!loaded) {
          const res = await fetch('/api/usage')
          if (!res.ok) throw new Error('Failed to load usage data')
          const json = await res.json()
          setRows(json.data ?? [])
        }
      } catch (e: any) {
        setError(e?.message || 'Failed to load')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Build daily totals across sources
  const byDate = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of rows) {
      map.set(r.date, (map.get(r.date) || 0) + (r.count || 0))
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
  }, [rows])

  const maxTotal = useMemo(() => {
    return byDate.reduce((m, [, total]) => Math.max(m, total), 0)
  }, [byDate])

  const formatLabel = (dateStr: string) => {
    try {
      const d = new Date(dateStr + 'T00:00:00Z')
      return d.toLocaleDateString(undefined, { month: 'short', day: '2-digit' })
    } catch {
      return dateStr.slice(5)
    }
  }

  // Group table data by date → total and endpoint breakdown
  const tableData = useMemo(() => {
    const grouped = new Map<string, { total: number; endpoints: { endpoint: string; count: number; source: string }[] }>()
    for (const r of rows) {
      const entry = grouped.get(r.date) || { total: 0, endpoints: [] }
      entry.total += r.count || 0
      // @ts-ignore include endpoint if present on row (from API fallback)
      const ep = (r as any).endpoint || 'unknown'
      const existing = entry.endpoints.find(e => e.endpoint === ep)
      if (existing) {
        existing.count += r.count || 0
      } else {
        entry.endpoints.push({ endpoint: ep, count: r.count || 0, source: r.source })
      }
      grouped.set(r.date, entry)
    }
    // Sort endpoints desc by count; sort dates asc
    const result = Array.from(grouped.entries()).map(([date, v]) => ({
      date,
      total: v.total,
      endpoints: v.endpoints.sort((a, b) => b.count - a.count)
    }))
    result.sort((a, b) => a.date.localeCompare(b.date))
    return result
  }, [rows])

  const toggleDate = (date: string) => setExpandedDates(prev => ({ ...prev, [date]: !prev[date] }))

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">External API Usage (Last 30 Days)</h1>

      {loading && <div className="text-gray-600">Loading…</div>}
      {error && <div className="text-red-600">{error}</div>}

      {!loading && !error && (
        <>
          {/* Bar chart first */}
          <div className="p-4 border rounded-lg mb-8">
            <h2 className="text-lg font-medium mb-3">Daily total (all sources)</h2>
            {byDate.length === 0 ? (
              <div className="text-sm text-gray-500 dark:text-gray-300">No data</div>
            ) : (
              <div className="w-full h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byDate.map(([date, total]) => ({ date, total }))} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                    <XAxis dataKey="date" tickFormatter={(v) => formatLabel(v)} stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} />
                    <YAxis allowDecimals={false} stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} />
                    <Tooltip labelFormatter={(v) => v} formatter={(value: any) => [value, 'Calls']} contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', color: '#E5E7EB' }} />
                    <Bar dataKey="total" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Aggregated table: one row per day, expandable to show endpoints */}
          <div className="overflow-x-auto border rounded-lg">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 dark:text-white uppercase tracking-wider">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 dark:text-white uppercase tracking-wider">Total</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 dark:text-white uppercase tracking-wider">Details</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {tableData.map(({ date, total, endpoints }) => (
                  <React.Fragment key={date}>
                    <tr>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white">{date}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white">{total}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">
                        <button onClick={() => toggleDate(date)} className="px-2 py-1 text-blue-600 dark:text-blue-400 hover:underline">
                          {expandedDates[date] ? 'Hide endpoints' : 'Show endpoints'}
                        </button>
                      </td>
                    </tr>
                    {expandedDates[date] && (
                      <tr>
                        <td colSpan={3} className="px-4 pb-3">
                          <div className="rounded border border-gray-200 dark:border-gray-700">
                            <table className="w-full text-sm">
                              <thead className="bg-gray-50 dark:bg-gray-800">
                                <tr>
                                  <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-white">Endpoint</th>
                                  <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-white">Count</th>
                                </tr>
                              </thead>
                              <tbody>
                                {endpoints.map(ep => (
                                  <tr key={ep.endpoint} className="border-t border-gray-200 dark:border-gray-700">
                                    <td className="px-3 py-2 text-gray-900 dark:text-white">{ep.endpoint}</td>
                                    <td className="px-3 py-2 text-gray-900 dark:text-white">{ep.count}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
                {tableData.length === 0 && (
                  <tr>
                    <td className="px-4 py-4 text-sm text-gray-500 dark:text-white" colSpan={3}>No data</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}


