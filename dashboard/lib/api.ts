// ═══════════════════════════════════════════════════════════════════════════
// API Client Layer — Centralized data fetching with mock fallback
// ═══════════════════════════════════════════════════════════════════════════

import type {
  ApiResponse,
  PaginatedResponse,
  BotMetrics,
  SystemHealth,
  Session,
  UserStats,
  LogEntry,
  Command,
  ExecutionResult,
  BotStatus,
  SystemToggle,
  TimeSeriesPoint,
  ActivityDataPoint,
} from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '/api'

// ─────────────────────────────────────────────────────────────────────────────
// Fetch Wrapper
// ─────────────────────────────────────────────────────────────────────────────

async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const url = `${API_BASE}${endpoint}`
  
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(error.message || `API Error: ${res.status}`)
  }

  return res.json()
}

// ─────────────────────────────────────────────────────────────────────────────
// Metrics & Health
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchMetrics(): Promise<BotMetrics> {
  const res = await apiFetch<BotMetrics>('/metrics')
  return res.data
}

export async function fetchSystemHealth(): Promise<SystemHealth> {
  const res = await apiFetch<SystemHealth>('/system/health')
  return res.data
}

export async function fetchBotStatus(): Promise<BotStatus> {
  const res = await apiFetch<BotStatus>('/system/status')
  return res.data
}

// ─────────────────────────────────────────────────────────────────────────────
// Sessions
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchSessions(params?: {
  status?: 'active' | 'idle' | 'ended'
  page?: number
  pageSize?: number
}): Promise<PaginatedResponse<Session>> {
  const query = new URLSearchParams()
  if (params?.status) query.set('status', params.status)
  if (params?.page) query.set('page', String(params.page))
  if (params?.pageSize) query.set('pageSize', String(params.pageSize))
  const res = await apiFetch<PaginatedResponse<Session>>(
    `/sessions?${query.toString()}`
  )
  return res.data
}

export async function fetchSession(id: string): Promise<Session | null> {
  const res = await apiFetch<Session>(`/sessions/${id}`)
  return res.data
}

// ─────────────────────────────────────────────────────────────────────────────
// Users
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchUsers(params?: {
  sortBy?: 'activityScore' | 'totalCommands' | 'lastActive'
  order?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}): Promise<PaginatedResponse<UserStats>> {
  const query = new URLSearchParams()
  if (params?.sortBy) query.set('sortBy', params.sortBy)
  if (params?.order) query.set('order', params.order)
  if (params?.page) query.set('page', String(params.page))
  if (params?.pageSize) query.set('pageSize', String(params.pageSize))
  const res = await apiFetch<PaginatedResponse<UserStats>>(
    `/users?${query.toString()}`
  )
  return res.data
}

// ─────────────────────────────────────────────────────────────────────────────
// Logs
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchLogs(params?: {
  level?: string[]
  source?: string[]
  search?: string
  since?: string
  limit?: number
}): Promise<LogEntry[]> {
  const query = new URLSearchParams()
  if (params?.level?.length) query.set('level', params.level.join(','))
  if (params?.source?.length) query.set('source', params.source.join(','))
  if (params?.search) query.set('search', params.search)
  if (params?.since) query.set('since', params.since)
  if (params?.limit) query.set('limit', String(params.limit))
  const res = await apiFetch<LogEntry[]>(`/logs?${query.toString()}`)
  return res.data
}

// ─────────────────────────────────────────────────────────────────────────────
// Commands
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchCommands(params?: {
  category?: string
  search?: string
  enabled?: boolean
}): Promise<Command[]> {
  const query = new URLSearchParams()
  if (params?.category) query.set('category', params.category)
  if (params?.search) query.set('search', params.search)
  if (params?.enabled !== undefined) query.set('enabled', String(params.enabled))
  const res = await apiFetch<Command[]>(`/commands?${query.toString()}`)
  return res.data
}

// ─────────────────────────────────────────────────────────────────────────────
// Command Execution
// ─────────────────────────────────────────────────────────────────────────────

export async function executeCommand(
  command: string,
  args: Record<string, unknown> = {}
): Promise<ExecutionResult> {
  const res = await apiFetch<ExecutionResult>('/execute', {
    method: 'POST',
    body: JSON.stringify({ command, args }),
  })
  return res.data
}

// ─────────────────────────────────────────────────────────────────────────────
// System Controls
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchSystemToggles(): Promise<SystemToggle[]> {
  const res = await apiFetch<SystemToggle[]>('/system/toggles')
  return res.data
}

export async function updateSystemToggle(
  id: string,
  enabled: boolean
): Promise<SystemToggle> {
  const res = await apiFetch<SystemToggle>(`/system/toggles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ enabled }),
  })
  return res.data
}

export async function updateBotStatus(status: Partial<BotStatus>): Promise<BotStatus> {
  const res = await apiFetch<BotStatus>('/system/status', {
    method: 'PATCH',
    body: JSON.stringify(status),
  })
  return res.data
}

// ─────────────────────────────────────────────────────────────────────────────
// Time Series Data
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchVoiceActivity(hours = 24): Promise<TimeSeriesPoint[]> {
  const res = await apiFetch<TimeSeriesPoint[]>(`/metrics/voice?hours=${hours}`)
  return res.data
}

export async function fetchMessageActivity(hours = 24): Promise<TimeSeriesPoint[]> {
  const res = await apiFetch<TimeSeriesPoint[]>(`/metrics/messages?hours=${hours}`)
  return res.data
}

export async function fetchWeeklyActivity(): Promise<ActivityDataPoint[]> {
  const res = await apiFetch<ActivityDataPoint[]>('/metrics/weekly')
  return res.data
}
