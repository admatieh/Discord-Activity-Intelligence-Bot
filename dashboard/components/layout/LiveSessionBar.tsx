"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Radio, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { apiFetch, formatDuration, safeArray } from "@/lib/helpers"
import type { Session } from "@/lib/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { differenceInMinutes, parseISO } from "date-fns"

export function LiveSessionBar() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [endingId, setEndingId] = useState<string | null>(null)
  const [confirmEnd, setConfirmEnd] = useState<Session | null>(null)

  const load = useCallback(async () => {
    const res = await apiFetch<Session[]>("/api/sessions/active")
    if (res.ok) setSessions(safeArray(res.data))
    else setSessions([])
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
    const t = setInterval(() => void load(), 45_000)
    return () => clearInterval(t)
  }, [load])

  async function endSession(s: Session) {
    setEndingId(s.id)
    const res = await apiFetch("/api/actions/session/end", {
      method: "POST",
      body: JSON.stringify({
        sessionId: Number(s.id) || s.id,
        voiceChannelId: s.voiceChannelId || undefined,
        requestedBy: "dashboard",
        reason: "Ended from dashboard",
      }),
    })
    setEndingId(null)
    setConfirmEnd(null)
    if (res.ok) {
      toast.success("Session ended.")
      void load()
    } else {
      toast.error(res.error ?? "Could not end session.")
    }
  }

  if (loading && sessions.length === 0) return null
  if (sessions.length === 0) return null

  const primary = sessions[0]
  const started = primary.startedAt ? parseISO(primary.startedAt) : null
  const elapsed =
    started && !Number.isNaN(started.getTime())
      ? Math.max(0, differenceInMinutes(new Date(), started))
      : null

  return (
    <>
      <div
        className={cn(
          "shrink-0 border-b border-primary/15 bg-accent/40 px-4 py-2.5",
          "flex flex-wrap items-center justify-between gap-2"
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 shrink-0">
            <Radio className="h-3.5 w-3.5 text-primary animate-pulse" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">
              {sessions.length === 1 ? "Recording now" : `${sessions.length} live sessions`}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              {primary.name || "Live session"}
              {primary.voiceChannelName ? ` · ${primary.voiceChannelName}` : ""}
              {elapsed != null ? ` · ${formatDuration(elapsed)} elapsed` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
            <Link href="/record">View</Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={() => setConfirmEnd(primary)}
            disabled={endingId !== null}
          >
            {endingId === primary.id ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <X className="h-3 w-3" />
            )}
            End
          </Button>
        </div>
      </div>

      <AlertDialog open={!!confirmEnd} onOpenChange={() => setConfirmEnd(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End this session?</AlertDialogTitle>
            <AlertDialogDescription>
              This stops recording for{" "}
              <span className="font-medium text-foreground">
                {confirmEnd?.name ?? "the active session"}
              </span>
              . You can generate a report afterward from Reports.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmEnd && void endSession(confirmEnd)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              End session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
