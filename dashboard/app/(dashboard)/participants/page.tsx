"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import {
  Users,
  Search,
  RefreshCw,
  Timer,
  MessageSquare,
  Volume2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { apiFetch, formatTimeAgo, formatDuration, safeArray } from "@/lib/helpers"
import type { Guild, Participant } from "@/lib/types"
import { cn } from "@/lib/utils"

type FilterType = "all" | "in-voice" | "tracked"

const FILTERS: { label: string; value: FilterType }[] = [
  { label: "All", value: "all" },
  { label: "In voice", value: "in-voice" },
  { label: "Tracked", value: "tracked" },
]

export default function ParticipantsPage() {
  const [guilds, setGuilds] = useState<Guild[]>([])
  const [guildId, setGuildId] = useState("")
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<FilterType>("all")
  const [selected, setSelected] = useState<Participant | null>(null)

  useEffect(() => {
    async function loadGuilds() {
      const res = await apiFetch<Guild[]>("/api/discord/guilds")
      if (res.ok) {
        const arr = safeArray<Guild>(res.data)
        setGuilds(arr)
        if (arr.length === 1) setGuildId(arr[0].id)
      }
    }
    void loadGuilds()
  }, [])

  const load = useCallback(
    async (isRefresh = false) => {
      if (!guildId) {
        setParticipants([])
        setLoading(false)
        setRefreshing(false)
        return
      }
      if (isRefresh) setRefreshing(true)
      else setLoading(true)
      const res = await apiFetch<Participant[]>(`/api/participants?guildId=${encodeURIComponent(guildId)}`)
      if (res.ok) {
        const raw = safeArray<Participant>(res.data)
        setParticipants(raw.filter((p) => !p.isBot))
        setError(null)
      } else {
        setError(res.error ?? "Could not load participants.")
      }
      setLoading(false)
      setRefreshing(false)
    },
    [guildId]
  )

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    let list = participants
    if (filter === "in-voice") list = list.filter((p) => p.currentVoiceChannel)
    if (filter === "tracked") list = list.filter((p) => (p.sessionsAttended ?? 0) > 0)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (p) =>
          (p.username ?? "").toLowerCase().includes(q) ||
          (p.displayName ?? "").toLowerCase().includes(q) ||
          (p.userId ?? "").includes(q)
      )
    }
    return list
  }, [participants, filter, search])

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Participants"
        description="Tracked users and their activity across sessions."
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

      <p className="text-sm text-muted-foreground mb-4 rounded-lg border border-border bg-accent/20 px-4 py-3">
        Live Discord members for the selected server. Tracked session stats appear when the bot has recorded activity for those users.
      </p>

      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-5">
        <div className="space-y-1.5 min-w-[200px]">
          <Label className="text-xs text-muted-foreground">Discord server</Label>
          <Select value={guildId} onValueChange={setGuildId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a server…" />
            </SelectTrigger>
            <SelectContent>
              {guilds.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search participants…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            disabled={!guildId}
          />
        </div>
        <div className="flex gap-2">
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
      </div>

      {!guildId ? (
        <EmptyState
          icon={Users}
          title="Select a server"
          description="Choose a Discord server to load its member list."
        />
      ) : loading ? (
        <LoadingState message="Loading participants…" />
      ) : error ? (
        <ErrorPanel message={error} offline={error.includes("offline")} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={search ? "No participants match your search" : "No members found"}
          description={
            search
              ? "Try a different search term."
              : "The bot may not see any non-bot members in this server, or the bot is not connected."
          }
        />
      ) : (
        <div className="space-y-1">
          {filtered.map((p) => (
            <button
              key={p.userId}
              onClick={() => setSelected(selected?.userId === p.userId ? null : p)}
              className={cn(
                "w-full flex items-center gap-4 rounded-lg border px-5 py-3 text-left transition-colors",
                selected?.userId === p.userId
                  ? "border-primary/30 bg-accent/30"
                  : "border-border bg-card hover:border-primary/20 hover:bg-accent/10"
              )}
            >
              {/* Avatar */}
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted shrink-0">
                <span className="text-sm font-medium text-muted-foreground">
                  {(p.displayName ?? p.username ?? "?").charAt(0).toUpperCase()}
                </span>
              </div>

              {/* Name / ID */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {p.displayName ?? p.username ?? "Unknown"}
                </p>
                <p className="text-xs text-muted-foreground">
                  @{p.username ?? p.userId}
                  {p.currentVoiceChannel && (
                    <span className="ml-2 text-success">
                      <Volume2 className="inline h-3 w-3 mr-0.5" />
                      {p.currentVoiceChannel}
                    </span>
                  )}
                </p>
              </div>

              {/* Stats */}
              <div className="hidden sm:flex items-center gap-5 text-xs text-muted-foreground">
                {p.sessionsAttended != null && (
                  <span>{p.sessionsAttended} sessions</span>
                )}
                {p.totalVoiceMinutes != null && (
                  <span className="flex items-center gap-1">
                    <Timer className="h-3 w-3" />
                    {formatDuration(p.totalVoiceMinutes)}
                  </span>
                )}
                {p.totalMessages != null && (
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    {p.totalMessages}
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

              {p.lastActive && (
                <span className="hidden lg:block text-xs text-muted-foreground shrink-0">
                  {formatTimeAgo(p.lastActive)}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Detail drawer */}
      {selected && (
        <div className="mt-4 rounded-lg border border-primary/20 bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent">
                <span className="text-base font-semibold text-primary">
                  {(selected.displayName ?? selected.username ?? "?").charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {selected.displayName ?? selected.username}
                </p>
                <p className="text-xs text-muted-foreground">ID: {selected.userId}</p>
              </div>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatChip label="Sessions" value={selected.sessionsAttended ?? "—"} />
            <StatChip label="Voice time" value={formatDuration(selected.totalVoiceMinutes)} />
            <StatChip label="Messages" value={selected.totalMessages ?? "—"} />
            <StatChip label="Score" value={selected.participationScore != null ? `${selected.participationScore}%` : "—"} />
          </div>

          {selected.currentVoiceChannel && (
            <div className="mt-3 flex items-center gap-2 text-xs text-success">
              <Volume2 className="h-3.5 w-3.5" />
              Currently in {selected.currentVoiceChannel}
            </div>
          )}
          {selected.lastActive && (
            <p className="mt-2 text-xs text-muted-foreground">
              Last active {formatTimeAgo(selected.lastActive)}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function StatChip({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md bg-muted px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  )
}
