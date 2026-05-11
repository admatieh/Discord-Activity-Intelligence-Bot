// ─── Discord / Guild ─────────────────────────────────────────────────────────

export interface Guild {
  id: string
  name: string
  icon?: string
  memberCount?: number
}

export interface VoiceChannel {
  id: string
  name: string
  memberCount?: number
  members?: ChannelMember[]
}

export interface TextChannel {
  id: string
  name: string
}

export interface ChannelMember {
  id: string
  username: string
  displayName?: string
  avatar?: string
}

// ─── Sessions ────────────────────────────────────────────────────────────────

export interface Session {
  id: string
  name: string
  guildId: string
  guildName?: string
  voiceChannelId: string
  voiceChannelName?: string
  textChannelId?: string
  textChannelName?: string
  status: "active" | "ended" | "scheduled" | "failed"
  startedAt?: string
  endedAt?: string
  scheduledAt?: string
  durationMinutes?: number
  participantCount?: number
  tracking?: TrackingOptions
  createdBy?: string
  source?: string
}

export interface TrackingOptions {
  attendance?: boolean
  voiceTime?: boolean
  messages?: boolean
  reactions?: boolean
  joinLeaveEvents?: boolean
}

// ─── Scheduled Items ─────────────────────────────────────────────────────────

export interface ScheduledItem {
  id: string
  type: "session" | "message"
  title?: string
  status: "scheduled" | "completed" | "cancelled" | "failed" | "running"
  scheduledAt: string
  guildId?: string
  guildName?: string
  channelId?: string
  channelName?: string
  durationMinutes?: number
  createdBy?: string
  errorMessage?: string
  payload?: Record<string, unknown>
}

// ─── Messages ────────────────────────────────────────────────────────────────

export interface MessageDelivery {
  id: string
  guildId: string
  guildName?: string
  channelId: string
  channelName?: string
  content: string
  status: "sent" | "failed" | "scheduled" | "pending"
  sentAt?: string
  scheduledAt?: string
  errorMessage?: string
  createdBy?: string
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export interface Report {
  sessionId: string
  sessionName: string
  guildId?: string
  guildName?: string
  status: "available" | "pending" | "missing"
  generatedAt?: string
  participantCount?: number
  durationMinutes?: number
  startedAt?: string
  endedAt?: string
}

export interface ReportDetail {
  sessionId: string
  sessionName: string
  startedAt?: string
  endedAt?: string
  durationMinutes?: number
  participantCount?: number
  totalVoiceMinutes?: number
  totalMessages?: number
  participants?: ParticipantSummary[]
  topParticipants?: ParticipantSummary[]
  lowActivityParticipants?: ParticipantSummary[]
  lateJoiners?: ParticipantSummary[]
  earlyLeavers?: ParticipantSummary[]
  timeline?: TimelineEvent[]
  summary?: string
  guildId?: string
  guildName?: string
  voiceChannelName?: string
}

export interface ParticipantSummary {
  userId: string
  username: string
  displayName?: string
  voiceMinutes?: number
  messageCount?: number
  reactionCount?: number
  joinTime?: string
  leaveTime?: string
  participationScore?: number
  attended?: boolean
}

export interface TimelineEvent {
  timestamp: string
  type: string
  userId?: string
  username?: string
  description: string
}

// ─── Participants ─────────────────────────────────────────────────────────────

export interface Participant {
  userId: string
  username: string
  displayName?: string
  avatar?: string
  roles?: string[]
  currentVoiceChannel?: string
  sessionsAttended?: number
  totalVoiceMinutes?: number
  totalMessages?: number
  participationScore?: number
  lastActive?: string
  guildId?: string
  isBot?: boolean
}

// ─── Activity ────────────────────────────────────────────────────────────────

export interface ActivityEvent {
  id: string
  type: string
  label: string
  description?: string
  timestamp: string
  severity?: "info" | "success" | "warning" | "error"
  sessionId?: string
  channelId?: string
  channelName?: string
  userId?: string
  username?: string
  guildId?: string
}

// ─── Commands ────────────────────────────────────────────────────────────────

export interface Command {
  name: string
  category?: string
  description?: string
  aliases?: string[]
  usage?: string
  requiredPermission?: string
  supportsDashboard?: boolean
  requiresGuild?: boolean
  requiresVoiceChannel?: boolean
  requiresTextChannel?: boolean
  options?: CommandOption[]
}

export interface CommandOption {
  name: string
  type: string
  description?: string
  required?: boolean
  choices?: { name: string; value: string }[]
}

// ─── System ──────────────────────────────────────────────────────────────────

export interface SystemHealth {
  status: "online" | "offline" | "degraded" | "healthy"
  uptime?: number
  version?: string
  botReady?: boolean
  schedulerRunning?: boolean
  apiStatus?: string
  timestamp?: string
  // Extended fields that may come from the bot API
  apiResponseTime?: number
  memoryUsage?: string
  connections?: number
  voiceHealth?: boolean
}

export interface DatabaseStatus {
  connected: boolean
  path?: string
  tables?: DatabaseTable[]
  size?: number
  error?: string
}

export interface DatabaseTable {
  name: string
  rowCount?: number
}

// ─── API Response ─────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  ok: boolean
  data?: T
  error?: string
  details?: string
}

// ─── Log Entry ────────────────────────────────────────────────────────────────

export interface LogEntry {
  id?: string
  timestamp: string
  level: "info" | "warn" | "error" | "debug" | "warning"
  message: string
  context?: string
  source?: string
  event?: string
  details?: string
  metadata?: Record<string, unknown>
}

// BotLog is an alias for LogEntry (used by the logs page)
export type BotLog = LogEntry
