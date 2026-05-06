// ═══════════════════════════════════════════════════════════════════════════
// Core Domain Types for Discord Bot Control Plane
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// Base Types
// ─────────────────────────────────────────────────────────────────────────────

export type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'trace' | 'success'
export type LogSource = 'bot' | 'api' | 'db' | 'voice' | 'gateway' | 'system'
export type SessionStatus = 'active' | 'idle' | 'ended'
export type CommandCategory = 'moderation' | 'music' | 'utility' | 'fun' | 'admin' | 'system'
export type SystemStatus = 'healthy' | 'degraded' | 'down'

// ─────────────────────────────────────────────────────────────────────────────
// Log Entry
// ─────────────────────────────────────────────────────────────────────────────

export interface LogEntry {
  id: string
  timestamp: string
  level: LogLevel
  source: LogSource
  message: string
  metadata?: Record<string, unknown>
}

// ─────────────────────────────────────────────────────────────────────────────
// Session & Participant
// ─────────────────────────────────────────────────────────────────────────────

export interface Participant {
  id: string
  username: string
  discriminator: string
  avatar?: string
  isMuted: boolean
  isDeafened: boolean
  isSpeaking: boolean
  joinedAt: string
}

export interface Session {
  id: string
  guildId: string
  guildName: string
  channelId: string
  channelName: string
  status: SessionStatus
  participantCount: number
  participants: Participant[]
  startedAt: string
  endedAt?: string
  metrics: SessionMetrics
}

export interface SessionMetrics {
  totalMessages: number
  totalReactions: number
  totalCommands: number
  peakParticipants: number
  avgVoiceMinutes: number
}

// ─────────────────────────────────────────────────────────────────────────────
// User Analytics
// ─────────────────────────────────────────────────────────────────────────────

export interface UserStats {
  id: string
  username: string
  discriminator: string
  avatar?: string
  totalCommands: number
  totalMessages: number
  totalVoiceMinutes: number
  totalReactions: number
  favoriteCommand: string
  lastActive: string
  activityScore: number
  breakdown: {
    music: number
    moderation: number
    utility: number
    fun: number
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Commands
// ─────────────────────────────────────────────────────────────────────────────

export interface CommandArg {
  name: string
  type: 'string' | 'number' | 'boolean' | 'user' | 'channel' | 'role'
  required: boolean
  description: string
  choices?: { name: string; value: string | number }[]
  default?: string | number | boolean
}

export interface Command {
  name: string
  description: string
  category: CommandCategory
  usage: string
  args: CommandArg[]
  cooldown: number // seconds
  permissions: string[]
  enabled: boolean
  usageCount: number
  lastUsed?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Command Execution
// ─────────────────────────────────────────────────────────────────────────────

export type ExecutionStatus = 'pending' | 'running' | 'success' | 'error'

export interface ExecutionResult {
  id: string
  command: string
  args: Record<string, unknown>
  status: ExecutionStatus
  output?: string
  error?: string
  startedAt: string
  completedAt?: string
  durationMs?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// System & Metrics
// ─────────────────────────────────────────────────────────────────────────────

export interface SystemHealth {
  status: SystemStatus
  uptime: number // seconds
  version: string
  components: {
    name: string
    status: SystemStatus
    latency?: number // ms
    message?: string
  }[]
}

export interface BotMetrics {
  guilds: number
  users: number
  activeSessions: number
  commandsToday: number
  messagesProcessed: number
  voiceMinutesToday: number
  cpuUsage: number
  memoryUsage: number
  latency: number
}

export interface TimeSeriesPoint {
  time: string
  value: number
}

export interface ActivityDataPoint {
  day: string
  participants: number
  sessions: number
}

// ─────────────────────────────────────────────────────────────────────────────
// System Controls
// ─────────────────────────────────────────────────────────────────────────────

export interface SystemToggle {
  id: string
  name: string
  description: string
  enabled: boolean
  category: 'features' | 'security' | 'logging' | 'performance'
}

export interface BotStatus {
  isOnline: boolean
  currentStatus: 'online' | 'idle' | 'dnd' | 'invisible'
  activityType: 'playing' | 'listening' | 'watching' | 'competing' | 'custom'
  activityText: string
}

// ─────────────────────────────────────────────────────────────────────────────
// API Response Wrappers
// ─────────────────────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T
  timestamp: string
  cached?: boolean
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

export interface ApiError {
  code: string
  message: string
  details?: Record<string, unknown>
}

// ─────────────────────────────────────────────────────────────────────────────
// WebSocket Events (for future real-time)
// ─────────────────────────────────────────────────────────────────────────────

export type WSEventType =
  | 'log'
  | 'session_update'
  | 'metrics_update'
  | 'command_executed'
  | 'user_activity'
  | 'system_alert'

export interface WSEvent<T = unknown> {
  type: WSEventType
  payload: T
  timestamp: string
}
