'use client'

import React from 'react'
import { SupabaseSyncContextProvider, useSupabaseSyncUI } from '../contexts/SupabaseSyncContext'
import { GlobalSyncProgress } from './GlobalSyncProgress'

interface SupabaseSyncProviderProps {
  children: React.ReactNode
}

export const SupabaseSyncProvider: React.FC<SupabaseSyncProviderProps> = ({ children }) => {
  return (
    <SupabaseSyncContextProvider>
      <Inner>{children}</Inner>
    </SupabaseSyncContextProvider>
  )
}

const Inner: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isVisible, isSyncing, closeProgress } = useSupabaseSyncUI()
  return (
    <>
      {children}
      <GlobalSyncProgress isVisible={isVisible} isSyncing={isSyncing} onClose={closeProgress} />
    </>
  )
}
