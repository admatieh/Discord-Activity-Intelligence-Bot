/**
 * Maps raw bot API payloads into dashboard-friendly shapes.
 * Keeps pages tolerant of snake_case / nested bot responses.
 */

import type {
  ActivityEvent,
  DatabaseStatus,
  DatabaseTable,
  MessageDelivery,
  Participant,
  Report,
  ReportDetail,
  ScheduledItem,
  Session,
  SystemHealth,
} from "@/lib/types"

export function mapSystemHealth(raw: Record<string, unknown> | null): SystemHealth | null {
  if (!raw || typeof raw !== "object") return null
  const botReady = Boolean(raw.botReady)
  const statusStr = typeof raw.status === "string" ? raw.status : undefined
  return {
    status:
      statusStr === "online" || botReady
        ? "online"
        : statusStr === "degraded"
          ? "degraded"
          : "offline",
    uptime: typeof raw.uptime === "number" ? raw.uptime : undefined,
    version: typeof raw.version === "string" ? raw.version : undefined,
    botReady,
    timestamp: typeof raw.timestamp === "string" ? raw.timestamp : undefined,
    memoryUsage:
      raw.memory && typeof raw.memory === "object" && raw.memory !== null && "heapUsed" in raw.memory
        ? String((raw.memory as { heapUsed?: string }).heapUsed)
        : undefined,
  }
}

export function mapDatabaseStatus(raw: Record<string, unknown> | null): DatabaseStatus | null {
  if (!raw || typeof raw !== "object") return null
  const path = typeof raw.path === "string" ? raw.path : undefined
  const counts = raw.counts && typeof raw.counts === "object" && raw.counts !== null
    ? (raw.counts as Record<string, number>)
    : undefined

  let tables: DatabaseTable[] | undefined
  if (Array.isArray(raw.tables)) {
    const names = raw.tables.filter((t): t is string => typeof t === "string")
    tables = names.map((name) => ({
      name,
      rowCount: counts?.[name],
    }))
  } else if (tables === undefined && counts) {
    tables = Object.keys(counts).map((name) => ({
      name,
      rowCount: counts[name],
    }))
  }

  const hasPath = Boolean(path)
  const hasTables = Boolean(tables && tables.length > 0)

  return {
    connected: raw.ok === true || hasTables || hasPath,
    path,
    tables: tables ?? [],
    error: typeof raw.error === "string" ? raw.error : undefined,
  }
}

export function mapSessionRow(row: Record<string, unknown>): Session {
  const id = row.id != null ? String(row.id) : ""
  const voiceId = (row.voice_channel_id ?? row.channel_id) as string | undefined
  return {
    id,
    name: (row.title as string) || `Session #${id}`,
    guildId: String(row.guild_id ?? ""),
    voiceChannelId: voiceId ? String(voiceId) : "",
    textChannelId: row.text_channel_id ? String(row.text_channel_id) : undefined,
    status: row.end_time ? "ended" : "active",
    startedAt: row.start_time ? String(row.start_time) : undefined,
    endedAt: row.end_time ? String(row.end_time) : undefined,
    durationMinutes:
      typeof row.duration_minutes === "number" ? row.duration_minutes : undefined,
    voiceChannelName: row.voice_channel_name
      ? String(row.voice_channel_name)
      : undefined,
  }
}

export function mapScheduledRow(row: Record<string, unknown>): ScheduledItem {
  const id = row.id != null ? String(row.id) : ""
  const type = row.type === "message" ? "message" : "session"
  const ch =
    type === "session"
      ? (row.voice_channel_id as string | undefined)
      : (row.text_channel_id as string | undefined)

  // Parse recurrence_rule if present
  let recurrenceRule: ScheduledItem["recurrenceRule"] | undefined
  const ruleRaw = row.recurrence_rule
  if (ruleRaw && typeof ruleRaw === "string") {
    try {
      const parsed = JSON.parse(ruleRaw)
      if (parsed && parsed.frequency === "weekly" && Array.isArray(parsed.daysOfWeek)) {
        recurrenceRule = {
          frequency: "weekly",
          daysOfWeek: parsed.daysOfWeek as string[],
          time: String(parsed.time ?? ""),
          timezone: String(parsed.timezone ?? "Asia/Beirut"),
        }
      }
    } catch { /* ignore malformed rule */ }
  }

  return {
    id,
    type,
    title: row.title ? String(row.title) : undefined,
    status: (row.status as ScheduledItem["status"]) || "scheduled",
    scheduledAt: row.scheduled_for ? String(row.scheduled_for) : "",
    guildId: row.guild_id ? String(row.guild_id) : undefined,
    channelId: ch ? String(ch) : undefined,
    durationMinutes:
      typeof row.duration_minutes === "number" ? row.duration_minutes : undefined,
    createdBy: row.created_by ? String(row.created_by) : undefined,
    errorMessage: row.error ? String(row.error) : undefined,
    recurring: !!recurrenceRule,
    recurrenceRule,
    nextRunAt: row.next_run_at ? String(row.next_run_at) : undefined,
    lastRunAt: row.last_run_at ? String(row.last_run_at) : undefined,
  }
}

export function mapActivityFeedEntry(row: Record<string, unknown>): ActivityEvent {
  const ts = row.timestamp ? String(row.timestamp) : new Date().toISOString()
  const id =
    row.id != null
      ? String(row.id)
      : `evt_${String(row.type ?? "event")}_${ts.replace(/[:.]/g, "-")}`
  const label = row.label != null ? String(row.label) : "Event"
  const rawSev = row.severity != null ? String(row.severity).toLowerCase() : "info"
  const severity: ActivityEvent["severity"] =
    rawSev === "error" ? "error" :
    rawSev === "warn" || rawSev === "warning" ? "warning" :
    rawSev === "success" ? "success" :
    "info"
  return {
    id,
    type: row.type != null ? String(row.type) : "unknown",
    label,
    description: row.description != null ? String(row.description) : undefined,
    timestamp: ts,
    severity,
    sessionId: row.sessionId != null ? String(row.sessionId) : undefined,
    channelId: row.channelId != null ? String(row.channelId) : undefined,
    guildId: row.guildId != null ? String(row.guildId) : undefined,
    userId: row.userId != null ? String(row.userId) : undefined,
    username: row.username != null ? String(row.username) : undefined,
  }
}

export function mapReportListRow(row: Record<string, unknown>): Report {
  const sessionId = row.session_id != null ? String(row.session_id) : ""
  const rowStatus = row.status != null ? String(row.status) : ""
  return {
    sessionId,
    sessionName: (row.title as string) || `Session #${sessionId}`,
    guildId: row.guild_id ? String(row.guild_id) : undefined,
    status:
      rowStatus === "generated" || rowStatus === "posted"
        ? "available"
        : rowStatus
          ? "pending"
          : "available",
    generatedAt: row.generated_at ? String(row.generated_at) : undefined,
    startedAt: row.start_time ? String(row.start_time) : undefined,
    endedAt: row.end_time ? String(row.end_time) : undefined,
  }
}

export function mapReportDetail(raw: Record<string, unknown>): ReportDetail {
  const sessionId = raw.sessionId != null ? String(raw.sessionId) : ""
  const participants = Array.isArray(raw.participants) ? raw.participants : []
  const top = Array.isArray(raw.topParticipants) ? raw.topParticipants : []
  const lowRaw = raw.lowParticipants ?? raw.lowActivityParticipants
  const low = Array.isArray(lowRaw) ? lowRaw : []
  const lateRaw = raw.lateJoiners
  const late = Array.isArray(lateRaw) ? lateRaw : []
  const earlyRaw = raw.earlyLeavers
  const early = Array.isArray(earlyRaw) ? earlyRaw : []

  const mapParticipant = (p: Record<string, unknown>) => ({
    userId: String(p.userId ?? p.user_id ?? ""),
    username: String(p.username ?? p.userId ?? p.user_id ?? "Unknown"),
    displayName: p.displayName != null ? String(p.displayName) : undefined,
    voiceMinutes: typeof p.voiceMinutes === "number" ? p.voiceMinutes : undefined,
    messageCount: typeof p.messageCount === "number" ? p.messageCount : undefined,
    participationScore:
      typeof p.participationScore === "number" ? p.participationScore : undefined,
    joinTime: p.firstJoinTime != null ? String(p.firstJoinTime) : undefined,
    leaveTime: p.lastLeaveTime != null ? String(p.lastLeaveTime) : undefined,
    attended: p.status ? String(p.status) !== "ABSENT" : undefined,
  })

  const timelineRaw = raw.timeline
  const timeline = Array.isArray(timelineRaw)
    ? timelineRaw.map((t: Record<string, unknown>) => ({
        timestamp: String(t.joinTime ?? t.timestamp ?? ""),
        type: "voice",
        userId: t.userId != null ? String(t.userId) : undefined,
        description: t.leaveTime
          ? `Voice segment (${String(t.joinTime)} → ${String(t.leaveTime)})`
          : `Joined voice (${String(t.joinTime)})`,
      }))
    : undefined

  let totalVoice = 0
  for (const p of participants as Record<string, unknown>[]) {
    const vm = p.voiceMinutes ?? (typeof p.total_time_seconds === "number"
      ? Math.round(p.total_time_seconds / 60)
      : 0)
    if (typeof vm === "number") totalVoice += vm
  }

  return {
    sessionId,
    sessionName: (raw.title as string) || `Session #${sessionId}`,
    guildId: raw.guildId != null ? String(raw.guildId) : undefined,
    startedAt: raw.startTime != null ? String(raw.startTime) : undefined,
    endedAt: raw.endTime != null ? String(raw.endTime) : undefined,
    durationMinutes:
      typeof raw.durationMinutes === "number" ? raw.durationMinutes : undefined,
    participantCount:
      typeof raw.totalParticipants === "number"
        ? raw.totalParticipants
        : participants.length,
    totalVoiceMinutes: totalVoice || undefined,
    totalMessages:
      typeof raw.messageCounts === "number" ? raw.messageCounts : undefined,
    participants: (participants as Record<string, unknown>[]).map(mapParticipant),
    topParticipants: (top as Record<string, unknown>[]).map(mapParticipant),
    lowActivityParticipants: (low as Record<string, unknown>[]).map(mapParticipant),
    lateJoiners: (late as Record<string, unknown>[]).map((p) => ({
      userId: String(p.userId ?? ""),
      username: `User ${String(p.userId ?? "").slice(-6)}`,
      displayName:
        typeof p.joinedAfterMinutes === "number"
          ? `Joined ${p.joinedAfterMinutes} min after start`
          : undefined,
      voiceMinutes: typeof p.joinedAfterMinutes === "number" ? p.joinedAfterMinutes : undefined,
    })),
    earlyLeavers: (early as Record<string, unknown>[]).map((p) => ({
      userId: String(p.userId ?? ""),
      username: String(p.userId ?? "Unknown"),
      leaveTime: p.leftAt != null ? String(p.leftAt) : undefined,
    })),
    timeline,
    summary: raw.summary != null ? String(raw.summary) : undefined,
    guildName: raw.guildName != null ? String(raw.guildName) : undefined,
    voiceChannelName: raw.voiceChannelName != null ? String(raw.voiceChannelName) : undefined,
  }
}

export function mapMessageDeliveryRow(row: Record<string, unknown>): MessageDelivery {
  const id = row.id != null ? String(row.id) : ""
  return {
    id,
    guildId: row.guild_id != null ? String(row.guild_id) : "",
    channelId: row.text_channel_id != null ? String(row.text_channel_id) : "",
    content: row.content != null ? String(row.content) : "",
    status: (row.status as MessageDelivery["status"]) || "sent",
    sentAt: row.sent_at != null ? String(row.sent_at) : row.created_at != null ? String(row.created_at) : undefined,
    errorMessage: row.error != null ? String(row.error) : undefined,
  }
}

export function mapGuildMemberRow(row: Record<string, unknown>): Participant {
  return {
    userId: String(row.id ?? ""),
    username: String(row.username ?? "user"),
    displayName: row.displayName != null ? String(row.displayName) : undefined,
    avatar: row.avatarURL != null ? String(row.avatarURL) : undefined,
    currentVoiceChannel: row.voiceChannelName != null ? String(row.voiceChannelName) : undefined,
    isBot: row.bot === true,
    guildId: row.guildId != null ? String(row.guildId) : undefined,
    lastActive: row.joinedAt != null ? String(row.joinedAt) : undefined,
  }
}

export function mapLogRow(row: Record<string, unknown>) {
  const levelRaw = String(row.level ?? "info").toLowerCase()
  const level =
    levelRaw === "warning" ? "warn" : levelRaw === "warn" ? "warn" : levelRaw === "error"
      ? "error"
      : levelRaw === "debug"
        ? "debug"
        : "info"
  let metadata: Record<string, unknown> | undefined
  if (row.metadata_json != null) {
    try {
      metadata = JSON.parse(String(row.metadata_json)) as Record<string, unknown>
    } catch {
      metadata = undefined
    }
  }
  return {
    id: row.id != null ? String(row.id) : undefined,
    timestamp: row.created_at != null ? String(row.created_at) : "",
    level: level as "info" | "warn" | "error" | "debug" | "warning",
    message: row.message != null ? String(row.message) : "",
    source: row.source != null ? String(row.source) : undefined,
    event: row.event != null ? String(row.event) : undefined,
    details: row.context != null ? String(row.context) : undefined,
    metadata,
  }
}
