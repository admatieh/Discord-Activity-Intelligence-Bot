"use client"

import { useEffect, useState, useCallback } from "react"
import PageHeader from "@/components/layout/PageHeader"
import ErrorPanel from "@/components/states/ErrorPanel"
import LoadingState from "@/components/states/LoadingState"
import { Button } from "@/components/ui/button"
import { apiFetch, formatUptime, formatDateTime } from "@/lib/helpers"
import type { SystemHealth, DatabaseStatus } from "@/lib/types"
import {
  CheckCircle2,
  AlertCircle,
  Database,
  Wifi,
  WifiOff,
  RefreshCw,
  Clock,
  Server,
  Calendar,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface HealthData {
  health: SystemHealth | null
  database: DatabaseStatus | null
}

export default function SystemPage() {
  const [data, setData] = useState<HealthData>({ health: null, database: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await apiFetch<{ health: SystemHealth; database: DatabaseStatus }>(
        "/api/system/health"
      )
      if (res.ok && res.data) {
        setData({ health: res.data.health, database: res.data.database })
        setError(null)
      } else {
        setError(res.error ?? "Could not load system status.")
        setData({ health: null, database: null })
      }
    } catch {
      setError("Failed to fetch system status.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(() => load(true), 15_000)
    return () => clearInterval(interval)
  }, [load])

  const botOnline = data.health?.status === "online" || data.health?.botReady === true
  const dbConnected = data.database?.connected === true

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <PageHeader
          title="System Health"
          description="Live status of the bot, database, and services."
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => load(true)}
          disabled={refreshing}
          className="gap-1.5 shrink-0"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <LoadingState message="Loading system status…" />
      ) : error ? (
        <ErrorPanel
          message={error}
          offline={error.toLowerCase().includes("offline")}
        />
      ) : (
        <div className="space-y-5">
          {/* Overall status */}
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Overall Status</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {botOnline ? "All systems operational." : "Bot is not responding."}
                </p>
              </div>
              {botOnline ? (
                <CheckCircle2 className="h-6 w-6 text-success" />
              ) : (
                <AlertCircle className="h-6 w-6 text-destructive" />
              )}
            </div>
          </div>

          {/* Status cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Bot status */}
            <div className="rounded-lg border border-border bg-card p-5 space-y-3">
              <div className="flex items-center gap-2">
                {botOnline ? (
                  <Wifi className="h-4 w-4 text-success" />
                ) : (
                  <WifiOff className="h-4 w-4 text-destructive" />
                )}
                <p className="text-sm font-semibold text-foreground">Bot</p>
              </div>
              <div className="space-y-2">
                <StatusRow
                  label="Status"
                  value={botOnline ? "Online" : "Offline"}
                  valueClass={botOnline ? "text-success" : "text-destructive"}
                />
                {data.health?.uptime != null && (
                  <StatusRow
                    label="Uptime"
                    value={formatUptime(data.health.uptime)}
                    icon={<Clock className="h-3 w-3" />}
                  />
                )}
                {data.health?.version && (
                  <StatusRow label="Version" value={data.health.version} />
                )}
                {data.health?.schedulerRunning != null && (
                  <StatusRow
                    label="Scheduler"
                    value={data.health.schedulerRunning ? "Running" : "Stopped"}
                    valueClass={data.health.schedulerRunning ? "text-success" : "text-warning-foreground"}
                  />
                )}
                {data.health?.timestamp && (
                  <StatusRow
                    label="Last checked"
                    value={formatDateTime(data.health.timestamp)}
                    icon={<Calendar className="h-3 w-3" />}
                  />
                )}
              </div>
            </div>

            {/* Database status */}
            <div className="rounded-lg border border-border bg-card p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Database className={cn("h-4 w-4", dbConnected ? "text-success" : "text-destructive")} />
                <p className="text-sm font-semibold text-foreground">Database</p>
              </div>
              <div className="space-y-2">
                <StatusRow
                  label="Connection"
                  value={dbConnected ? "Connected" : "Disconnected"}
                  valueClass={dbConnected ? "text-success" : "text-destructive"}
                />
                {data.database?.path && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">Path</span>
                    <span className="text-xs font-mono text-foreground break-all">
                      {data.database.path}
                    </span>
                  </div>
                )}
                {data.database?.error && (
                  <p className="text-xs text-destructive">{data.database.error}</p>
                )}
              </div>
            </div>
          </div>

          {/* Tables */}
          {data.database?.tables && data.database.tables.length > 0 && (
            <div className="rounded-lg border border-border bg-card">
              <div className="flex items-center gap-2 px-5 py-3 border-b border-border">
                <Server className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-semibold text-foreground">
                  Database tables ({data.database.tables.length})
                </p>
              </div>
              <div className="divide-y divide-border">
                {data.database.tables.map((table) => (
                  <div
                    key={table.name}
                    className="flex items-center justify-between px-5 py-2.5"
                  >
                    <span className="text-sm font-mono text-foreground">{table.name}</span>
                    {table.rowCount != null && (
                      <span className="text-xs text-muted-foreground">
                        {table.rowCount.toLocaleString()} rows
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StatusRow({
  label,
  value,
  valueClass,
  icon,
}: {
  label: string
  value: string
  valueClass?: string
  icon?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-xs font-medium text-foreground flex items-center gap-1", valueClass)}>
        {icon}
        {value}
      </span>
    </div>
  )
}
