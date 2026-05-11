"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Calendar,
  Radio,
  MessageSquare,
  Play,
  X,
  RefreshCw,
  AlertTriangle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import PageHeader from "@/components/layout/PageHeader"
import StatusBadge from "@/components/ui/status-badge"
import EmptyState from "@/components/states/EmptyState"
import ErrorPanel from "@/components/states/ErrorPanel"
import LoadingState from "@/components/states/LoadingState"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { apiFetch, formatDateTime, formatDuration, safeArray } from "@/lib/helpers"
import type { ScheduledItem } from "@/lib/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type FilterType = "all" | "session" | "message" | "scheduled" | "completed" | "failed" | "cancelled"

const FILTERS: { label: string; value: FilterType }[] = [
  { label: "All", value: "all" },
  { label: "Sessions", value: "session" },
  { label: "Messages", value: "message" },
  { label: "Scheduled", value: "scheduled" },
  { label: "Completed", value: "completed" },
  { label: "Failed", value: "failed" },
  { label: "Cancelled", value: "cancelled" },
]

export default function ScheduledPage() {
  const [items, setItems] = useState<ScheduledItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterType>("all")
  const [refreshing, setRefreshing] = useState(false)

  // Confirm dialog state
  const [confirmAction, setConfirmAction] = useState<{
    type: "cancel" | "run-now"
    item: ScheduledItem
  } | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    const res = await apiFetch("/api/actions/schedule")
    if (res.ok) {
      setItems(safeArray(res.data))
      setError(null)
    } else {
      setError(res.error ?? "Could not load scheduled items.")
    }
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = items.filter((item) => {
    if (filter === "all") return true
    if (filter === "session") return item.type === "session"
    if (filter === "message") return item.type === "message"
    return item.status === filter
  })

  async function handleAction(type: "cancel" | "run-now", item: ScheduledItem) {
    setActionLoading(true)
    const endpoint =
      type === "cancel"
        ? `/api/actions/schedule/${item.id}/cancel`
        : `/api/actions/schedule/${item.id}/run-now`

    const res = await apiFetch(endpoint, { method: "POST" })
    if (res.ok) {
      toast.success(type === "cancel" ? "Item cancelled." : "Item triggered.")
      load(true)
    } else {
      toast.error(res.error ?? "Action failed.")
    }
    setActionLoading(false)
    setConfirmAction(null)
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Scheduled"
        description="All planned sessions and messages."
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
      <div className="flex flex-wrap gap-2 mb-5">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              filter === f.value
                ? "border-primary bg-accent text-primary"
                : "border-border bg-card text-muted-foreground hover:bg-muted"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingState message="Loading scheduled items…" />
      ) : error ? (
        <ErrorPanel message={error} offline={error.includes("offline")} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No scheduled items"
          description="Schedule a session or message using the Record or Messages pages."
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <ScheduledItemRow
              key={item.id}
              item={item}
              onCancel={() => setConfirmAction({ type: "cancel", item })}
              onRunNow={() => setConfirmAction({ type: "run-now", item })}
            />
          ))}
        </div>
      )}

      {/* Confirm dialog */}
      <Dialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmAction?.type === "cancel" ? "Cancel scheduled item?" : "Run now?"}
            </DialogTitle>
            <DialogDescription>
              {confirmAction?.type === "cancel"
                ? `This will cancel "${confirmAction.item.title || "this item"}". This action cannot be undone.`
                : `This will immediately run "${confirmAction?.item.title || "this item"}".`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>
              Go back
            </Button>
            <Button
              variant={confirmAction?.type === "cancel" ? "destructive" : "default"}
              disabled={actionLoading}
              onClick={() => confirmAction && handleAction(confirmAction.type, confirmAction.item)}
            >
              {actionLoading
                ? "Working…"
                : confirmAction?.type === "cancel"
                ? "Yes, cancel it"
                : "Yes, run now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ScheduledItemRow({
  item,
  onCancel,
  onRunNow,
}: {
  item: ScheduledItem
  onCancel: () => void
  onRunNow: () => void
}) {
  const canAct = item.status === "scheduled"

  return (
    <div className="flex items-start gap-4 rounded-lg border border-border bg-card px-5 py-4">
      {/* Icon */}
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted shrink-0 mt-0.5">
        {item.type === "session" ? (
          <Radio className="h-4 w-4 text-primary" />
        ) : (
          <MessageSquare className="h-4 w-4 text-primary" />
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-foreground">
            {item.title || (item.type === "session" ? "Scheduled session" : "Scheduled message")}
          </p>
          <StatusBadge status={item.type} />
          <StatusBadge status={item.status} dot={item.status === "scheduled"} />
        </div>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
          <span>
            <Calendar className="inline h-3 w-3 mr-1" />
            {formatDateTime(item.scheduledAt)}
          </span>
          {item.channelName && <span>#{item.channelName}</span>}
          {item.durationMinutes && <span>{formatDuration(item.durationMinutes)}</span>}
          {item.createdBy && <span>by {item.createdBy}</span>}
        </div>
        {item.errorMessage && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            {item.errorMessage}
          </div>
        )}
      </div>

      {/* Actions */}
      {canAct && (
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1"
            onClick={onRunNow}
          >
            <Play className="h-3 w-3" />
            Run now
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-destructive hover:text-destructive gap-1"
            onClick={onCancel}
          >
            <X className="h-3 w-3" />
            Cancel
          </Button>
        </div>
      )}
    </div>
  )
}
