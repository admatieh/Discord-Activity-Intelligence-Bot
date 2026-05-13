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
  Square,
  AlertTriangle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import PageHeader from "@/components/layout/PageHeader"
import MetricCard from "@/components/cards/MetricCard"
import StatusBadge from "@/components/ui/status-badge"
import ErrorPanel from "@/components/states/ErrorPanel"
import EmptyState from "@/components/states/EmptyState"
import { apiFetch, formatDateTime, formatTimeAgo, formatDuration, safeArray, parseApiDate } from "@/lib/helpers"
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

  // End Session states
  const [endDialogOpen, setEndDialogOpen] = useState(false)
  const [endingSession, setEndingSession] = useState(false)
  const [endError, setEndError] = useState<string | null>(null)
  const [endSuccess, setEndSuccess] = useState(false)
  const [reportStatus, setReportStatus] = useState<"none" | "generating" | "generated" | "failed">("none")

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

  async function handleEndSession() {
    if (!data.activeSession) return
    setEndingSession(true)
    setEndError(null)
    setEndSuccess(false)
    
    try {
      const res = await apiFetch<any>("/api/actions/session/end", {
        method: "POST",
        body: JSON.stringify({
          sessionId: data.activeSession.id,
          voiceChannelId: data.activeSession.voiceChannelId,
          requestedBy: "dashboard",
          reason: "Ended from dashboard home",
        }),
      })

      if (!res.ok) {
        setEndError(res.error || "Failed to end session.")
      } else {
        setEndSuccess(true)
        if (res.data?.reportGenerated) {
          setReportStatus("generated")
        } else if (res.data?.reportError) {
          setReportStatus("failed")
        }
        
        setTimeout(() => {
          setEndDialogOpen(false)
          setEndSuccess(false)
          setReportStatus("none")
          load(true)
        }, 3000)
      }
    } catch (e) {
      setEndError("Network error while ending session.")
    } finally {
      setEndingSession(false)
    }
  }

  useEffect(() => {
    load()
    const interval = setInterval(() => load(true), 30_000)
    return () => clearInterval(interval)
  }, [load])

  const now = new Date()
  const upcomingScheduled = data.scheduled
    .filter((s) => s.status === "scheduled")
    .sort((a, b) => {
      const tA = parseApiDate(a.scheduledAt)?.getTime() ?? 0
      const tB = parseApiDate(b.scheduledAt)?.getTime() ?? 0
      return tA - tB
    })
    .slice(0, 5)

  const recentReports = data.reports.slice(0, 4)
  const botOnline = data.health?.status === "online" || data.health?.botReady === true
  const dbConnected = data.database?.connected === true

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
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

      {!loading && !data.activeSession && (
        <div className="rounded-2xl border border-dashed border-border bg-card/60 px-5 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-sm transition-shadow hover:shadow-md">
          <div>
            <p className="text-sm font-medium text-foreground">No live session right now</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              When you start recording, a live banner appears across the workspace and your metrics
              update here.
            </p>
          </div>
          <Button asChild size="sm" className="shrink-0">
            <Link href="/record">Record a Session</Link>
          </Button>
        </div>
      )}

      {/* Active session card */}
      {data.activeSession && (
        <div className="rounded-2xl border border-primary/30 bg-card p-6 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-start gap-4 flex-1">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                <Radio className="h-6 w-6 text-primary animate-pulse" />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-foreground tracking-tight">
                    {data.activeSession.name || "Live Session"}
                  </h3>
                  <StatusBadge status="active" dot />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Radio className="h-3.5 w-3.5" />
                    <span className="truncate max-w-[200px]">
                      {data.activeSession.voiceChannelName ? `#${data.activeSession.voiceChannelName}` : "Voice channel"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Started {formatTimeAgo(data.activeSession.startedAt)}</span>
                  </div>
                  {data.activeSession.participantCount !== undefined && (
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      <span>{data.activeSession.participantCount} participants</span>
                    </div>
                  )}
                  {data.activeSession.durationMinutes !== undefined && (
                    <div className="flex items-center gap-1.5">
                      <Activity className="h-3.5 w-3.5" />
                      <span>{formatDuration(data.activeSession.durationMinutes)} elapsed</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0 w-full md:w-auto">
              <Button size="sm" variant="outline" asChild className="w-full sm:w-auto">
                <Link href="/record">View Session</Link>
              </Button>
              <Button 
                size="sm" 
                variant="destructive" 
                className="w-full sm:w-auto gap-1.5"
                onClick={() => {
                  setEndError(null)
                  setEndSuccess(false)
                  setEndDialogOpen(true)
                }}
              >
                <Square className="h-3.5 w-3.5 fill-current" />
                End Session
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* End Session Dialog */}
      <Dialog open={endDialogOpen} onOpenChange={(open) => !endingSession && setEndDialogOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End this session?</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm text-muted-foreground">
              This will stop tracking and close the active session immediately. You will be able to generate a report afterwards.
            </p>
            {endError && (
              <div className="mt-4 text-sm text-destructive bg-destructive/10 border border-destructive/20 p-3 rounded-md">
                {endError}
              </div>
            )}
            {endSuccess && (
              <div className="mt-4 text-sm space-y-2">
                <div className="text-success bg-success/10 border border-success/20 p-3 rounded-md">
                  Session ended successfully.
                </div>
                {reportStatus === "generated" && (
                  <div className="text-primary bg-primary/10 border border-primary/20 p-3 rounded-md flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Report generated successfully.
                  </div>
                )}
                {reportStatus === "failed" && (
                  <div className="text-warning bg-warning/10 border border-warning/20 p-3 rounded-md flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Session ended, but report generation failed.
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setEndDialogOpen(false)} disabled={endingSession || endSuccess}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleEndSession} disabled={endingSession || endSuccess}>
              {endingSession ? "Ending..." : "End Session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200"
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
                description="Plan a session or queue an announcement—your next five upcoming items show here."
                className="py-8"
                action={
                  <div className="flex flex-wrap gap-2 justify-center">
                    <Button size="sm" asChild>
                      <Link href="/record">Schedule session</Link>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link href="/messages">Schedule message</Link>
                    </Button>
                  </div>
                }
              />
            ) : (
              upcomingScheduled.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4 shadow-sm transition-shadow hover:shadow-md"
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
                description="Activity will appear after sessions, messages, and reports are created."
                className="py-8"
                action={
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/activity">Open Activity</Link>
                  </Button>
                }
              />
            ) : (
              data.activity.slice(0, 6).map((event) => (
                <div key={event.id} className="flex items-start gap-3 rounded-2xl border border-border bg-card px-5 py-4 shadow-sm transition-shadow hover:shadow-md">
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
            description="Generate a report after you end a session to review attendance and participation."
            action={
              <div className="flex flex-wrap gap-2 justify-center">
                <Button size="sm" asChild>
                  <Link href="/record">Record a Session</Link>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href="/reports">Browse Reports</Link>
                </Button>
              </div>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {recentReports.map((report) => (
              <Link
                key={report.sessionId}
                href={`/reports/${report.sessionId}`}
                className="flex items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200"
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
