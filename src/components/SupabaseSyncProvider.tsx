'use client'

import React from 'react'
import { SupabaseSyncContextProvider } from '../contexts/SupabaseSyncContext'

interface SupabaseSyncProviderProps {
  children: React.ReactNode
}

export const SupabaseSyncProvider: React.FC<SupabaseSyncProviderProps> = ({ children }) => {
  return <SupabaseSyncContextProvider>{children}</SupabaseSyncContextProvider>
}
