'use client'

import React from 'react'
import { useSupabaseSync } from '../hooks/useSupabaseSync'
import { GlobalSyncProgress } from './GlobalSyncProgress'

interface SupabaseSyncProviderProps {
  children: React.ReactNode
}

export const SupabaseSyncProvider: React.FC<SupabaseSyncProviderProps> = ({ children }) => {
  const { isVisible, progress, isSyncing, closeProgress, retrySync } = useSupabaseSync()

  return (
    <>
      {children}
      <GlobalSyncProgress 
        isVisible={isVisible}
        onClose={closeProgress}
      />
    </>
  )
}
