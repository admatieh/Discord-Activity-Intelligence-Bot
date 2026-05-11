"use client"

import { useState, useEffect, useCallback } from "react"
import { Activity, RefreshCw, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import PageHeader from "@/components/layout/PageHeader"
import EmptyState from "@/components/states/EmptyState"
import ErrorPanel from "@/components/states/ErrorPanel"
import LoadingState from "@/components/states/LoadingState"
import { apiFetch, formatTimeAgo, safeArray } from "@/lib/helpers"
import type { ActivityEvent } from "@/lib/types"
import { cn } from "@/lib/utils"

const SEVERITY_FILTERS = [
  { label: "All", value: "all" },
  { label: "Info", value: "info" },
  { label: "Success", value: "success" },
  { label: "Warning", value: "warning" },
  { label: "Error", value: "error" },
]

const LIMIT_OPTIONS = [25, 50, 100]

export default function ActivityPage() {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [severityFilter, setSeverityFilter] = useState("all")
  const [limit, setLimit] = useState(50)

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true)
      else setLoading(true)
      const res = await apiFetch(`/api/activity?limit=${limit}`)
      if (res.ok) {
        setEvents(safeArray(res.data))
        setError(null)
      } else {
        setError(res.error ?? "Could not load activity.")
      }
      setLoading(false)
      setRefreshing(false)
    },
    [limit]
  )

  useEffect(() => { load() }, [load])

  const filtered =
    severityFilter === "all"
      ? events
      : events.filter((e) => e.severity === severityFilter)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Activity"
        description="A human-readable feed of bot and session events."
        action={
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
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex gap-2 flex-wrap">
          {SEVERITY_FILTERS.map((f) => (
            <button
              key={f.value}
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
        <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>Show:</span>
          {LIMIT_OPTIONS.map((n) => (
            <button
              key={n}
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
          description="Bot events will appear here as they happen."
        />
      ) : (
        <div className="space-y-1">
          {filtered.map((event, index) => (
            <ActivityRow key={event.id ?? index} event={event} />
          ))}
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
          {event.type && <span className="capitalize">{event.type}</span>}
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
