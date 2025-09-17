import Link from 'next/link'

export default function DebugPage() {
  const links: { href: string; label: string }[] = [
    { href: '/api-usage', label: 'API Usage' },
    { href: '/sync-test', label: 'Sync Test' },
    // Additional handy debug/test pages already in the app
    { href: '/sync-tests', label: 'Sync Tests (Batch/Scenarios)' },
    { href: '/supabase-test', label: 'Supabase Test' },
    { href: '/cache-test', label: 'Cache Test' },
    { href: '/database', label: 'Database Viewer' },
    { href: '/db-status', label: 'DB Status' },
    { href: '/connection-test', label: 'Connection Test' },
    { href: '/detailed-sync-debug', label: 'Detailed Sync Debug' },
    { href: '/tactics-test', label: 'Tactics Test' },
    { href: '/clubs-test', label: 'Clubs Test' },
  ]

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-2 text-gray-900 dark:text-white">Debug & Test Utilities</h1>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
        Private utilities for development and diagnostics. Not linked in navigation.
      </p>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {links.map((l) => (
            <li key={l.href} className="bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800">
              <Link href={l.href} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-blue-600 dark:text-blue-400 font-medium">{l.label}</span>
                <span className="text-gray-400">{l.href}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 p-4 rounded border border-dashed border-gray-300 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300">
        Note: Add new debug/test routes here as they’re implemented (e.g., feature-specific diagnostics, performance checks, or data integrity tools).
      </div>
    </div>
  )
}



