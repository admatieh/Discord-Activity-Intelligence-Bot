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
  Copy,
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

  /** Snapshot for this render so nested handlers satisfy strict null checks. */
  const sessionReport = report

  const participants = safeArray<ParticipantSummary>(sessionReport.participants)
  const top = safeArray<ParticipantSummary>(sessionReport.topParticipants)
  const low = safeArray<ParticipantSummary>(sessionReport.lowActivityParticipants)
  const late = safeArray<ParticipantSummary>(sessionReport.lateJoiners)
  const early = safeArray<ParticipantSummary>(sessionReport.earlyLeavers)

  const instructorTakeaways = getInstructorTakeaways(sessionReport, participants)

  async function copySummary() {
    const lines = [
      sessionReport.sessionName,
      formatDateTime(sessionReport.startedAt),
      "",
      ...instructorTakeaways,
      "",
      `Participants: ${sessionReport.participantCount ?? participants.length}`,
      `Duration: ${formatDuration(sessionReport.durationMinutes)}`,
      `Voice minutes (total): ${sessionReport.totalVoiceMinutes ?? "—"}`,
      `Messages (total): ${sessionReport.totalMessages ?? "—"}`,
    ]
    try {
      await navigator.clipboard.writeText(lines.join("\n"))
      toast.success("Summary copied to clipboard.")
    } catch {
      toast.error("Could not copy (browser blocked clipboard).")
    }
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <Link href="/reports" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to reports
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{sessionReport.sessionName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDateTime(sessionReport.startedAt)}
            {sessionReport.guildName && ` · ${sessionReport.guildName}`}
            {sessionReport.voiceChannelName && ` · #${sessionReport.voiceChannelName}`}
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
          value={sessionReport.participantCount ?? participants.length}
          icon={Users}
          variant="primary"
        />
        <MetricCard
          title="Duration"
          value={formatDuration(sessionReport.durationMinutes)}
          icon={Clock}
          variant="default"
        />
        <MetricCard
          title="Voice minutes"
          value={sessionReport.totalVoiceMinutes != null ? `${sessionReport.totalVoiceMinutes}m` : "—"}
          icon={Timer}
          variant="default"
        />
        <MetricCard
          title="Messages"
          value={sessionReport.totalMessages ?? "—"}
          icon={MessageSquare}
          variant="default"
        />
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 md:p-6 shadow-sm transition-shadow hover:shadow-md">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">Instructor takeaways</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Simple facts from this report—no AI-generated insights.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={() => void copySummary()}>
            <Copy className="h-3.5 w-3.5" />
            Copy summary
          </Button>
        </div>
        <ul className="mt-3 space-y-1.5 text-sm text-foreground list-disc pl-5">
          {instructorTakeaways.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </div>

      {participants.length > 0 && (
        <div className="rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md overflow-hidden">
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
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-5 py-4">
      <div className="flex items-center gap-3 w-full sm:w-auto">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted shrink-0">
          <span className="text-xs font-medium text-muted-foreground">
            {(p.displayName ?? p.username ?? "?").charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{p.displayName ?? p.username}</p>
          <p className="text-xs text-muted-foreground font-mono">{p.userId}</p>
        </div>
      </div>
      <div className="flex items-center gap-6 text-xs text-muted-foreground ml-11 sm:ml-0 mt-1 sm:mt-0 w-full sm:w-auto justify-start sm:justify-end flex-1">
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

function getInstructorTakeaways(
  report: ReportDetail,
  participants: ParticipantSummary[]
): string[] {
  const lines: string[] = []
  const n = report.participantCount ?? participants.length
  if (n === 0) {
    lines.push("No participant rows were recorded for this session.")
  } else {
    lines.push(`${n} participant(s) appear on this report.`)
  }
  const withVoice = participants.filter((p) => (p.voiceMinutes ?? 0) > 0).length
  if (n > 0 && withVoice === 0) {
    lines.push("No voice minutes were logged for listed participants.")
  } else if (withVoice > 0) {
    lines.push(`${withVoice} participant(s) had logged voice time.`)
  }
  if (report.totalMessages === 0) {
    lines.push("Total counted messages from the report: 0.")
  } else if (typeof report.totalMessages === "number" && report.totalMessages > 0) {
    lines.push(`Total counted messages: ${report.totalMessages}.`)
  }
  if (report.totalVoiceMinutes === 0) {
    lines.push("Reported total voice minutes for the session: 0.")
  } else if (typeof report.totalVoiceMinutes === "number" && report.totalVoiceMinutes > 0) {
    lines.push(`Reported total voice minutes: ${report.totalVoiceMinutes}m.`)
  }
  return lines
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
    <div className="rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md overflow-hidden">
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
