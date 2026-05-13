"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Calendar,
  Radio,
  MessageSquare,
  Play,
  X,
  RefreshCw,
  RefreshCcw,
  AlertTriangle,
  Clock,
  Plus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import type { ScheduledItem, VoiceChannel, TextChannel } from "@/lib/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import Link from "next/link"
import { parseApiDate, formatTimeAgo } from "@/lib/helpers"
import { isValid } from "date-fns"
import { useWorkspace } from "@/components/providers/workspace-context"

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

const DAY_OPTIONS = [
  { code: "MO", label: "Mon" },
  { code: "TU", label: "Tue" },
  { code: "WE", label: "Wed" },
  { code: "TH", label: "Thu" },
  { code: "FR", label: "Fri" },
  { code: "SA", label: "Sat" },
  { code: "SU", label: "Sun" },
]

const DURATION_PRESETS = [
  { label: "30 min", value: 30 },
  { label: "45 min", value: 45 },
  { label: "60 min", value: 60 },
  { label: "90 min", value: 90 },
  { label: "120 min", value: 120 },
]

const TIMEZONES = [
  "Asia/Beirut",
  "Asia/Riyadh",
  "Asia/Dubai",
  "Africa/Cairo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "UTC",
]

function RecurringSessionDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const { selectedGuildId, guilds, guildsLoading } = useWorkspace()
  const [guildId, setGuildId] = useState(selectedGuildId || "")
  const [voiceChannels, setVoiceChannels] = useState<VoiceChannel[]>([])
  const [textChannels, setTextChannels] = useState<TextChannel[]>([])
  const [loadingChannels, setLoadingChannels] = useState(false)

  const [title, setTitle] = useState("")
  const [voiceChannelId, setVoiceChannelId] = useState("")
  const [textChannelId, setTextChannelId] = useState("")
  const [selectedDays, setSelectedDays] = useState<string[]>(["MO", "TU", "WE", "TH"])
  const [time, setTime] = useState("09:00")
  const [timezone, setTimezone] = useState("Asia/Beirut")
  const [duration, setDuration] = useState(60)
  const [generateReport, setGenerateReport] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sync guild when context changes
  useEffect(() => {
    if (selectedGuildId) setGuildId(selectedGuildId)
  }, [selectedGuildId])

  // Load channels when guild changes
  useEffect(() => {
    if (!guildId) { setVoiceChannels([]); setTextChannels([]); return }
    setLoadingChannels(true)
    Promise.allSettled([
      apiFetch<{ channels: VoiceChannel[] }>(`/api/discord/guilds/${guildId}/voice-channels`),
      apiFetch<{ channels: TextChannel[] }>(`/api/discord/guilds/${guildId}/text-channels`),
    ]).then(([vc, tc]) => {
      if (vc.status === "fulfilled" && vc.value.ok) {
        setVoiceChannels(safeArray((vc.value.data as { channels?: VoiceChannel[] })?.channels ?? vc.value.data))
      }
      if (tc.status === "fulfilled" && tc.value.ok) {
        setTextChannels(safeArray((tc.value.data as { channels?: TextChannel[] })?.channels ?? tc.value.data))
      }
    }).finally(() => setLoadingChannels(false))
  }, [guildId])

  function toggleDay(code: string) {
    setSelectedDays((prev) =>
      prev.includes(code) ? prev.filter((d) => d !== code) : [...prev, code]
    )
  }

  async function handleSubmit() {
    setError(null)
    if (!guildId) return setError("Please select a server.")
    if (!voiceChannelId) return setError("Please select a voice channel.")
    if (selectedDays.length === 0) return setError("Select at least one day.")
    if (!time || !/^\d{2}:\d{2}$/.test(time)) return setError("Enter a valid time (HH:mm).")

    setSubmitting(true)
    const res = await apiFetch("/api/actions/schedule/recurring-session", {
      method: "POST",
      body: JSON.stringify({
        guildId,
        voiceChannelId,
        textChannelId: textChannelId || undefined,
        title: title || "Recurring Session",
        daysOfWeek: selectedDays,
        time,
        timezone,
        durationMinutes: duration,
        options: {
          generateReport
        },
        requestedBy: "dashboard",
      }),
    })
    setSubmitting(false)

    if (res.ok) {
      toast.success("Recurring session scheduled!")
      onCreated()
      onClose()
      // Reset form
      setTitle(""); setVoiceChannelId(""); setTextChannelId("")
      setSelectedDays(["MO", "TU", "WE", "TH"]); setTime("09:00"); setDuration(60)
    } else {
      setError(res.error ?? "Failed to create recurring session.")
    }
  }

  const dayNames = DAY_OPTIONS.filter(d => selectedDays.includes(d.code)).map(d => d.label).join(", ")
  const [h, m] = time.split(":").map(Number)
  const ampm = h >= 12 ? "PM" : "AM"
  const h12 = (h % 12) || 12

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCcw className="h-4 w-4 text-primary" />
            New Recurring Session
          </DialogTitle>
          <DialogDescription>
            Schedule a session that repeats automatically every week on selected days.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Server */}
          <div className="space-y-1.5">
            <Label>Server</Label>
            <Select value={guildId} onValueChange={setGuildId} disabled={guildsLoading}>
              <SelectTrigger>
                <SelectValue placeholder="Select server…" />
              </SelectTrigger>
              <SelectContent>
                {guilds.map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label>Session title</Label>
            <Input
              placeholder="e.g. Daily Study Session"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Voice channel */}
          <div className="space-y-1.5">
            <Label>Voice channel <span className="text-destructive">*</span></Label>
            <Select value={voiceChannelId} onValueChange={setVoiceChannelId} disabled={!guildId || loadingChannels}>
              <SelectTrigger>
                <SelectValue placeholder={loadingChannels ? "Loading…" : "Select voice channel…"} />
              </SelectTrigger>
              <SelectContent>
                {voiceChannels.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Text channel (optional) */}
          <div className="space-y-1.5">
            <Label>
              Report / announcement channel
              <span className="ml-1 text-xs text-muted-foreground">(optional)</span>
            </Label>
            <Select
              value={textChannelId || "__none__"}
              onValueChange={(v) => setTextChannelId(v === "__none__" ? "" : v)}
              disabled={!guildId || loadingChannels}
            >
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {textChannels.map((c) => (
                  <SelectItem key={c.id} value={c.id}>#{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Days of week */}
          <div className="space-y-2">
            <Label>Repeat on <span className="text-destructive">*</span></Label>
            <div className="flex flex-wrap gap-2">
              {DAY_OPTIONS.map((d) => {
                const active = selectedDays.includes(d.code)
                return (
                  <button
                    key={d.code}
                    type="button"
                    onClick={() => toggleDay(d.code)}
                    className={cn(
                      "w-12 rounded-lg border py-1.5 text-xs font-medium transition-all",
                      active
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:bg-accent"
                    )}
                  >
                    {d.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Time + timezone row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Time <span className="text-destructive">*</span></Label>
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label>Duration</Label>
            <div className="flex flex-wrap gap-2">
              {DURATION_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setDuration(p.value)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                    duration === p.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:bg-accent"
                  )}
                >
                  {p.label}
                </button>
              ))}
              <Input
                type="number"
                min={5}
                max={480}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="h-8 w-20 text-xs"
                placeholder="min"
              />
            </div>
          </div>

          {/* Options */}
          <div className="space-y-1.5 pt-2">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <Checkbox
                checked={generateReport}
                onCheckedChange={(checked) => setGenerateReport(!!checked)}
              />
              <span className="text-sm font-medium text-foreground">Generate report when finished</span>
            </label>
          </div>

          {/* Preview */}
          {selectedDays.length > 0 && time && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm space-y-0.5">
              <p className="font-medium text-foreground">
                🔁 {dayNames}
              </p>
              <p className="text-muted-foreground">
                {h12}:{String(m || 0).padStart(2, "0")} {ampm} · {timezone} · {duration} min
              </p>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting} className="gap-1.5">
            <RefreshCcw className="h-3.5 w-3.5" />
            {submitting ? "Scheduling…" : "Schedule recurring session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function ScheduledPage() {
  const { selectedGuildId } = useWorkspace()
  const [items, setItems] = useState<ScheduledItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterType>("all")
  const [refreshing, setRefreshing] = useState(false)
  const [showRecurringDialog, setShowRecurringDialog] = useState(false)

  // Confirm dialog state
  const [confirmAction, setConfirmAction] = useState<{
    type: "cancel" | "run-now"
    item: ScheduledItem
  } | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    const qs = selectedGuildId
      ? `?guildId=${encodeURIComponent(selectedGuildId)}`
      : ""
    const res = await apiFetch(`/api/actions/schedule${qs}`)
    if (res.ok) {
      setItems(safeArray(res.data))
      setError(null)
    } else {
      setError(res.error ?? "Could not load scheduled items.")
    }
    setLoading(false)
    setRefreshing(false)
  }, [selectedGuildId])

  useEffect(() => {
    void load()
  }, [load])

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
    <div className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-500">
      <PageHeader
        title="Scheduled"
        description="All planned sessions and messages."
        action={
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setShowRecurringDialog(true)}
              size="sm"
              className="gap-1.5"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Recurring session</span>
              <span className="sm:hidden">Recurring</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => load(true)}
              disabled={refreshing}
              className="gap-1.5"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
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
        <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-4 shadow-sm">
          <EmptyState
            icon={Calendar}
            title="No scheduled items"
            description="When you schedule a session or message, it will show up here. Pick a server in the sidebar to filter by guild."
            className="py-4"
          />
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => setShowRecurringDialog(true)} size="sm" className="gap-1.5">
              <RefreshCcw className="h-3.5 w-3.5" />
              New recurring session
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/record">Schedule one-time session</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/messages">Schedule message</Link>
            </Button>
          </div>
        </div>
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

      {/* Recurring session creation dialog */}
      <RecurringSessionDialog
        open={showRecurringDialog}
        onClose={() => setShowRecurringDialog(false)}
        onCreated={() => load(true)}
      />

      {/* Confirm action dialog */}
      <Dialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmAction?.type === "cancel" ? "Cancel scheduled item?" : "Run now?"}
            </DialogTitle>
            <DialogDescription>
              {confirmAction?.type === "cancel"
                ? `This will cancel "${confirmAction.item.title || "this item"}". ${confirmAction.item.recurring ? "The recurring schedule will stop." : "This action cannot be undone."}`
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
    <div className="flex flex-col sm:flex-row items-start gap-4 rounded-2xl border border-border bg-card px-5 py-4 shadow-sm transition-shadow hover:shadow-md">
      {/* Icon */}
      <div className={cn(
        "flex h-9 w-9 items-center justify-center rounded-md shrink-0 mt-0.5",
        item.recurring ? "bg-primary/10" : "bg-muted"
      )}>
        {item.recurring ? (
          <RefreshCcw className="h-4 w-4 text-primary" />
        ) : item.type === "session" ? (
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
          {item.recurring && (
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] font-semibold text-primary">
              <RefreshCcw className="h-2.5 w-2.5" />
              Recurring
            </span>
          )}
          <StatusBadge status={item.type} />
          <StatusBadge status={item.status} dot={item.status === "scheduled"} />
        </div>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
          {item.recurring && item.recurrenceRule ? (
            <>
              <span className="flex items-center gap-1 font-medium text-primary/80">
                <RefreshCcw className="h-3 w-3" />
                {item.recurrenceRule.daysOfWeek
                  .map((d) => ({ MO:"Mon",TU:"Tue",WE:"Wed",TH:"Thu",FR:"Fri",SA:"Sat",SU:"Sun" }[d] ?? d))
                  .join(", ")}
                {" at "}{item.recurrenceRule.time} {item.recurrenceRule.timezone}
              </span>
              {item.nextRunAt && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Next: {formatDateTime(item.nextRunAt)}
                </span>
              )}
              {item.lastRunAt && (
                <span>Last ran {formatTimeAgo(item.lastRunAt)}</span>
              )}
            </>
          ) : (
            <span>
              <Calendar className="inline h-3 w-3 mr-1" />
              {formatDateTime(item.scheduledAt)}
              {item.scheduledAt &&
                isValid(parseApiDate(item.scheduledAt)) && (
                  <span className="text-muted-foreground/80">
                    {" "}
                    ({formatTimeAgo(item.scheduledAt)})
                  </span>
                )}
            </span>
          )}
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
        <div className="flex w-full sm:w-auto items-center gap-2 mt-3 sm:mt-0 shrink-0 border-t sm:border-0 border-border pt-3 sm:pt-0">
          {!item.recurring && (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 sm:flex-none h-8 text-xs gap-1"
              onClick={onRunNow}
            >
              <Play className="h-3.5 w-3.5" />
              Run now
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="flex-1 sm:flex-none h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1"
            onClick={onCancel}
          >
            <X className="h-3.5 w-3.5" />
            {item.recurring ? "Stop recurring" : "Cancel"}
          </Button>
        </div>
      )}
    </div>
  )
}
