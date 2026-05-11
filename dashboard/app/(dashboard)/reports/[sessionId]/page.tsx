"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Users,
  Clock,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  Timer,
  Send,
  Loader2,
  FileText,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import ErrorPanel from "@/components/states/ErrorPanel"
import LoadingState from "@/components/states/LoadingState"
import EmptyState from "@/components/states/EmptyState"
import MetricCard from "@/components/cards/MetricCard"
import { apiFetch, formatDateTime, formatDuration, safeArray } from "@/lib/helpers"
import type { ReportDetail, ParticipantSummary, Session, TextChannel } from "@/lib/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

export default function ReportDetailPage() {
  const params = useParams()
  const sessionId = params.sessionId as string

  const [report, setReport] = useState<ReportDetail | null>(null)
  const [sessionMeta, setSessionMeta] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [posting, setPosting] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [textChannels, setTextChannels] = useState<TextChannel[]>([])
  const [postChannelId, setPostChannelId] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await apiFetch<ReportDetail>(`/api/actions/reports/${sessionId}`)
    if (res.ok && res.data) {
      setReport(res.data)
      setSessionMeta(null)
      setLoading(false)
      return
    }
    setReport(null)
    setError(res.error ?? null)
    const sRes = await apiFetch<Session>(`/api/sessions/${sessionId}`)
    if (sRes.ok && sRes.data) {
      setSessionMeta(sRes.data)
    }
    setLoading(false)
  }, [sessionId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const g = report?.guildId ?? sessionMeta?.guildId
    if (!g) return
    async function ch() {
      const res = await apiFetch<TextChannel[]>(`/api/discord/guilds/${g}/text-channels`)
      if (res.ok) setTextChannels(safeArray(res.data))
    }
    void ch()
  }, [report?.guildId, sessionMeta?.guildId])

  async function handleGenerate() {
    setGenerating(true)
    const res = await apiFetch("/api/actions/session/report", {
      method: "POST",
      body: JSON.stringify({ sessionId: Number(sessionId) || sessionId }),
    })
    if (res.ok) {
      toast.success("Report generated.")
      await load()
    } else {
      toast.error(res.error ?? "Could not generate report.")
    }
    setGenerating(false)
  }

  async function handlePost() {
    setPosting(true)
    const res = await apiFetch(`/api/actions/reports/${sessionId}/post`, {
      method: "POST",
      body: JSON.stringify({
        textChannelId: postChannelId || sessionMeta?.textChannelId || undefined,
      }),
    })
    if (res.ok) {
      toast.success("Report posted to Discord.")
    } else {
      toast.error(res.error ?? "Could not post report.")
    }
    setPosting(false)
  }

  if (loading) return <LoadingState message="Loading report…" className="mt-20" />

  if (!report) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <Link href="/reports" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to reports
        </Link>
        {error && <ErrorPanel message={error} />}
        <EmptyState
          icon={FileText}
          title="No report generated yet"
          description={
            sessionMeta
              ? "Generate a report for this session to see attendance and participation."
              : "This session may not exist, or the bot API is offline."
          }
        />
        <Button onClick={handleGenerate} disabled={generating} className="gap-2">
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          Generate report
        </Button>
      </div>
    )
  }

  const participants = safeArray<ParticipantSummary>(report.participants)
  const top = safeArray<ParticipantSummary>(report.topParticipants)
  const low = safeArray<ParticipantSummary>(report.lowActivityParticipants)
  const late = safeArray<ParticipantSummary>(report.lateJoiners)
  const early = safeArray<ParticipantSummary>(report.earlyLeavers)

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <Link href="/reports" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to reports
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{report.sessionName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDateTime(report.startedAt)}
            {report.guildName && ` · ${report.guildName}`}
            {report.voiceChannelName && ` · #${report.voiceChannelName}`}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end sm:min-w-[220px]">
          {textChannels.length > 0 && (
            <div className="space-y-1.5 w-full sm:max-w-xs">
              <Label className="text-xs text-muted-foreground">Post to channel</Label>
              <Select value={postChannelId} onValueChange={setPostChannelId}>
                <SelectTrigger>
                  <SelectValue placeholder="Default / session channel" />
                </SelectTrigger>
                <SelectContent>
                  {textChannels.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      #{c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button
            onClick={handlePost}
            disabled={posting}
            className="gap-2 shrink-0"
            variant="outline"
          >
            {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Post to Discord
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard
          title="Participants"
          value={report.participantCount ?? participants.length}
          icon={Users}
          variant="primary"
        />
        <MetricCard
          title="Duration"
          value={formatDuration(report.durationMinutes)}
          icon={Clock}
          variant="default"
        />
        <MetricCard
          title="Voice minutes"
          value={report.totalVoiceMinutes != null ? `${report.totalVoiceMinutes}m` : "—"}
          icon={Timer}
          variant="default"
        />
        <MetricCard
          title="Messages"
          value={report.totalMessages ?? "—"}
          icon={MessageSquare}
          variant="default"
        />
      </div>

      {participants.length > 0 && (
        <div className="rounded-lg border border-border bg-card">
          <div className="px-5 py-3 border-b border-border">
            <p className="text-sm font-semibold text-foreground">All participants</p>
          </div>
          <div className="divide-y divide-border">
            {participants.map((p) => (
              <ParticipantRow key={p.userId} p={p} />
            ))}
          </div>
        </div>
      )}

      {(top.length > 0 || low.length > 0 || late.length > 0 || early.length > 0) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {top.length > 0 && (
            <InsightCard
              title="Top participants"
              icon={TrendingUp}
              iconClass="text-success"
              items={top}
            />
          )}
          {low.length > 0 && (
            <InsightCard
              title="Low activity"
              icon={TrendingDown}
              iconClass="text-warning-foreground"
              items={low}
            />
          )}
          {late.length > 0 && (
            <InsightCard
              title="Late joiners"
              icon={Timer}
              iconClass="text-muted-foreground"
              items={late}
            />
          )}
          {early.length > 0 && (
            <InsightCard
              title="Left early"
              icon={ArrowLeft}
              iconClass="text-muted-foreground"
              items={early}
            />
          )}
        </div>
      )}

      {participants.length === 0 && (
        <EmptyState
          icon={FileText}
          title="No participant data"
          description="Participant data was not recorded for this session."
        />
      )}
    </div>
  )
}

function ParticipantRow({ p }: { p: ParticipantSummary }) {
  return (
    <div className="flex items-center gap-4 px-5 py-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted shrink-0">
        <span className="text-xs font-medium text-muted-foreground">
          {(p.displayName ?? p.username ?? "?").charAt(0).toUpperCase()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{p.displayName ?? p.username}</p>
        <p className="text-xs text-muted-foreground font-mono">{p.userId}</p>
      </div>
      <div className="flex items-center gap-6 text-xs text-muted-foreground">
        {p.voiceMinutes != null && (
          <span className="flex items-center gap-1">
            <Timer className="h-3 w-3" />
            {p.voiceMinutes}m
          </span>
        )}
        {p.messageCount != null && (
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            {p.messageCount}
          </span>
        )}
        {p.participationScore != null && (
          <span
            className={cn(
              "font-medium",
              p.participationScore >= 70
                ? "text-success"
                : p.participationScore >= 40
                  ? "text-warning-foreground"
                  : "text-destructive"
            )}
          >
            {p.participationScore}%
          </span>
        )}
      </div>
    </div>
  )
}

function InsightCard({
  title,
  icon: Icon,
  iconClass,
  items,
}: {
  title: string
  icon: React.ElementType
  iconClass: string
  items: ParticipantSummary[]
}) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-border">
        <Icon className={cn("h-4 w-4", iconClass)} />
        <p className="text-sm font-semibold text-foreground">{title}</p>
      </div>
      <div className="divide-y divide-border">
        {items.slice(0, 5).map((p) => (
          <div key={p.userId} className="flex items-center gap-3 px-5 py-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted shrink-0">
              <span className="text-xs text-muted-foreground">
                {(p.displayName ?? p.username ?? "?").charAt(0).toUpperCase()}
              </span>
            </div>
            <p className="text-sm text-foreground flex-1 min-w-0 truncate">
              {p.displayName ?? p.username}
            </p>
            {p.voiceMinutes != null && (
              <span className="text-xs text-muted-foreground">{p.voiceMinutes}m</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
