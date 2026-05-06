'use client'

import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { Topbar } from '@/components/dashboard/topbar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Play, X, ChevronUp, ChevronDown, Clock, CheckCircle, XCircle, Trash2 } from 'lucide-react'

interface TerminalEntry {
  id: string
  command: string
  output: string
  exitCode: number
  executionMs: number
  logs: string[]
  timestamp: string
  status: 'running' | 'success' | 'error'
  showLogs?: boolean
}

const SUGGESTIONS = [
  '!session-start --channel general-voice --duration 60',
  '!session-end',
  '!session-status',
  '!health-check --verbose',
  '!score-summary',
  '!attendance-snapshot',
  '!logs --level warn',
  '!bot-status',
]

export default function TerminalPage() {
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<TerminalEntry[]>([])
  const [cmdHistory, setCmdHistory] = useState<string[]>([])
  const [cmdHistoryIndex, setCmdHistoryIndex] = useState(-1)
  const [isRunning, setIsRunning] = useState(false)
  const outputRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [history])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

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
      timestamp: new Date().toISOString(),
      status: 'running',
    }

    setHistory((prev) => [...prev, entry])
    setCmdHistory((prev) => [cmd.trim(), ...prev.slice(0, 49)])
    setCmdHistoryIndex(-1)
    setInput('')
    setIsRunning(true)

    try {
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd.trim() }),
      })
      const result = await res.json()
      setHistory((prev) =>
        prev.map((e) =>
          e.id === id
            ? {
                ...e,
                output: result.output,
                exitCode: result.exitCode,
                executionMs: result.executionMs,
                logs: result.logs,
                status: result.exitCode === 0 ? 'success' : 'error',
              }
            : e
        )
      )
    } catch {
      setHistory((prev) =>
        prev.map((e) =>
          e.id === id
            ? { ...e, output: 'Network error: failed to reach execution endpoint', exitCode: 1, status: 'error' }
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
      const match = SUGGESTIONS.find((s) => s.startsWith(input) && s !== input)
      if (match) setInput(match)
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault()
      setHistory([])
    }
  }

  function toggleLogs(id: string) {
    setHistory((prev) =>
      prev.map((e) => (e.id === id ? { ...e, showLogs: !e.showLogs } : e))
    )
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
                <p>Connected to: DevOps Guild | Bot v2.4.1</p>
                <p className="text-muted-foreground/60">Type a command and press Enter. Use ↑/↓ for history, Tab to autocomplete.</p>
                <p className="text-muted-foreground/60">Try: !health-check  !session-status  !score-summary</p>
                <div className="border-t border-border mt-2 pt-2" />
              </div>
            )}

            {/* Entries */}
            {history.map((entry) => (
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
                    {entry.output}
                  </pre>
                )}

                {/* Logs toggle */}
                {entry.logs.length > 0 && entry.status !== 'running' && (
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

                {/* Status icon */}
                {entry.status !== 'running' && (
                  <div className="pl-4">
                    {entry.status === 'success' ? (
                      <CheckCircle className="w-3 h-3 text-status-online" />
                    ) : (
                      <XCircle className="w-3 h-3 text-status-error" />
                    )}
                  </div>
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
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="!session-start --channel general-voice"
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
            </div>
          </div>
        </div>

        {/* Right: history + suggestions */}
        <div className="w-64 border-l border-border flex flex-col bg-card flex-shrink-0">
          {/* Suggestions */}
          <div className="p-3 border-b border-border">
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Quick Commands</p>
            <div className="space-y-1">
              {SUGGESTIONS.map((s) => (
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
        </div>
      </div>
    </div>
  )
}
