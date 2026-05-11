"use client"

import { useState, useEffect } from "react"
import {
  MessageSquare,
  Send,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Link2,
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
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
import { apiFetch, formatDateTime, formatTimeAgo, safeArray } from "@/lib/helpers"
import type { TextChannel, MessageDelivery, ScheduledItem } from "@/lib/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useWorkspace } from "@/components/providers/workspace-context"

const TEMPLATES = [
  { label: "Session starts in 10 minutes", text: "Session starts in 10 minutes — please join the voice channel when you’re ready." },
  { label: "Please join voice", text: "We’re starting shortly. Please join the voice channel so we can take attendance." },
  { label: "Report is ready", text: "The session report is ready. Check the Reports section in the dashboard or ask your instructor for the summary." },
]

const MAX_CHARS = 2000
type SendMode = "now" | "later"

export default function MessagesPage() {
  const {
    selectedGuildId,
    setSelectedGuildId,
    guilds,
    guildsLoading,
  } = useWorkspace()
  const [textChannels, setTextChannels] = useState<TextChannel[]>([])
  const [deliveries, setDeliveries] = useState<MessageDelivery[]>([])
  const [scheduledMessages, setScheduledMessages] = useState<ScheduledItem[]>([])
  const [loadingChannels, setLoadingChannels] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string; scheduleLink?: boolean } | null>(null)

  const [selectedChannel, setSelectedChannel] = useState("")
  const [content, setContent] = useState("")
  const [sendMode, setSendMode] = useState<SendMode>("now")
  const [scheduledAt, setScheduledAt] = useState("")

  const refreshLists = async () => {
    const [deliveriesRes, scheduledRes] = await Promise.allSettled([
      apiFetch<MessageDelivery[]>("/api/actions/message/deliveries"),
      apiFetch<ScheduledItem[]>("/api/actions/schedule"),
    ])
    if (deliveriesRes.status === "fulfilled" && deliveriesRes.value.ok) {
      setDeliveries(safeArray(deliveriesRes.value.data))
    }
    if (scheduledRes.status === "fulfilled" && scheduledRes.value.ok) {
      const all = safeArray<ScheduledItem>(scheduledRes.value.data)
      setScheduledMessages(all.filter((i) => i.type === "message" && i.status === "scheduled"))
    }
  }

  useEffect(() => {
    void refreshLists()
  }, [])

  useEffect(() => {
    if (!selectedGuildId) {
      setTextChannels([])
      setSelectedChannel("")
      return
    }
    async function loadChannels() {
      setLoadingChannels(true)
      const res = await apiFetch<TextChannel[]>(
        `/api/discord/guilds/${selectedGuildId}/text-channels`
      )
      if (res.ok) setTextChannels(safeArray(res.data))
      setSelectedChannel("")
      setLoadingChannels(false)
    }
    void loadChannels()
  }, [selectedGuildId])

  const canSubmit =
    Boolean(
      selectedGuildId &&
        selectedChannel &&
        content.trim().length > 0 &&
        content.length <= MAX_CHARS &&
        !submitting
    ) && (sendMode === "now" || Boolean(scheduledAt))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    setSubmitting(true)
    setResult(null)

    const payload =
      sendMode === "now"
        ? {
            guildId: selectedGuildId,
            textChannelId: selectedChannel,
            content: content.trim(),
            requestedBy: "dashboard",
          }
        : {
            guildId: selectedGuildId,
            textChannelId: selectedChannel,
            content: content.trim(),
            scheduledFor: new Date(scheduledAt).toISOString(),
            requestedBy: "dashboard",
          }

    const endpoint =
      sendMode === "now"
        ? "/api/actions/message/send"
        : "/api/actions/schedule/message"

    const res = await apiFetch(endpoint, {
      method: "POST",
      body: JSON.stringify(payload),
    })

    if (res.ok) {
      const msg =
        sendMode === "now" ? "Message sent successfully." : "Message scheduled successfully."
      setResult({
        ok: true,
        message: msg,
        scheduleLink: sendMode === "later",
      })
      toast.success(msg)
      setContent("")
      void refreshLists()
    } else {
      const msg = res.error ?? "Something went wrong."
      setResult({ ok: false, message: msg })
      toast.error(msg)
    }
    setSubmitting(false)
  }

  const selectedChannelObj = textChannels.find((c) => c.id === selectedChannel)
  const charPct = content.length / MAX_CHARS
  const charOver = content.length > MAX_CHARS

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Messages"
        description="Send or schedule announcements to Discord channels."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Composer */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="rounded-lg border border-border bg-card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Compose message</h2>

            {/* Server */}
            <div className="space-y-1.5">
              <Label>Discord server</Label>
              <Select value={selectedGuildId} onValueChange={setSelectedGuildId} disabled={guildsLoading}>
                <SelectTrigger>
                  <SelectValue placeholder={guildsLoading ? "Loading servers…" : "Select a server…"} />
                </SelectTrigger>
                <SelectContent>
                  {guilds.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Channel */}
            <div className="space-y-1.5">
              <Label>Channel</Label>
              {loadingChannels ? (
                <div className="h-9 rounded-md border border-border bg-muted animate-pulse" />
              ) : (
                <Select value={selectedChannel} onValueChange={setSelectedChannel} disabled={!selectedGuildId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a channel…" />
                  </SelectTrigger>
                  <SelectContent>
                    {textChannels.map((c) => (
                      <SelectItem key={c.id} value={c.id}>#{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Message body */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="message-body">Message</Label>
                <span className={cn("text-xs", charOver ? "text-destructive" : "text-muted-foreground")}>
                  {content.length}/{MAX_CHARS}
                </span>
              </div>
              <Textarea
                id="message-body"
                placeholder="Write your announcement…"
                rows={5}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className={cn(charOver && "border-destructive focus-visible:ring-destructive")}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Quick templates</Label>
              <div className="flex flex-wrap gap-2">
                {TEMPLATES.map((t) => (
                  <Button
                    key={t.label}
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setContent(t.text)}
                  >
                    {t.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Send mode */}
            <div className="space-y-2">
              <Label>When to send</Label>
              <div className="flex gap-2">
                {(["now", "later"] as SendMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSendMode(mode)}
                    className={cn(
                      "flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                      sendMode === mode
                        ? "border-primary bg-accent text-primary"
                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {mode === "now" ? "Send now" : "Schedule"}
                  </button>
                ))}
              </div>
              {sendMode === "later" && (
                <div className="space-y-1.5">
                  <Label htmlFor="msg-scheduled-at">Date &amp; time</Label>
                  <Input
                    id="msg-scheduled-at"
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Preview */}
          {content.trim() && (
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">Preview</p>
              <div className="rounded-md bg-muted px-3 py-2">
                <p className="text-xs text-muted-foreground mb-0.5">
                  #{selectedChannelObj?.name ?? "channel"}
                </p>
                <p className="text-sm text-foreground whitespace-pre-wrap break-words">{content}</p>
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div
              className={cn(
                "rounded-lg border px-4 py-3 space-y-2",
                result.ok
                  ? "border-success/20 bg-success-subtle text-success"
                  : "border-destructive/20 bg-danger-subtle text-destructive"
              )}
            >
              <div className="flex items-start gap-3">
                {result.ok ? (
                  <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                )}
                <p className="text-sm font-medium">{result.message}</p>
              </div>
              {result.ok && result.scheduleLink && (
                <Button variant="outline" size="sm" className="gap-1.5 w-full sm:w-auto border-success/30" asChild>
                  <Link href="/scheduled">
                    <Link2 className="h-3.5 w-3.5" /> View scheduled
                  </Link>
                </Button>
              )}
            </div>
          )}

          <Button type="submit" disabled={!canSubmit} className="gap-2 w-full">
            {sendMode === "now" ? (
              <><Send className="h-4 w-4" /> Send Message</>
            ) : (
              <><Calendar className="h-4 w-4" /> Schedule Message</>
            )}
          </Button>
        </form>

        {/* Right side: deliveries + scheduled */}
        <div className="space-y-6">
          {/* Scheduled messages */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-foreground">Scheduled messages</p>
              <span className="text-xs text-muted-foreground">{scheduledMessages.length} pending</span>
            </div>
            {scheduledMessages.length === 0 ? (
              <EmptyState
                icon={Calendar}
                title="No scheduled messages"
                description="Schedule a message to see it here."
                className="py-8"
              />
            ) : (
              <div className="space-y-2">
                {scheduledMessages.slice(0, 5).map((item) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
                    <Calendar className="h-4 w-4 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{item.title || "Scheduled message"}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(item.scheduledAt)}</p>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent deliveries */}
          <div>
            <p className="text-sm font-medium text-foreground mb-3">Recent deliveries</p>
            {deliveries.length === 0 ? (
              <EmptyState
                icon={MessageSquare}
                title="No messages sent yet"
                description="Sent messages will appear here."
                className="py-8"
              />
            ) : (
              <div className="space-y-2">
                {deliveries.slice(0, 8).map((d) => (
                  <div key={d.id} className="flex items-start gap-3 rounded-lg border border-border bg-card px-4 py-3">
                    <div className={cn(
                      "mt-0.5 h-2 w-2 rounded-full shrink-0",
                      d.status === "sent" ? "bg-success" :
                      d.status === "failed" ? "bg-destructive" :
                      "bg-muted-foreground/40"
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{d.content}</p>
                      <p className="text-xs text-muted-foreground">
                        #{d.channelName ?? d.channelId} · {formatTimeAgo(d.sentAt)}
                      </p>
                    </div>
                    <StatusBadge status={d.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
