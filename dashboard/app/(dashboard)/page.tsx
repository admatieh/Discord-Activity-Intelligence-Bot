"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import {
  Radio,
  Calendar,
  MessageSquare,
  FileText,
  Users,
  Activity,
  Wifi,
  WifiOff,
  Database,
  Clock,
  RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import PageHeader from "@/components/layout/PageHeader"
import MetricCard from "@/components/cards/MetricCard"
import StatusBadge from "@/components/ui/status-badge"
import ErrorPanel from "@/components/states/ErrorPanel"
import EmptyState from "@/components/states/EmptyState"
import { apiFetch, formatDateTime, formatTimeAgo, formatDuration, safeArray } from "@/lib/helpers"
import type { SystemHealth, DatabaseStatus, Session, ScheduledItem, ActivityEvent, Report } from "@/lib/types"
import { cn } from "@/lib/utils"

interface HomeData {
  health: SystemHealth | null
  database: DatabaseStatus | null
  activeSession: Session | null
  scheduled: ScheduledItem[]
  activity: ActivityEvent[]
  reports: Report[]
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return "Good morning"
  if (h < 17) return "Good afternoon"
  return "Good evening"
}

export default function HomePage() {
  const [data, setData] = useState<HomeData>({
    health: null,
    database: null,
    activeSession: null,
    scheduled: [],
    activity: [],
    reports: [],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [botUnreachable, setBotUnreachable] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const [healthRes, activeRes, scheduledRes, activityRes, reportsRes] =
        await Promise.allSettled([
          apiFetch<{ health: SystemHealth; database: DatabaseStatus }>("/api/system/health"),
          apiFetch<Session[]>("/api/sessions/active"),
          apiFetch<ScheduledItem[]>("/api/actions/schedule"),
          apiFetch<ActivityEvent[]>("/api/activity?limit=8"),
          apiFetch<Report[]>("/api/actions/reports"),
        ])

      const healthOk =
        healthRes.status === "fulfilled" && healthRes.value.ok
      setBotUnreachable(!healthOk)

      const health =
        healthRes.status === "fulfilled" && healthRes.value.ok
          ? healthRes.value.data
          : null

      const activeSessions =
        activeRes.status === "fulfilled" && activeRes.value.ok
          ? safeArray<Session>(activeRes.value.data)
          : []

      const activeSession = activeSessions[0] ?? null

      const scheduled =
        scheduledRes.status === "fulfilled" && scheduledRes.value.ok
          ? safeArray<ScheduledItem>(scheduledRes.value.data)
          : []

      const activity =
        activityRes.status === "fulfilled" && activityRes.value.ok
          ? safeArray<ActivityEvent>(activityRes.value.data)
          : []

      const reports =
        reportsRes.status === "fulfilled" && reportsRes.value.ok
          ? safeArray<Report>(reportsRes.value.data)
          : []

      setData({
        health: health?.health ?? null,
        database: health?.database ?? null,
        activeSession,
        scheduled,
        activity,
        reports,
      })
      setError(null)
    } catch (err) {
      setError("Failed to load dashboard data.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(() => load(true), 30_000)
    return () => clearInterval(interval)
  }, [load])

  const now = new Date()
  const upcomingScheduled = data.scheduled
    .filter((s) => s.status === "scheduled")
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
    .slice(0, 5)

  const recentReports = data.reports.slice(0, 4)
  const botOnline = data.health?.status === "online" || data.health?.botReady === true
  const dbConnected = data.database?.connected === true

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
          <h1 className="text-2xl font-semibold text-foreground mt-0.5">{getGreeting()} — Today&apos;s workspace</h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => load(true)}
          disabled={refreshing}
          className="gap-1.5"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {error && <ErrorPanel message={error} />}
      {!loading && botUnreachable && (
        <ErrorPanel
          message="Bot API offline or unreachable. Start the bot and confirm BOT_API_URL in dashboard environment."
          offline
        />
      )}

      {/* Status row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard
          title="Bot Status"
          value={loading ? "—" : botOnline ? "Online" : "Offline"}
          subtitle={data.health?.uptime ? `Up ${formatDuration(Math.floor((data.health.uptime ?? 0) / 60))}` : undefined}
          icon={botOnline ? Wifi : WifiOff}
          variant={loading ? "default" : botOnline ? "success" : "danger"}
        />
        <MetricCard
          title="Database"
          value={loading ? "—" : dbConnected ? "Connected" : "Disconnected"}
          subtitle={data.database?.tables?.length ? `${data.database.tables.length} tables` : undefined}
          icon={Database}
          variant={loading ? "default" : dbConnected ? "success" : "danger"}
        />
        <MetricCard
          title="Live Session"
          value={data.activeSession ? data.activeSession.name || "Active" : "None"}
          subtitle={data.activeSession?.voiceChannelName ?? undefined}
          icon={Radio}
          variant={data.activeSession ? "primary" : "default"}
        />
        <MetricCard
          title="Scheduled"
          value={upcomingScheduled.length}
          subtitle="upcoming items"
          icon={Calendar}
          variant={upcomingScheduled.length > 0 ? "primary" : "default"}
        />
      </div>

      {/* Active session card */}
      {data.activeSession && (
        <div className="rounded-lg border border-primary/20 bg-accent/30 p-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                <Radio className="h-4 w-4 text-primary animate-pulse" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{data.activeSession.name || "Live Session"}</p>
                <p className="text-xs text-muted-foreground">
                  {data.activeSession.voiceChannelName
                    ? `in #${data.activeSession.voiceChannelName}`
                    : "Voice channel"}{" "}
                  · started {formatTimeAgo(data.activeSession.startedAt)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status="active" dot />
              <Button size="sm" variant="outline" asChild>
                <Link href="/record">View Session</Link>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div>
        <p className="text-sm font-medium text-muted-foreground mb-3">Quick actions</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Record a Session", desc: "Start or schedule a recording", icon: Radio, href: "/record", color: "text-primary bg-accent" },
            { label: "Schedule a Session", desc: "Plan future recordings", icon: Calendar, href: "/record", color: "text-primary bg-accent" },
            { label: "Send Message", desc: "Announce to Discord", icon: MessageSquare, href: "/messages", color: "text-primary bg-accent" },
            { label: "View Reports", desc: "Browse session reports", icon: FileText, href: "/reports", color: "text-primary bg-accent" },
          ].map((item) => (
            <Link
              key={item.href + item.label}
              href={item.href}
              className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 hover:border-primary/30 hover:bg-accent/20 transition-colors"
            >
              <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", item.color)}>
                <item.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground leading-tight">{item.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Two-column: upcoming + activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Upcoming scheduled */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-foreground">Upcoming scheduled</p>
            <Link href="/scheduled" className="text-xs text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {upcomingScheduled.length === 0 ? (
              <EmptyState
                icon={Calendar}
                title="No scheduled items"
                description="Schedule a session or message to see it here."
                className="py-8"
              />
            ) : (
              upcomingScheduled.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent shrink-0">
                    {item.type === "session" ? (
                      <Radio className="h-3.5 w-3.5 text-primary" />
                    ) : (
                      <MessageSquare className="h-3.5 w-3.5 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {item.title || (item.type === "session" ? "Scheduled session" : "Scheduled message")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(item.scheduledAt)}
                    </p>
                  </div>
                  <StatusBadge status={item.type} />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent activity */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-foreground">Recent activity</p>
            <Link href="/activity" className="text-xs text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {data.activity.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="No recent activity"
                description="Bot events will appear here."
                className="py-8"
              />
            ) : (
              data.activity.slice(0, 6).map((event) => (
                <div key={event.id} className="flex items-start gap-3 rounded-lg border border-border bg-card px-4 py-3">
                  <SeverityDot severity={event.severity} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">{event.label}</p>
                    {event.description && (
                      <p className="text-xs text-muted-foreground truncate">{event.description}</p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground shrink-0">{formatTimeAgo(event.timestamp)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent reports */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-foreground">Recent reports</p>
          <Link href="/reports" className="text-xs text-primary hover:underline">
            View all
          </Link>
        </div>
        {recentReports.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No reports yet"
            description="End a session and generate a report to see it here."
          />
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {recentReports.map((report) => (
              <Link
                key={report.sessionId}
                href={`/reports/${report.sessionId}`}
                className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 hover:border-primary/30 hover:bg-accent/10 transition-colors"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted shrink-0">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{report.sessionName}</p>
                  <p className="text-xs text-muted-foreground">
                    {report.participantCount != null ? `${report.participantCount} participants` : ""}
                    {report.durationMinutes != null ? ` · ${formatDuration(report.durationMinutes)}` : ""}
                  </p>
                </div>
                <StatusBadge status={report.status} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SeverityDot({ severity }: { severity?: string }) {
  return (
    <span
      className={cn(
        "mt-1.5 h-2 w-2 rounded-full shrink-0",
        severity === "success" ? "bg-success" :
        severity === "warning" ? "bg-warning" :
        severity === "error" ? "bg-destructive" :
        "bg-muted-foreground/40"
      )}
    />
  )
}
