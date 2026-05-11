"use client"

import { useState, useEffect, useCallback } from "react"
import { Radio, ChevronDown, AlertTriangle, CheckCircle2, Users } from "lucide-react"
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
import ErrorPanel from "@/components/states/ErrorPanel"
import LoadingState from "@/components/states/LoadingState"
import { apiFetch, safeArray } from "@/lib/helpers"
import type { Guild, VoiceChannel, TextChannel } from "@/lib/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const DURATION_PRESETS = [
  { label: "25 min", value: 25 },
  { label: "45 min", value: 45 },
  { label: "60 min", value: 60 },
  { label: "90 min", value: 90 },
]

type StartMode = "now" | "later"

export default function RecordSessionPage() {
  const [guilds, setGuilds] = useState<Guild[]>([])
  const [voiceChannels, setVoiceChannels] = useState<VoiceChannel[]>([])
  const [textChannels, setTextChannels] = useState<TextChannel[]>([])
  const [loadingGuilds, setLoadingGuilds] = useState(true)
  const [loadingChannels, setLoadingChannels] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [guildsError, setGuildsError] = useState<string | null>(null)

  // Form state
  const [sessionName, setSessionName] = useState("")
  const [selectedGuild, setSelectedGuild] = useState("")
  const [selectedVoice, setSelectedVoice] = useState("")
  const [selectedText, setSelectedText] = useState("")
  const [startMode, setStartMode] = useState<StartMode>("now")
  const [scheduledAt, setScheduledAt] = useState("")
  const [duration, setDuration] = useState<number>(60)
  const [customDuration, setCustomDuration] = useState("")
  const [isCustomDuration, setIsCustomDuration] = useState(false)
  const [tracking, setTracking] = useState({
    attendance: true,
    voiceTime: true,
    messages: true,
    reactions: false,
    joinLeaveEvents: true,
  })
  const [options, setOptions] = useState({
    includeExisting: true,
    sendAnnouncement: false,
    generateReport: true,
  })

  // Load guilds
  useEffect(() => {
    async function loadGuilds() {
      setLoadingGuilds(true)
      const res = await apiFetch<Guild[]>("/api/discord/guilds")
      if (res.ok) {
        setGuilds(safeArray(res.data))
        const arr = safeArray<Guild>(res.data)
        if (arr.length === 1) setSelectedGuild(arr[0].id)
      } else {
        setGuildsError(res.error ?? "Could not load Discord servers.")
      }
      setLoadingGuilds(false)
    }
    loadGuilds()
  }, [])

  // Load channels when guild changes
  useEffect(() => {
    if (!selectedGuild) {
      setVoiceChannels([])
      setTextChannels([])
      setSelectedVoice("")
      setSelectedText("")
      return
    }
    async function loadChannels() {
      setLoadingChannels(true)
      const [vc, tc] = await Promise.allSettled([
        apiFetch<VoiceChannel[]>(`/api/discord/guilds/${selectedGuild}/voice-channels`),
        apiFetch<TextChannel[]>(`/api/discord/guilds/${selectedGuild}/text-channels`),
      ])
      if (vc.status === "fulfilled" && vc.value.ok) {
        setVoiceChannels(safeArray(vc.value.data))
      }
      if (tc.status === "fulfilled" && tc.value.ok) {
        setTextChannels(safeArray(tc.value.data))
      }
      setSelectedVoice("")
      setSelectedText("")
      setLoadingChannels(false)
    }
    loadChannels()
  }, [selectedGuild])

  const effectiveDuration = isCustomDuration
    ? parseInt(customDuration) || 0
    : duration

  const selectedVoiceChannel = voiceChannels.find((c) => c.id === selectedVoice)
  const canSubmit =
    Boolean(selectedGuild && selectedVoice && effectiveDuration > 0 && !submitting) &&
    (startMode === "now" || Boolean(scheduledAt))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    setSubmitting(true)
    setResult(null)

    const payload =
      startMode === "now"
        ? {
            guildId: selectedGuild,
            voiceChannelId: selectedVoice,
            textChannelId: selectedText || undefined,
            title: sessionName.trim() || undefined,
            durationMinutes: effectiveDuration,
            tracking,
            options,
            requestedBy: "dashboard-admin",
            source: "dashboard",
          }
        : {
            guildId: selectedGuild,
            voiceChannelId: selectedVoice,
            textChannelId: selectedText || undefined,
            title: sessionName.trim() || undefined,
            durationMinutes: effectiveDuration,
            scheduledFor: new Date(scheduledAt).toISOString(),
            requestedBy: "dashboard-admin",
            payload: { tracking, options },
          }

    const endpoint =
      startMode === "now"
        ? "/api/actions/session/start"
        : "/api/actions/schedule/session"

    const res = await apiFetch(endpoint, {
      method: "POST",
      body: JSON.stringify(payload),
    })

    if (res.ok) {
      const msg =
        startMode === "now"
          ? "Session started successfully."
          : "Session scheduled successfully."
      setResult({ ok: true, message: msg })
      toast.success(msg)
      setSessionName("")
      setSelectedVoice("")
      setSelectedText("")
    } else {
      const msg = res.error ?? "Something went wrong."
      setResult({ ok: false, message: msg })
      toast.error(msg)
    }

    setSubmitting(false)
  }

  function toggleTracking(key: keyof typeof tracking) {
    setTracking((t) => ({ ...t, [key]: !t[key] }))
  }
  function toggleOption(key: keyof typeof options) {
    setOptions((o) => ({ ...o, [key]: !o[key] }))
  }

  if (loadingGuilds) return <LoadingState message="Loading Discord servers…" className="mt-20" />

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <PageHeader
        title="Record a Session"
        description="Start or schedule a voice session recording."
      />

      {guildsError && (
        <ErrorPanel
          message={guildsError}
          offline={guildsError.includes("offline")}
          className="mb-5"
        />
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Session name */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Session details</h2>
          <div className="space-y-1.5">
            <Label htmlFor="session-name">Session title <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              id="session-name"
              placeholder="e.g. Weekly Study Group"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
            />
          </div>
        </div>

        {/* Server and channels */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Server &amp; channels</h2>

          <div className="space-y-1.5">
            <Label>Discord server</Label>
            <Select value={selectedGuild} onValueChange={setSelectedGuild}>
              <SelectTrigger>
                <SelectValue placeholder="Select a server…" />
              </SelectTrigger>
              <SelectContent>
                {guilds.map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedGuild && (
            <>
              <div className="space-y-1.5">
                <Label>Voice channel</Label>
                {loadingChannels ? (
                  <div className="h-9 rounded-md border border-border bg-muted animate-pulse" />
                ) : (
                  <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a voice channel…" />
                    </SelectTrigger>
                    <SelectContent>
                      {voiceChannels.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                          {c.memberCount != null && (
                            <span className="ml-2 text-muted-foreground text-xs">
                              {c.memberCount} {c.memberCount === 1 ? "member" : "members"}
                            </span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {selectedVoiceChannel?.memberCount === 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-warning-foreground bg-warning-subtle border border-warning/20 rounded-md px-3 py-2">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    No one is currently in this channel, but you can still start the session.
                  </div>
                )}
                {selectedVoiceChannel && selectedVoiceChannel.memberCount != null && selectedVoiceChannel.memberCount > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    {selectedVoiceChannel.memberCount} {selectedVoiceChannel.memberCount === 1 ? "member" : "members"} in channel
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Report/update channel <span className="text-muted-foreground font-normal">(optional)</span></Label>
                {loadingChannels ? (
                  <div className="h-9 rounded-md border border-border bg-muted animate-pulse" />
                ) : (
                  <Select value={selectedText} onValueChange={setSelectedText}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a text channel…" />
                    </SelectTrigger>
                    <SelectContent>
                      {textChannels.map((c) => (
                        <SelectItem key={c.id} value={c.id}>#{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </>
          )}
        </div>

        {/* Timing */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Timing</h2>

          <div className="flex gap-2">
            {(["now", "later"] as StartMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setStartMode(mode)}
                className={cn(
                  "flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                  startMode === mode
                    ? "border-primary bg-accent text-primary"
                    : "border-border bg-background text-muted-foreground hover:bg-muted"
                )}
              >
                {mode === "now" ? "Start now" : "Schedule for later"}
              </button>
            ))}
          </div>

          {startMode === "later" && (
            <div className="space-y-1.5">
              <Label htmlFor="scheduled-at">Date &amp; time</Label>
              <Input
                id="scheduled-at"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Duration</Label>
            <div className="flex flex-wrap gap-2">
              {DURATION_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => { setDuration(preset.value); setIsCustomDuration(false) }}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                    !isCustomDuration && duration === preset.value
                      ? "border-primary bg-accent text-primary"
                      : "border-border bg-background text-muted-foreground hover:bg-muted"
                  )}
                >
                  {preset.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setIsCustomDuration(true)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                  isCustomDuration
                    ? "border-primary bg-accent text-primary"
                    : "border-border bg-background text-muted-foreground hover:bg-muted"
                )}
              >
                Custom
              </button>
            </div>
            {isCustomDuration && (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={480}
                  placeholder="Minutes"
                  value={customDuration}
                  onChange={(e) => setCustomDuration(e.target.value)}
                  className="w-32"
                />
                <span className="text-sm text-muted-foreground">minutes</span>
              </div>
            )}
          </div>
        </div>

        {/* Tracking */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Tracking options</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(Object.keys(tracking) as Array<keyof typeof tracking>).map((key) => (
              <label key={key} className="flex items-center gap-2.5 cursor-pointer">
                <Checkbox
                  checked={tracking[key]}
                  onCheckedChange={() => toggleTracking(key)}
                />
                <span className="text-sm text-foreground">{trackingLabel(key)}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Options */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Additional options</h2>
          <div className="space-y-2">
            {(Object.keys(options) as Array<keyof typeof options>).map((key) => (
              <label key={key} className="flex items-center gap-2.5 cursor-pointer">
                <Checkbox
                  checked={options[key]}
                  onCheckedChange={() => toggleOption(key)}
                />
                <span className="text-sm text-foreground">{optionLabel(key)}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Result */}
        {result && (
          <div
            className={cn(
              "flex items-start gap-3 rounded-lg border px-4 py-3",
              result.ok
                ? "border-success/20 bg-success-subtle text-success"
                : "border-destructive/20 bg-danger-subtle text-destructive"
            )}
          >
            {result.ok ? (
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            )}
            <p className="text-sm">{result.message}</p>
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-3">
          <Button
            type="submit"
            disabled={!canSubmit}
            className="gap-2"
          >
            <Radio className="h-4 w-4" />
            {startMode === "now" ? "Start Recording" : "Schedule Recording"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setSessionName("")
              setSelectedGuild("")
              setSelectedVoice("")
              setSelectedText("")
              setStartMode("now")
              setResult(null)
            }}
          >
            Reset
          </Button>
        </div>
      </form>
    </div>
  )
}

function trackingLabel(key: string): string {
  const map: Record<string, string> = {
    attendance: "Attendance",
    voiceTime: "Voice time",
    messages: "Messages",
    reactions: "Reactions",
    joinLeaveEvents: "Join / leave events",
  }
  return map[key] ?? key
}

function optionLabel(key: string): string {
  const map: Record<string, string> = {
    includeExisting: "Include users already in voice",
    sendAnnouncement: "Send announcement to Discord",
    generateReport: "Generate report when finished",
  }
  return map[key] ?? key
}
