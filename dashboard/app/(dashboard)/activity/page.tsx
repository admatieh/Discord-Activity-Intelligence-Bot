"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Activity, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import PageHeader from "@/components/layout/PageHeader"
import EmptyState from "@/components/states/EmptyState"
import ErrorPanel from "@/components/states/ErrorPanel"
import LoadingState from "@/components/states/LoadingState"
import { apiFetch, formatTimeAgo, safeArray } from "@/lib/helpers"
import type { ActivityEvent } from "@/lib/types"
import { cn } from "@/lib/utils"
import {
  isToday,
  isYesterday,
  isValid,
  parseISO,
} from "date-fns"
import { useWorkspace } from "@/components/providers/workspace-context"

const SEVERITY_FILTERS = [
  { label: "All", value: "all" },
  { label: "Info", value: "info" },
  { label: "Success", value: "success" },
  { label: "Warning", value: "warning" },
  { label: "Error", value: "error" },
] as const

const LIMIT_OPTIONS = [25, 50, 100]

function bucketFor(ts: string): "today" | "yesterday" | "earlier" {
  const d = parseISO(ts)
  if (!isValid(d)) return "earlier"
  if (isToday(d)) return "today"
  if (isYesterday(d)) return "yesterday"
  return "earlier"
}

export default function ActivityPage() {
  const { selectedGuildId } = useWorkspace()
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [severityFilter, setSeverityFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [limit, setLimit] = useState(50)

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true)
      else setLoading(true)
      const sp = new URLSearchParams()
      sp.set("limit", String(limit))
      if (selectedGuildId) sp.set("guildId", selectedGuildId)
      const res = await apiFetch<ActivityEvent[]>(`/api/activity?${sp.toString()}`)
      if (res.ok) {
        setEvents(safeArray(res.data))
        setError(null)
      } else {
        setError(res.error ?? "Could not load activity.")
      }
      setLoading(false)
      setRefreshing(false)
    },
    [limit, selectedGuildId]
  )

  useEffect(() => {
    void load()
  }, [load])

  const typeOptions = useMemo(() => {
    const s = new Set<string>()
    for (const e of events) {
      if (e.type) s.add(e.type)
    }
    return ["all", ...Array.from(s).sort()]
  }, [events])

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (severityFilter !== "all" && e.severity !== severityFilter) return false
      if (typeFilter !== "all" && e.type !== typeFilter) return false
      return true
    })
  }, [events, severityFilter, typeFilter])

  const grouped = useMemo(() => {
    const g: { today: ActivityEvent[]; yesterday: ActivityEvent[]; earlier: ActivityEvent[] } = {
      today: [],
      yesterday: [],
      earlier: [],
    }
    for (const e of filtered) {
      const b = bucketFor(e.timestamp)
      g[b].push(e)
    }
    return g
  }, [filtered])

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Activity"
        description="Human-readable session and bot events. Technical logs live under Advanced → Technical Logs."
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load(true)}
            disabled={refreshing}
            className="gap-1.5"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            Refresh
          </Button>
        }
      />

      {selectedGuildId && (
        <p className="text-xs text-muted-foreground mb-3">
          Filtered by the server selected in the sidebar.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex gap-2 flex-wrap">
          {SEVERITY_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setSeverityFilter(f.value)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                severityFilter === f.value
                  ? "border-primary bg-accent text-primary"
                  : "border-border bg-card text-muted-foreground hover:bg-muted"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
        >
          {typeOptions.map((t) => (
            <option key={t} value={t}>
              {t === "all" ? "All types" : t}
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>Show:</span>
          {LIMIT_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setLimit(n)}
              className={cn(
                "rounded px-2 py-0.5 transition-colors",
                limit === n
                  ? "bg-accent text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <LoadingState message="Loading activity…" />
      ) : error ? (
        <ErrorPanel message={error} offline={error.includes("offline")} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No activity yet"
          description="Activity appears when sessions, messages, and reports are created. Try clearing filters or pick another server in the sidebar."
        />
      ) : (
        <div className="space-y-8">
          {(["today", "yesterday", "earlier"] as const).map((key) => {
            const list = grouped[key]
            if (list.length === 0) return null
            const title =
              key === "today" ? "Today" : key === "yesterday" ? "Yesterday" : "Earlier"
            return (
              <section key={key}>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  {title}
                </h2>
                <div className="space-y-1.5">
                  {list.map((event, index) => (
                    <ActivityRow key={event.id ?? `${key}-${index}`} event={event} />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ActivityRow({ event }: { event: ActivityEvent }) {
  return (
    <div className="flex items-start gap-4 rounded-lg border border-border bg-card px-5 py-3.5">
      <SeverityDot severity={event.severity} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{event.label}</p>
        {event.description && (
          <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
        )}
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground/70">
          {event.channelName && <span>#{event.channelName}</span>}
          {event.username && <span>@{event.username}</span>}
          {event.sessionId && <span>Session {event.sessionId}</span>}
          {event.type && <span className="font-mono text-[10px]">{event.type}</span>}
        </div>
      </div>
      <p className="text-xs text-muted-foreground shrink-0 mt-0.5">
        {formatTimeAgo(event.timestamp)}
      </p>
    </div>
  )
}

function SeverityDot({ severity }: { severity?: string }) {
  return (
    <span
      className={cn(
        "mt-1.5 h-2 w-2 rounded-full shrink-0",
        severity === "success"
          ? "bg-success"
          : severity === "warning"
            ? "bg-warning"
            : severity === "error"
              ? "bg-destructive"
              : "bg-muted-foreground/40"
      )}
    />
  )
}
