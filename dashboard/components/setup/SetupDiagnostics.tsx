"use client"

import { useCallback, useEffect, useState } from "react"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { apiFetch, safeArray } from "@/lib/helpers"
import type { Command, DatabaseStatus, Guild, Session, SystemHealth } from "@/lib/types"
import { cn } from "@/lib/utils"

type CheckStatus = "pass" | "warn" | "fail" | "loading"

interface Row {
  id: string
  label: string
  status: CheckStatus
  detail: string
  fix: string
}

export default function SetupDiagnostics() {
  const [rows, setRows] = useState<Row[]>([])
  const [running, setRunning] = useState(false)

  const run = useCallback(async () => {
    setRunning(true)
    const next: Row[] = []

    const healthRes = await apiFetch<{ health: SystemHealth; database: DatabaseStatus }>(
      "/api/system/health"
    )
    if (healthRes.ok && healthRes.data) {
      const h = healthRes.data.health
      const online =
        h?.status === "online" ||
        h?.status === "healthy" ||
        h?.botReady === true
      next.push({
        id: "health",
        label: "Bot API reachable",
        status: online ? "pass" : "fail",
        detail: online
          ? "Health endpoint responded and bot reports ready."
          : "Could not confirm bot readiness from health payload.",
        fix: online
          ? ""
          : "Start the bot with `node index.js` from the repo root. Match `BOT_API_URL` and `BOT_API_KEY` between bot `.env` and dashboard `.env.local`.",
      })
      const db = healthRes.data.database
      const connected = db?.connected === true
      next.push({
        id: "db",
        label: "Database connected",
        status: connected ? "pass" : "warn",
        detail: connected
          ? "SQLite database responded on the bot."
          : "Database status missing or not connected.",
        fix: connected
          ? ""
          : "Set `DATABASE_PATH` to the same file for bot and dashboard. On Windows, use a full path. Run the bot once so the DB file is created.",
      })
    } else {
      next.push({
        id: "health",
        label: "Bot API reachable",
        status: "fail",
        detail: healthRes.error ?? "No response from combined health route.",
        fix: "Ensure the bot HTTP API is listening (default port 4000). Dashboard must proxy with `BOT_API_URL=http://127.0.0.1:4000/api`.",
      })
      next.push({
        id: "db",
        label: "Database connected",
        status: "fail",
        detail: "Could not load database status (health request failed).",
        fix: "Fix bot API connectivity first, then re-run diagnostics.",
      })
    }

    const guildsRes = await apiFetch<Guild[]>("/api/discord/guilds")
    const guilds = guildsRes.ok ? safeArray<Guild>(guildsRes.data) : []
    next.push({
      id: "guilds",
      label: "Guilds loaded",
      status: !guildsRes.ok ? "fail" : guilds.length === 0 ? "warn" : "pass",
      detail: !guildsRes.ok
        ? guildsRes.error ?? "Request failed."
        : guilds.length === 0
          ? "Bot is online but no servers were returned (bot may not be invited yet)."
          : `${guilds.length} server(s) available in the dashboard.`,
      fix: !guildsRes.ok
        ? "Check bot logs and that the bot user is in at least one server."
        : guilds.length === 0
          ? "Invite the bot with OAuth2 URL Generator (scope: bot) and pick your server."
          : "",
    })

    const cmdRes = await apiFetch<Command[]>("/api/commands")
    const cmds = cmdRes.ok ? safeArray<Command>(cmdRes.data) : []
    next.push({
      id: "commands",
      label: "Commands catalog loaded",
      status: !cmdRes.ok ? "fail" : cmds.length === 0 ? "warn" : "pass",
      detail: !cmdRes.ok
        ? cmdRes.error ?? "Could not load /api/commands."
        : `${cmds.length} command(s) registered.`,
      fix: !cmdRes.ok ? "Confirm bot API is running and routes are not blocked." : "",
    })

    const activeRes = await apiFetch<Session[]>("/api/sessions/active")
    next.push({
      id: "active",
      label: "Active sessions endpoint",
      status: activeRes.ok ? "pass" : "fail",
      detail: activeRes.ok
        ? "Active session list loaded (zero active is normal)."
        : activeRes.error ?? "Failed to load active sessions.",
      fix: activeRes.ok ? "" : "Verify session routes on the bot API and proxy `/api/sessions/active`.",
    })

    const logsRes = await apiFetch<unknown[]>("/api/logs?limit=1")
    next.push({
      id: "logs",
      label: "Technical logs endpoint",
      status: logsRes.ok ? "pass" : "fail",
      detail: logsRes.ok
        ? "Logs endpoint responded."
        : logsRes.error ?? "Could not reach logs.",
      fix: logsRes.ok ? "" : "Ensure bot implements GET /api/logs and dashboard proxies `/api/logs`.",
    })

    const actRes = await apiFetch<unknown[]>("/api/activity?limit=1")
    next.push({
      id: "activity",
      label: "Activity feed endpoint",
      status: actRes.ok ? "pass" : "fail",
      detail: actRes.ok
        ? "Activity feed responded."
        : actRes.error ?? "Activity request failed.",
      fix: actRes.ok ? "" : "Check bot activity service and `/api/activity` proxy.",
    })

    setRows(next)
    setRunning(false)
  }, [])

  useEffect(() => {
    void run()
  }, [run])

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Setup diagnostics</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Live checks against your Next.js API (no secrets shown). Re-run after changing env or
            starting the bot.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 shrink-0"
          onClick={() => void run()}
          disabled={running}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", running && "animate-spin")} />
          Re-run
        </Button>
      </div>
      <ul className="space-y-3">
        {rows.length === 0 && running && (
          <li className="text-sm text-muted-foreground">Running checks…</li>
        )}
        {rows.map((r) => (
          <li
            key={r.id}
            className="rounded-md border border-border bg-background/60 px-3 py-2.5 text-sm"
          >
            <div className="flex items-center gap-2">
              <StatusDot status={r.status} />
              <span className="font-medium text-foreground">{r.label}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 pl-5">{r.detail}</p>
            {r.fix ? (
              <p className="text-xs text-foreground/80 mt-1.5 pl-5 border-l-2 border-primary/30 ml-1">
                <span className="font-medium text-primary">How to fix: </span>
                {r.fix}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}

function StatusDot({ status }: { status: CheckStatus }) {
  return (
    <span
      className={cn(
        "h-2.5 w-2.5 rounded-full shrink-0",
        status === "pass" && "bg-success",
        status === "warn" && "bg-warning",
        status === "fail" && "bg-destructive",
        status === "loading" && "bg-muted-foreground/50 animate-pulse"
      )}
      aria-hidden
    />
  )
}
