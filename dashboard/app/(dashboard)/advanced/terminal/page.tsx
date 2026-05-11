"use client"

import { useState, useEffect, useRef } from "react"
import {
  Terminal,
  Play,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Clock,
  Hash,
  Mic,
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
import type { VoiceChannel, TextChannel } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useWorkspace } from "@/components/providers/workspace-context"

type ExecuteData = {
  success: boolean
  output: string
  message: string
  logs: string[]
  raw?: unknown
}

interface HistoryItem {
  id: string
  command: string
  timestamp: string
  ok: boolean
  output: string
  logs: string[]
  message: string
  raw?: unknown
}

const EXAMPLES = ["!help", "!whoami", "!scheduled", "!activity", "!report"]

export default function TerminalPage() {
  const {
    selectedGuildId,
    setSelectedGuildId,
    guilds,
    guildsLoading,
  } = useWorkspace()

  const [voiceChannels, setVoiceChannels] = useState<VoiceChannel[]>([])
  const [textChannels, setTextChannels] = useState<TextChannel[]>([])
  const [selectedVoice, setSelectedVoice] = useState("")
  const [selectedText, setSelectedText] = useState("")
  const [command, setCommand] = useState("")
  const [executing, setExecuting] = useState(false)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!selectedGuildId) {
      setVoiceChannels([])
      setTextChannels([])
      setSelectedVoice("")
      setSelectedText("")
      return
    }
    async function load() {
      const [vc, tc] = await Promise.allSettled([
        apiFetch<VoiceChannel[]>(
          `/api/discord/guilds/${selectedGuildId}/voice-channels`
        ),
        apiFetch<TextChannel[]>(
          `/api/discord/guilds/${selectedGuildId}/text-channels`
        ),
      ])
      if (vc.status === "fulfilled" && vc.value.ok) {
        setVoiceChannels(safeArray(vc.value.data))
      }
      if (tc.status === "fulfilled" && tc.value.ok) {
        setTextChannels(safeArray(tc.value.data))
      }
    }
    void load()
  }, [selectedGuildId])

  function insertVoiceId() {
    if (!selectedVoice) return
    setCommand((c) => (c ? `${c} ${selectedVoice}` : selectedVoice))
    inputRef.current?.focus()
  }

  function insertTextId() {
    if (!selectedText) return
    setCommand((c) => (c ? `${c} ${selectedText}` : selectedText))
    inputRef.current?.focus()
  }

  async function execute() {
    const trimmed = command.trim()
    if (!trimmed || executing) return
    setExecuting(true)

    const res = await apiFetch<ExecuteData>("/api/execute", {
      method: "POST",
      body: JSON.stringify({
        command: trimmed,
        guildId: selectedGuildId || undefined,
        voiceChannelId: selectedVoice || undefined,
        textChannelId: selectedText || undefined,
      }),
    })

    const payload = res.ok && res.data ? res.data : null
    const ok = Boolean(res.ok && payload?.success)
    const output = payload?.output ?? res.error ?? "No output"
    const logs = safeArray<string>(payload?.logs)
    const id = crypto.randomUUID()

    setHistory((h) => [
      {
        id,
        command: trimmed,
        timestamp: new Date().toISOString(),
        ok,
        output,
        logs,
        message: payload?.message ?? res.error ?? "",
        raw: payload?.raw ?? res,
      },
      ...h,
    ])
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
    <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-500">
      <PageHeader
        title="Command Terminal"
        description="Advanced tool: run bot commands with Discord context. Prefix is added automatically if you omit !"
      />

      <div className="rounded-2xl border border-border bg-card p-5 space-y-4 mb-5 shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Context
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Guild</Label>
            <Select
              value={selectedGuildId || undefined}
              onValueChange={setSelectedGuildId}
              disabled={guildsLoading || guilds.length === 0}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select guild…" />
              </SelectTrigger>
              <SelectContent>
                {guilds.map((g) => (
                  <SelectItem key={g.id} value={g.id} className="text-xs">
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Voice channel</Label>
            <div className="flex gap-1">
              <Select
                value={selectedVoice}
                onValueChange={setSelectedVoice}
                disabled={!selectedGuildId}
              >
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue placeholder="Optional…" />
                </SelectTrigger>
                <SelectContent>
                  {voiceChannels.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0"
                title="Insert voice channel ID"
                onClick={insertVoiceId}
                disabled={!selectedVoice}
              >
                <Mic className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Text channel</Label>
            <div className="flex gap-1">
              <Select
                value={selectedText}
                onValueChange={setSelectedText}
                disabled={!selectedGuildId}
              >
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue placeholder="Optional…" />
                </SelectTrigger>
                <SelectContent>
                  {textChannels.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      #{c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0"
                title="Insert text channel ID"
                onClick={insertTextId}
                disabled={!selectedText}
              >
                <Hash className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        <span className="text-xs text-muted-foreground mr-1 self-center">Try:</span>
        {EXAMPLES.map((ex) => (
          <Button
            key={ex}
            type="button"
            variant="secondary"
            size="sm"
            className="h-7 text-xs font-mono"
            onClick={() => setCommand(ex)}
          >
            {ex}
          </Button>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 mb-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            ref={inputRef}
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void execute()}
            placeholder="help or !help"
            className="font-mono text-sm border-0 shadow-none focus-visible:ring-0 px-0"
          />
          <Button
            onClick={() => void execute()}
            disabled={!command.trim() || executing}
            size="sm"
            className="gap-1.5 shrink-0"
          >
            <Play className="h-3.5 w-3.5" />
            {executing ? "Running…" : "Run"}
          </Button>
        </div>
      </div>

      {history.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              History
            </p>
            <button
              type="button"
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
                "rounded-2xl border bg-card overflow-hidden shadow-sm transition-shadow hover:shadow-md",
                item.ok ? "border-border" : "border-destructive/30"
              )}
            >
              <button
                type="button"
                className="flex w-full items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/40 text-left"
                onClick={() => toggleExpand(item.id)}
              >
                <span
                  className={cn(
                    "h-2 w-2 rounded-full shrink-0",
                    item.ok ? "bg-success" : "bg-destructive"
                  )}
                />
                <code className="flex-1 text-sm font-mono text-foreground truncate">
                  {item.command}
                </code>
                <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                  <Clock className="h-3 w-3" />
                  {formatTimeAgo(item.timestamp)}
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation()
                      rerun(item.command)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.stopPropagation()
                        rerun(item.command)
                      }
                    }}
                    className="hover:text-foreground p-0.5"
                    title="Re-run"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </span>
                </div>
                {expandedIds.has(item.id) ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
              </button>

              {expandedIds.has(item.id) && (
                <div className="border-t border-border px-4 py-3 bg-muted/20 space-y-3">
                  {!item.ok && (
                    <ErrorPanel
                      message={item.message || "Command failed"}
                      details={item.output}
                      className="mb-0"
                    />
                  )}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Output</p>
                    <pre className="text-sm font-mono text-foreground bg-background rounded-md border border-border p-3 whitespace-pre-wrap break-words max-h-72 overflow-y-auto">
                      {item.output || "(no text output)"}
                    </pre>
                  </div>
                  {item.logs.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Logs</p>
                      <ul className="text-xs font-mono text-muted-foreground list-disc pl-4 space-y-0.5">
                        {item.logs.map((l, i) => (
                          <li key={i}>{l}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-medium">
                      Raw response
                    </summary>
                    <pre className="mt-2 font-mono bg-muted rounded-md p-2 overflow-x-auto max-h-48 text-[11px]">
                      {JSON.stringify(item.raw, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {history.length === 0 && (
        <div className="text-center py-12 text-sm text-muted-foreground">
          No commands yet. Pick a server (sidebar or above), optionally voice/text channels, then run a command.
        </div>
      )}
    </div>
  )
}
