"use client"

import { useState, useEffect, useRef } from "react"
import {
  Terminal,
  Play,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Clock,
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
import ErrorPanel from "@/components/states/ErrorPanel"
import { apiFetch, formatTimeAgo, safeArray } from "@/lib/helpers"
import type { Guild, VoiceChannel, TextChannel } from "@/lib/types"
import { cn } from "@/lib/utils"

interface ExecutionResult {
  id: string
  command: string
  timestamp: string
  ok: boolean
  data?: unknown
  error?: string
  details?: string
}

export default function TerminalPage() {
  const [guilds, setGuilds] = useState<Guild[]>([])
  const [voiceChannels, setVoiceChannels] = useState<VoiceChannel[]>([])
  const [textChannels, setTextChannels] = useState<TextChannel[]>([])
  const [selectedGuild, setSelectedGuild] = useState("")
  const [selectedVoice, setSelectedVoice] = useState("")
  const [selectedText, setSelectedText] = useState("")
  const [command, setCommand] = useState("")
  const [executing, setExecuting] = useState(false)
  const [history, setHistory] = useState<ExecutionResult[]>([])
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function load() {
      const res = await apiFetch<Guild[]>("/api/discord/guilds")
      if (res.ok) {
        const arr = safeArray<Guild>(res.data)
        setGuilds(arr)
        if (arr.length === 1) setSelectedGuild(arr[0].id)
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (!selectedGuild) {
      setVoiceChannels([])
      setTextChannels([])
      return
    }
    async function load() {
      const [vc, tc] = await Promise.allSettled([
        apiFetch<VoiceChannel[]>(`/api/discord/guilds/${selectedGuild}/voice-channels`),
        apiFetch<TextChannel[]>(`/api/discord/guilds/${selectedGuild}/text-channels`),
      ])
      if (vc.status === "fulfilled" && vc.value.ok) setVoiceChannels(safeArray(vc.value.data))
      if (tc.status === "fulfilled" && tc.value.ok) setTextChannels(safeArray(tc.value.data))
    }
    load()
  }, [selectedGuild])

  async function execute() {
    if (!command.trim() || executing) return
    setExecuting(true)
    const payload = {
      command: command.trim(),
      guildId: selectedGuild || undefined,
      voiceChannelId: selectedVoice || undefined,
      textChannelId: selectedText || undefined,
    }
    const res = await apiFetch("/api/execute", {
      method: "POST",
      body: JSON.stringify(payload),
    })
    const inner = res.data && typeof res.data === "object"
      ? (res.data as { success?: boolean })
      : null
    const ok = res.ok && inner?.success !== false
    const id = crypto.randomUUID()
    const result: ExecutionResult = {
      id,
      command: command.trim(),
      timestamp: new Date().toISOString(),
      ok,
      data: res.data,
      error: ok ? undefined : res.error ?? "Command failed",
      details: res.details,
    }
    setHistory((h) => [result, ...h])
    setExpandedIds((s) => new Set([...s, id]))
    setCommand("")
    setExecuting(false)
    inputRef.current?.focus()
  }

  function toggleExpand(id: string) {
    setExpandedIds((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function rerun(cmd: string) {
    setCommand(cmd)
    inputRef.current?.focus()
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Command Terminal"
        description="Execute bot commands directly. For technical and admin use."
      />

      {/* Context selectors */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-4 mb-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Context</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Guild</Label>
            <Select value={selectedGuild} onValueChange={setSelectedGuild}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select guild…" />
              </SelectTrigger>
              <SelectContent>
                {guilds.map((g) => (
                  <SelectItem key={g.id} value={g.id} className="text-xs">{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Voice channel</Label>
            <Select value={selectedVoice} onValueChange={setSelectedVoice} disabled={!selectedGuild}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Optional…" />
              </SelectTrigger>
              <SelectContent>
                {voiceChannels.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Text channel</Label>
            <Select value={selectedText} onValueChange={setSelectedText} disabled={!selectedGuild}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Optional…" />
              </SelectTrigger>
              <SelectContent>
                {textChannels.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">#{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Input */}
      <div className="rounded-lg border border-border bg-card p-4 mb-5">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            ref={inputRef}
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && execute()}
            placeholder="Enter command…"
            className="font-mono text-sm border-0 shadow-none focus-visible:ring-0 px-0"
          />
          <Button
            onClick={execute}
            disabled={!command.trim() || executing}
            size="sm"
            className="gap-1.5 shrink-0"
          >
            <Play className="h-3.5 w-3.5" />
            {executing ? "Running…" : "Execute"}
          </Button>
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">History</p>
            <button
              onClick={() => setHistory([])}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <RotateCcw className="h-3 w-3" /> Clear
            </button>
          </div>
          {history.map((item) => (
            <div
              key={item.id}
              className={cn(
                "rounded-lg border bg-card overflow-hidden",
                item.ok ? "border-border" : "border-destructive/30"
              )}
            >
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/40"
                onClick={() => toggleExpand(item.id)}
              >
                <span
                  className={cn(
                    "h-2 w-2 rounded-full shrink-0",
                    item.ok ? "bg-success" : "bg-destructive"
                  )}
                />
                <code className="flex-1 text-sm font-mono text-foreground">{item.command}</code>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {formatTimeAgo(item.timestamp)}
                  <button
                    onClick={(e) => { e.stopPropagation(); rerun(item.command) }}
                    className="hover:text-foreground"
                    title="Re-run"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </button>
                </div>
                {expandedIds.has(item.id) ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>

              {expandedIds.has(item.id) && (
                <div className="border-t border-border px-4 py-3 bg-muted/20">
                  {!item.ok && (
                    <ErrorPanel
                      title={item.error ?? "Command failed"}
                      details={item.details}
                      className="mb-3"
                    />
                  )}
                  {item.data !== undefined && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">Result</p>
                      <pre className="text-xs font-mono text-foreground bg-muted rounded-md p-3 overflow-x-auto whitespace-pre-wrap break-all max-h-64">
                        {JSON.stringify(item.data, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {history.length === 0 && (
        <div className="text-center py-12 text-sm text-muted-foreground">
          No commands executed yet. Type a command above and press Execute.
        </div>
      )}
    </div>
  )
}
