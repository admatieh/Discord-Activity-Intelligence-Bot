'use client'

// ═══════════════════════════════════════════════════════════════════════════
// Execution History Hook — Subscribe to command execution history
// ═══════════════════════════════════════════════════════════════════════════

import { useSyncExternalStore, useCallback } from 'react'
import {
  getExecutionHistory,
  subscribeToHistory,
  clearHistory,
  type ParsedCommand,
} from '@/lib/commands'
import type { ExecutionResult } from '@/lib/types'

export function useExecutionHistory() {
  const history = useSyncExternalStore(
    subscribeToHistory,
    getExecutionHistory,
    getExecutionHistory // SSR fallback
  )

  const clear = useCallback(() => {
    clearHistory()
  }, [])

  const pending = history.filter((e) => e.status === 'pending' || e.status === 'running')
  const completed = history.filter((e) => e.status === 'success' || e.status === 'error')
  const errors = history.filter((e) => e.status === 'error')

  return {
    history,
    pending,
    completed,
    errors,
    hasPending: pending.length > 0,
    clear,
  }
}

export type { ExecutionResult, ParsedCommand }
