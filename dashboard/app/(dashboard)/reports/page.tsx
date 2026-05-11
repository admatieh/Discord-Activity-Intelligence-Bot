"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { FileText, RefreshCw, Loader2, Users, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import PageHeader from "@/components/layout/PageHeader"
import StatusBadge from "@/components/ui/status-badge"
import EmptyState from "@/components/states/EmptyState"
import ErrorPanel from "@/components/states/ErrorPanel"
import LoadingState from "@/components/states/LoadingState"
import { apiFetch, formatDateShort, formatDuration, safeArray } from "@/lib/helpers"
import type { Report } from "@/lib/types"

function listTakeawayLines(report: Report): string[] {
  const lines: string[] = []
  const n = report.participantCount
  if (n === 0) {
    lines.push("This session shows zero participants in the index—generate the report after ending, or confirm voice tracking.")
  } else if (n != null && n > 0) {
    lines.push(`${n} participant(s) in the session summary.`)
  }
  if (report.durationMinutes != null && report.durationMinutes > 0) {
    lines.push(`Scheduled or recorded duration about ${formatDuration(report.durationMinutes)}.`)
  }
  if (lines.length === 0) {
    lines.push("Open or generate the report to see attendance and participation detail.")
  }
  return lines
}
import { cn } from "@/lib/utils"
import { toast } from "sonner"

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [generating, setGenerating] = useState<string | null>(null)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    const res = await apiFetch("/api/actions/reports")
    if (res.ok) {
      setReports(safeArray(res.data))
      setError(null)
    } else {
      setError(res.error ?? "Could not load reports.")
    }
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleGenerate(sessionId: string) {
    setGenerating(sessionId)
    const res = await apiFetch("/api/actions/session/report", {
      method: "POST",
      body: JSON.stringify({ sessionId }),
    })
    if (res.ok) {
      toast.success("Report generated.")
      load(true)
    } else {
      toast.error(res.error ?? "Could not generate report.")
    }
    setGenerating(null)
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Reports"
        description="Session attendance and participation reports."
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

      {loading ? (
        <LoadingState message="Loading reports…" />
      ) : error ? (
        <ErrorPanel message={error} offline={error.includes("offline")} />
      ) : reports.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No reports yet"
          description="End a session and generate a report to see it here."
          action={
            <Button size="sm" asChild>
              <Link href="/record">Go to Record Session</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {reports.map((report) => (
            <div
              key={report.sessionId}
              className="flex items-center gap-4 rounded-lg border border-border bg-card px-5 py-4"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted shrink-0">
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{report.sessionName}</p>
                <div className="mt-0.5 flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                  {report.startedAt && <span>{formatDateShort(report.startedAt)}</span>}
                  {report.participantCount != null && (
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {report.participantCount} participants
                    </span>
                  )}
                  {report.durationMinutes != null && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDuration(report.durationMinutes)}
                    </span>
                  )}
                </div>
                <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground list-disc pl-4">
                  {listTakeawayLines(report).map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </div>
              <StatusBadge status={report.status} />
              <div className="flex items-center gap-2 shrink-0">
                {report.status === "available" && (
                  <Button size="sm" variant="outline" asChild className="h-7 text-xs">
                    <Link href={`/reports/${report.sessionId}`}>View</Link>
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  disabled={generating === report.sessionId}
                  onClick={() => handleGenerate(report.sessionId)}
                >
                  {generating === report.sessionId ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    "Generate"
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
