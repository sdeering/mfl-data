'use client'

import React, { createContext, useContext } from 'react'
import { useSupabaseSync } from '../hooks/useSupabaseSync'

type SupabaseSyncContextValue = ReturnType<typeof useSupabaseSync>

const SupabaseSyncContext = createContext<SupabaseSyncContextValue | null>(null)

export const SupabaseSyncContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const sync = useSupabaseSync()
  return (
    <SupabaseSyncContext.Provider value={sync}>
      {children}
    </SupabaseSyncContext.Provider>
  )
}

export const useSupabaseSyncUI = (): SupabaseSyncContextValue => {
  const ctx = useContext(SupabaseSyncContext)
  if (!ctx) {
    throw new Error('useSupabaseSyncUI must be used within SupabaseSyncContextProvider')
  }
  return ctx
}


