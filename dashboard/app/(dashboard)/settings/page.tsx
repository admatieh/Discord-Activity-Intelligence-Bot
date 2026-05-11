"use client"

import Link from "next/link"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import PageHeader from "@/components/layout/PageHeader"
import { apiFetch } from "@/lib/helpers"
import type { DatabaseStatus, SystemHealth } from "@/lib/types"
import { Database, Globe, KeyRound, ShieldAlert, BookOpen } from "lucide-react"
import { useEffect, useState } from "react"

export default function SettingsPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [database, setDatabase] = useState<DatabaseStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await apiFetch<{ health: SystemHealth; database: DatabaseStatus }>(
        "/api/system/health"
      )
      if (cancelled) return
      if (res.ok && res.data) {
        setHealth(res.data.health)
        setDatabase(res.data.database)
        setError(null)
      } else {
        setHealth(null)
        setDatabase(null)
        setError(res.error ?? "Could not reach the bot API.")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const botUrl = process.env.NEXT_PUBLIC_API_BASE === "/api" ? "/api (proxied)" : "Next.js /api routes"
  const dbPath =
    typeof window !== "undefined"
      ? "Configured only on the server — see dashboard .env.local DATABASE_PATH"
      : "See DATABASE_PATH in dashboard .env.local (server-side only)."

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Settings"
        description="This build does not include user accounts or editable preferences. Use this page for connection context and links to setup."
      />

      <Alert>
        <ShieldAlert />
        <AlertTitle>Local / private mode</AlertTitle>
        <AlertDescription>
          There is no password or SSO here yet. Treat this dashboard like a local admin tool: run
          it on your machine or a trusted network, and add authentication before exposing it
          publicly.
        </AlertDescription>
      </Alert>

      {error && (
        <p className="text-sm text-destructive border border-destructive/30 rounded-lg px-3 py-2 bg-destructive/5">
          {error}
        </p>
      )}

      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div className="flex items-start gap-3">
          <Globe className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">Bot API (via Next.js)</h3>
            <p className="text-sm text-muted-foreground mt-1">
              The browser only talks to <code className="text-xs bg-muted px-1 rounded">{botUrl}</code>.
              The real bot URL and API key live in <code className="text-xs bg-muted px-1 rounded">.env.local</code>{" "}
              on the server — they are never sent to the client.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Status:{" "}
              {health?.status === "online" || health?.status === "healthy" || health?.botReady
                ? "reachable (from last health check)"
                : "unknown or offline"}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Database className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">Database</h3>
            <p className="text-sm text-muted-foreground mt-1">{dbPath}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Bot reports:{" "}
              {database?.connected === true
                ? "connected"
                : database?.connected === false
                  ? "not connected"
                  : "unknown"}
              {database?.path ? ` — path echoed from bot (server): ${database.path}` : ""}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <KeyRound className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">Instructor roles</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Configure <code className="text-xs bg-muted px-1 rounded">INSTRUCTOR_ROLE_NAME</code> or{" "}
              <code className="text-xs bg-muted px-1 rounded">INSTRUCTOR_ROLE_IDS</code> in the bot{" "}
              <code className="text-xs bg-muted px-1 rounded">.env</code>. The bot role must sit above
              the Instructor role in Server Settings → Roles if the bot assigns that role.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="default" asChild>
          <Link href="/setup" className="gap-2 inline-flex items-center">
            <BookOpen className="h-4 w-4" />
            Open Setup Guide
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/advanced/system">System health (Advanced)</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/advanced/terminal">Command terminal (Advanced)</Link>
        </Button>
      </div>
    </div>
  )
}
