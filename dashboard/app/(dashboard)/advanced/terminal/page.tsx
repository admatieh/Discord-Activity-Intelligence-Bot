'use client'

import { useState, useRef, useEffect, KeyboardEvent, useCallback } from 'react'
import { Topbar } from '@/components/dashboard/topbar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Play, X, ChevronUp, ChevronDown, Clock, CheckCircle, XCircle,
  Trash2, RotateCcw, Server, Mic, Hash, AlertTriangle, ChevronRight
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface TerminalEntry {
  id: string
  command: string
  output: string
  exitCode: number
  executionMs: number
  logs: string[]
  data: any
  timestamp: string
  status: 'running' | 'success' | 'error'
  showLogs?: boolean
  showRaw?: boolean
}

interface Guild { id: string; name: string; memberCount: number }
interface VoiceChannel { id: string; name: string; parentName?: string; memberCount: number }
interface TextChannel { id: string; name: string; parentName?: string }

// ---------------------------------------------------------------------------
// Normalize — NEVER crash on missing fields from bot response
// ---------------------------------------------------------------------------
function normalizeEntry(id: string, command: string, raw: any): Partial<TerminalEntry> {
  // Bot returns: { success, requestId, data: { output, exitCode, executionMs, logs, timestamp } }
  // OR on error: { success: false, error: string, data: null }
  const inner = raw?.data || raw || {}
  const success = raw?.success ?? (inner?.exitCode === 0)
  return {
    output: inner?.output ?? raw?.error ?? raw?.message ?? 'No output.',
    exitCode: inner?.exitCode ?? (success ? 0 : 1),
    executionMs: inner?.executionMs ?? inner?.durationMs ?? 0,
    logs: Array.isArray(inner?.logs) ? inner.logs : [],
    data: inner?.data ?? null,
    status: (inner?.exitCode === 0 || success) ? 'success' : 'error',
  }
}

const SUGGESTIONS = [
  '!health-check',
  '!bot-status',
  '!session-status',
  '!session-start --channel general-voice --duration 60',
  '!session-end',
  '!score-summary',
  '!attendance-snapshot',
  '!logs --level warn',
  '!list-sessions',
]

// ---------------------------------------------------------------------------
// Context bar
// ---------------------------------------------------------------------------
function ContextBar({
  guilds, voiceChannels, textChannels,
  selectedGuild, selectedVoice, selectedText,
  loadingGuilds, loadingChannels,
  onGuildChange, onVoiceChange, onTextChange,
}: {
  guilds: Guild[], voiceChannels: VoiceChannel[], textChannels: TextChannel[]
  selectedGuild: string, selectedVoice: string, selectedText: string
  loadingGuilds: boolean, loadingChannels: boolean
  onGuildChange: (id: string) => void
  onVoiceChange: (id: string) => void
  onTextChange: (id: string) => void
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-muted/10 flex-wrap">
      <Server className="w-3 h-3 text-muted-foreground flex-shrink-0" />
      <select
        value={selectedGuild}
        onChange={e => onGuildChange(e.target.value)}
        disabled={loadingGuilds}
        className="bg-input border border-border rounded px-2 py-1 text-[10px] font-mono text-foreground focus:outline-none focus:border-primary/50 disabled:opacity-50 min-w-[130px]"
      >
        <option value="">{loadingGuilds ? 'Loading...' : 'No server (optional)'}</option>
        {guilds.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
      </select>

      <Mic className="w-3 h-3 text-muted-foreground flex-shrink-0" />
      <select
        value={selectedVoice}
        onChange={e => onVoiceChange(e.target.value)}
        disabled={!selectedGuild || loadingChannels}
        className="bg-input border border-border rounded px-2 py-1 text-[10px] font-mono text-foreground focus:outline-none focus:border-primary/50 disabled:opacity-50 min-w-[130px]"
      >
        <option value="">No voice channel</option>
        {voiceChannels.map(c => (
          <option key={c.id} value={c.id}>{c.parentName ? `${c.parentName} / ` : ''}{c.name}</option>
        ))}
      </select>

      <Hash className="w-3 h-3 text-muted-foreground flex-shrink-0" />
      <select
        value={selectedText}
        onChange={e => onTextChange(e.target.value)}
        disabled={!selectedGuild || loadingChannels}
        className="bg-input border border-border rounded px-2 py-1 text-[10px] font-mono text-foreground focus:outline-none focus:border-primary/50 disabled:opacity-50 min-w-[130px]"
      >
        <option value="">No text channel</option>
        {textChannels.map(c => (
          <option key={c.id} value={c.id}>{c.parentName ? `${c.parentName} / ` : ''}#{c.name}</option>
        ))}
      </select>

      {(selectedGuild || selectedVoice) && (
        <span className="text-[9px] font-mono text-muted-foreground/60 flex items-center gap-1">
          <ChevronRight className="w-2.5 h-2.5" />
          Context injected into commands
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function TerminalPage() {
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<TerminalEntry[]>([])
  const [cmdHistory, setCmdHistory] = useState<string[]>([])
  const [cmdHistoryIndex, setCmdHistoryIndex] = useState(-1)
  const [isRunning, setIsRunning] = useState(false)
  const outputRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Context state
  const [guilds, setGuilds] = useState<Guild[]>([])
  const [voiceChannels, setVoiceChannels] = useState<VoiceChannel[]>([])
  const [textChannels, setTextChannels] = useState<TextChannel[]>([])
  const [selectedGuild, setSelectedGuild] = useState('')
  const [selectedVoice, setSelectedVoice] = useState('')
  const [selectedText, setSelectedText] = useState('')
  const [loadingGuilds, setLoadingGuilds] = useState(false)
  const [loadingChannels, setLoadingChannels] = useState(false)

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [history])

  useEffect(() => {
    inputRef.current?.focus()
    loadGuilds()
  }, [])

  async function loadGuilds() {
    setLoadingGuilds(true)
    try {
      const res = await fetch('/api/discord/guilds')
      const data = await res.json()
      if (data.ok && data.guilds) {
        setGuilds(data.guilds)
        if (data.guilds.length === 1) {
          setSelectedGuild(data.guilds[0].id)
          loadChannels(data.guilds[0].id)
        }
      }
    } catch {}
    setLoadingGuilds(false)
  }

  async function loadChannels(guildId: string) {
    setLoadingChannels(true)
    setSelectedVoice('')
    setSelectedText('')
    try {
      const [vr, tr] = await Promise.all([
        fetch(`/api/discord/guilds/${guildId}/voice-channels`),
        fetch(`/api/discord/guilds/${guildId}/text-channels`),
      ])
      const [vd, td] = await Promise.all([vr.json(), tr.json()])
      setVoiceChannels(vd.channels || [])
      setTextChannels(td.channels || [])
    } catch {}
    setLoadingChannels(false)
  }

  function handleGuildChange(id: string) {
    setSelectedGuild(id)
    if (id) loadChannels(id)
    else { setVoiceChannels([]); setTextChannels([]) }
  }

  async function executeCommand(cmd: string) {
    if (!cmd.trim() || isRunning) return

    const id = `entry_${Date.now()}`
    const entry: TerminalEntry = {
      id,
      command: cmd.trim(),
      output: '',
      exitCode: 0,
      executionMs: 0,
      logs: [],
      data: null,
      timestamp: new Date().toISOString(),
      status: 'running',
    }

    setHistory(prev => [...prev, entry])
    setCmdHistory(prev => [cmd.trim(), ...prev.slice(0, 49)])
    setCmdHistoryIndex(-1)
    setInput('')
    setIsRunning(true)

    try {
      const payload: any = { command: cmd.trim() }
      if (selectedGuild || selectedVoice || selectedText) {
        payload.context = {
          guildId: selectedGuild || undefined,
          voiceChannelId: selectedVoice || undefined,
          textChannelId: selectedText || undefined,
          source: 'dashboard',
          requestedBy: 'dashboard-admin',
        }
        if (selectedGuild) payload.guildId = selectedGuild
        if (selectedVoice) payload.channelId = selectedVoice
      }

      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      let raw: any = {}
      try { raw = await res.json() } catch { raw = { success: false, error: 'Invalid JSON from server' } }

      const normalized = normalizeEntry(id, cmd.trim(), raw)
      setHistory(prev =>
        prev.map(e => e.id === id ? { ...e, ...normalized } : e)
      )
    } catch (err: any) {
      setHistory(prev =>
        prev.map(e =>
          e.id === id
            ? { ...e, output: `Network error: ${err.message}`, exitCode: 1, logs: [], status: 'error' as const }
            : e
        )
      )
    } finally {
      setIsRunning(false)
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      executeCommand(input)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const nextIndex = Math.min(cmdHistoryIndex + 1, cmdHistory.length - 1)
      setCmdHistoryIndex(nextIndex)
      if (cmdHistory[nextIndex]) setInput(cmdHistory[nextIndex])
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const nextIndex = Math.max(cmdHistoryIndex - 1, -1)
      setCmdHistoryIndex(nextIndex)
      setInput(nextIndex === -1 ? '' : cmdHistory[nextIndex])
    } else if (e.key === 'Tab') {
      e.preventDefault()
      const match = SUGGESTIONS.find(s => s.startsWith(input) && s !== input)
      if (match) setInput(match)
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault()
      setHistory([])
    }
  }

  function toggleLogs(id: string) {
    setHistory(prev => prev.map(e => e.id === id ? { ...e, showLogs: !e.showLogs } : e))
  }

  function toggleRaw(id: string) {
    setHistory(prev => prev.map(e => e.id === id ? { ...e, showRaw: !e.showRaw } : e))
  }

  return (
    <div className="flex flex-col h-screen">
      <Topbar
        title="Command Terminal"
        subtitle="execute bot commands"
        badge={isRunning ? 'RUNNING' : 'READY'}
        badgeVariant={isRunning ? 'secondary' : 'default'}
        actions={
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] font-mono gap-1.5"
            onClick={() => setHistory([])}
          >
            <Trash2 className="w-3 h-3" />
            Clear
          </Button>
        }
      />

      {/* Context selectors */}
      <ContextBar
        guilds={guilds}
        voiceChannels={voiceChannels}
        textChannels={textChannels}
        selectedGuild={selectedGuild}
        selectedVoice={selectedVoice}
        selectedText={selectedText}
        loadingGuilds={loadingGuilds}
        loadingChannels={loadingChannels}
        onGuildChange={handleGuildChange}
        onVoiceChange={setSelectedVoice}
        onTextChange={setSelectedText}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Main terminal */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Output */}
          <div
            ref={outputRef}
            className="flex-1 overflow-y-auto bg-background p-4 space-y-3 terminal-scroll"
            onClick={() => inputRef.current?.focus()}
          >
            {/* Welcome */}
            {history.length === 0 && (
              <div className="font-mono text-xs text-muted-foreground space-y-1">
                <p className="text-primary font-semibold">DiscordOps Command Terminal</p>
                <p>Type a command and press Enter. Use ↑/↓ for history, Tab to autocomplete.</p>
                <p className="text-muted-foreground/60">Select a server/channel above to inject context into commands.</p>
                <p className="text-muted-foreground/60">Try: !health-check  !bot-status  !session-status</p>
                <div className="border-t border-border mt-2 pt-2" />
              </div>
            )}

            {/* Entries */}
            {history.map(entry => (
              <div key={entry.id} className="space-y-1">
                {/* Command line */}
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="text-primary flex-shrink-0">$</span>
                  <span className="text-foreground">{entry.command}</span>
                  <div className="ml-auto flex items-center gap-2 flex-shrink-0">
                    {entry.status !== 'running' && (
                      <>
                        <span className={cn(
                          'text-[9px] font-mono',
                          entry.status === 'success' ? 'text-status-online' : 'text-status-error'
                        )}>
                          exit {entry.exitCode}
                        </span>
                        <span className="text-[9px] font-mono text-muted-foreground/60">{entry.executionMs}ms</span>
                      </>
                    )}
                    {entry.status === 'running' && (
                      <span className="text-[9px] font-mono text-status-warning animate-pulse">running...</span>
                    )}
                  </div>
                </div>

                {/* Output */}
                {entry.status === 'running' ? (
                  <div className="pl-4 font-mono text-xs text-muted-foreground animate-pulse">
                    Executing...
                  </div>
                ) : (
                  <pre className={cn(
                    'pl-4 font-mono text-xs whitespace-pre-wrap leading-relaxed',
                    entry.exitCode === 0 ? 'text-foreground/90' : 'text-status-error'
                  )}>
                    {entry.output || '(no output)'}
                  </pre>
                )}

                {/* Logs toggle */}
                {(entry.logs?.length ?? 0) > 0 && entry.status !== 'running' && (
                  <div className="pl-4">
                    <button
                      onClick={() => toggleLogs(entry.id)}
                      className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {entry.showLogs ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
                      {entry.logs.length} execution log{entry.logs.length !== 1 ? 's' : ''}
                    </button>
                    {entry.showLogs && (
                      <div className="mt-1 pl-2 border-l border-border space-y-0.5">
                        {entry.logs.map((log, i) => (
                          <p key={i} className="font-mono text-[10px] text-muted-foreground">{log}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Raw JSON + rerun */}
                {entry.status !== 'running' && (
                  <div className="pl-4 flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      {entry.status === 'success'
                        ? <CheckCircle className="w-3 h-3 text-status-online" />
                        : <XCircle className="w-3 h-3 text-status-error" />}
                    </div>
                    {entry.data && (
                      <button
                        onClick={() => toggleRaw(entry.id)}
                        className="text-[9px] font-mono text-muted-foreground/50 hover:text-muted-foreground"
                      >
                        {entry.showRaw ? 'hide json' : 'show json'}
                      </button>
                    )}
                    <button
                      onClick={() => executeCommand(entry.command)}
                      disabled={isRunning}
                      className="text-[9px] font-mono text-muted-foreground/50 hover:text-muted-foreground flex items-center gap-0.5 disabled:opacity-30"
                    >
                      <RotateCcw className="w-2.5 h-2.5" /> rerun
                    </button>
                  </div>
                )}

                {entry.showRaw && entry.data && (
                  <pre className="pl-4 font-mono text-[10px] text-muted-foreground/70 bg-muted/20 rounded p-2 overflow-x-auto">
                    {JSON.stringify(entry.data, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>

          {/* Input bar */}
          <div className="border-t border-border bg-card px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-primary text-sm flex-shrink-0">$</span>
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="!health-check  !session-status  !session-start ..."
                disabled={isRunning}
                className="flex-1 bg-transparent font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none disabled:opacity-50"
                spellCheck={false}
                autoCapitalize="none"
                autoCorrect="off"
              />
              <Button
                size="sm"
                onClick={() => executeCommand(input)}
                disabled={isRunning || !input.trim()}
                className="h-7 px-3 text-xs font-mono gap-1.5"
              >
                <Play className="w-3 h-3" />
                Run
              </Button>
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[9px] font-mono text-muted-foreground/50">Tab: autocomplete · ↑↓: history · Ctrl+L: clear</span>
              {(selectedGuild || selectedVoice) && (
                <span className="text-[9px] font-mono text-primary/60 ml-auto">
                  ctx: {selectedGuild ? guilds.find(g => g.id === selectedGuild)?.name || selectedGuild : ''}{selectedVoice ? ` / voice` : ''}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: history + suggestions */}
        <div className="w-64 border-l border-border flex flex-col bg-card flex-shrink-0">
          {/* Suggestions */}
          <div className="p-3 border-b border-border">
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Quick Commands</p>
            <div className="space-y-1">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="w-full text-left text-[10px] font-mono text-muted-foreground hover:text-foreground hover:bg-muted/40 px-2 py-1 rounded transition-colors truncate"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Command history */}
          <div className="flex-1 overflow-y-auto p-3 terminal-scroll">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">History</p>
              {cmdHistory.length > 0 && (
                <button
                  onClick={() => setCmdHistory([])}
                  className="text-[9px] font-mono text-muted-foreground/50 hover:text-muted-foreground"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
            <div className="space-y-1">
              {cmdHistory.length === 0 && (
                <p className="text-[10px] font-mono text-muted-foreground/40">No commands yet</p>
              )}
              {cmdHistory.map((cmd, i) => (
                <button
                  key={i}
                  onClick={() => setInput(cmd)}
                  className="w-full text-left flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground hover:text-foreground hover:bg-muted/40 px-1.5 py-1 rounded transition-colors"
                >
                  <Clock className="w-2.5 h-2.5 flex-shrink-0 text-muted-foreground/40" />
                  <span className="truncate">{cmd}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Context warning */}
          {!selectedGuild && (
            <div className="p-3 border-t border-border">
              <div className="flex items-start gap-1.5 text-[9px] font-mono text-muted-foreground/60">
                <AlertTriangle className="w-2.5 h-2.5 flex-shrink-0 mt-0.5" />
                <span>No server selected. Some commands need context.</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
