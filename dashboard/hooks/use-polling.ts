'use client'

// ═══════════════════════════════════════════════════════════════════════════
// Polling Hook — Generic SWR-based polling for any async fetcher
// ═══════════════════════════════════════════════════════════════════════════

import useSWR from 'swr'

interface UsePollingOptions<T> {
  /** Polling interval in milliseconds (default: 5000) */
  interval?: number
  /** Initial data to show before first fetch */
  fallbackData?: T
  /** Whether polling is enabled (default: true) */
  enabled?: boolean
  /** Revalidate on focus (default: false for polling) */
  revalidateOnFocus?: boolean
  /** Revalidate on reconnect (default: true) */
  revalidateOnReconnect?: boolean
}

export function usePolling<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  options: UsePollingOptions<T> = {}
) {
  const {
    interval = 5000,
    fallbackData,
    enabled = true,
    revalidateOnFocus = false,
    revalidateOnReconnect = true,
  } = options

  const { data, error, isLoading, isValidating, mutate } = useSWR<T>(
    enabled ? key : null,
    fetcher,
    {
      refreshInterval: enabled ? interval : 0,
      fallbackData,
      revalidateOnFocus,
      revalidateOnReconnect,
      dedupingInterval: Math.min(interval / 2, 2000),
    }
  )

  return {
    data,
    error,
    isLoading,
    isValidating,
    /** Force immediate refresh */
    refresh: () => mutate(),
    /** Update data optimistically */
    setData: (newData: T | ((prev: T | undefined) => T)) => mutate(newData, false),
  }
}
