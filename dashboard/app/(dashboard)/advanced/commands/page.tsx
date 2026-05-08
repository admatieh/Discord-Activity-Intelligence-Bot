'use client'

import { useState } from 'react'
import { Topbar } from '@/components/dashboard/topbar'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Play, ChevronRight, Search, CheckCircle, XCircle } from 'lucide-react'

const botCommands: any[] = []

const CATEGORY_COLORS: Record<string, string> = {
  session: 'text-chart-1 bg-chart-1/10 border-chart-1/20',
  attendance: 'text-chart-2 bg-chart-2/10 border-chart-2/20',
  voice: 'text-chart-3 bg-chart-3/10 border-chart-3/20',
  interaction: 'text-chart-5 bg-chart-5/10 border-chart-5/20',
  participation: 'text-status-warning bg-status-warning/10 border-status-warning/20',
  system: 'text-muted-foreground bg-muted/50 border-border',
}

const ALL_CATEGORIES = ['session', 'attendance', 'voice', 'interaction', 'participation', 'system']

interface ExecResult {
  output: string
  exitCode: number
  executionMs: number
  logs: string[]
}

function CommandForm({ cmd, onClose }: { cmd: any; onClose: () => void }) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    const params = cmd.params || cmd.args || []
    for (const p of params) {
      initial[p.name] = p.default !== undefined ? String(p.default) : ''
    }
    return initial
  })
  const [result, setResult] = useState<ExecResult | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [showLogs, setShowLogs] = useState(false)

  function buildCommand() {
    let c = cmd.name
    const params = cmd.params || cmd.args || []
    for (const p of params) {
      const v = values[p.name]
      if (v !== '' && v !== undefined) {
        if (p.type === 'boolean') {
          if (v === 'true') c += ` --${p.name}`
        } else {
          c += ` --${p.name} ${v}`
        }
      }
    }
    return c
  }

  async function execute() {
    const command = buildCommand()
    setIsRunning(true)
    setResult(null)
    try {
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      })
      const data = await res.json()
      setResult(data)
    } catch {
      setResult({ output: 'Network error', exitCode: 1, executionMs: 0, logs: [] })
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold text-foreground">{cmd.name}</span>
            <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded border', CATEGORY_COLORS[cmd.category])}>
              {cmd.category}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{cmd.description}</p>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xs font-mono">
          ← back
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5 terminal-scroll">
        {/* Usage */}
        <div>
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1.5">Usage</p>
          <code className="text-xs font-mono bg-muted/40 border border-border px-3 py-1.5 rounded block">
            {cmd.usage}
          </code>
        </div>

        {/* Params form */}
        {(cmd.params || cmd.args || []).length > 0 ? (
          <div>
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-3">Parameters</p>
            <div className="space-y-3">
              {(cmd.params || cmd.args || []).map((param: any) => (
                <div key={param.name}>
                  <div className="flex items-center gap-2 mb-1">
                    <label className="text-xs font-mono text-foreground">--{param.name}</label>
                    <span className="text-[9px] font-mono text-muted-foreground/60">{param.type}</span>
                    {param.required && (
                      <span className="text-[9px] font-mono text-status-error">required</span>
                    )}
                    {!param.required && (
                      <span className="text-[9px] font-mono text-muted-foreground/50">optional</span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mb-1.5">{param.description}</p>
                  {param.type === 'boolean' ? (
                    <select
                      value={values[param.name]}
                      onChange={(e) => setValues((v) => ({ ...v, [param.name]: e.target.value }))}
                      className="bg-input border border-border rounded px-2 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring w-full"
                    >
                      <option value="false">false</option>
                      <option value="true">true</option>
                    </select>
                  ) : (
                    <input
                      type={param.type === 'number' ? 'number' : 'text'}
                      value={values[param.name]}
                      onChange={(e) => setValues((v) => ({ ...v, [param.name]: e.target.value }))}
                      placeholder={param.default !== undefined ? String(param.default) : `Enter ${param.type}...`}
                      className="bg-input border border-border rounded px-2 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring w-full"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs font-mono text-muted-foreground">No parameters required.</p>
        )}

        {/* Built command preview */}
        <div>
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1.5">Resolved Command</p>
          <code className="text-xs font-mono bg-primary/5 border border-primary/20 text-primary px-3 py-1.5 rounded block">
            {buildCommand()}
          </code>
        </div>

        {/* Execute button */}
        <Button onClick={execute} disabled={isRunning} className="w-full gap-2 font-mono text-xs">
          <Play className="w-3 h-3" />
          {isRunning ? 'Executing...' : 'Execute Command'}
        </Button>

        {/* Result */}
        {result && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              {result.exitCode === 0 ? (
                <CheckCircle className="w-3.5 h-3.5 text-status-online" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-status-error" />
              )}
              <span className={cn('text-xs font-mono', result.exitCode === 0 ? 'text-status-online' : 'text-status-error')}>
                exit {result.exitCode}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground ml-auto">{result.executionMs}ms</span>
            </div>
            <pre className={cn(
              'text-xs font-mono whitespace-pre-wrap bg-muted/20 border border-border rounded p-3 leading-relaxed',
              result.exitCode === 0 ? 'text-foreground' : 'text-status-error'
            )}>
              {result.output || '(no output)'}
            </pre>
            {result.logs.length > 0 && (
              <div>
                <button
                  onClick={() => setShowLogs((v) => !v)}
                  className="text-[10px] font-mono text-muted-foreground hover:text-foreground"
                >
                  {showLogs ? '▲' : '▼'} {result.logs.length} execution logs
                </button>
                {showLogs && (
                  <div className="mt-1 pl-2 border-l border-border space-y-0.5">
                    {result.logs.map((l, i) => (
                      <p key={i} className="text-[10px] font-mono text-muted-foreground">{l}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function CommandsPage() {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [selected, setSelected] = useState<any | null>(null)

  const filtered = botCommands.filter((cmd) => {
    const matchSearch = !search || cmd.name.includes(search) || cmd.description.toLowerCase().includes(search.toLowerCase())
    const matchCat = !activeCategory || cmd.category === activeCategory
    return matchSearch && matchCat
  })

  const grouped = ALL_CATEGORIES.reduce<Record<string, any[]>>((acc, cat) => {
    const cmds = filtered.filter((c) => c.category === cat)
    if (cmds.length > 0) acc[cat] = cmds
    return acc
  }, {})

  return (
    <div className="flex flex-col h-screen">
      <Topbar title="Command Explorer" subtitle={`${botCommands.length} commands available`} />

      <div className="flex flex-1 overflow-hidden">
        {/* Left: command list */}
        <div className="w-72 border-r border-border flex flex-col bg-card flex-shrink-0">
          {/* Search */}
          <div className="p-3 border-b border-border">
            <div className="flex items-center gap-2 bg-input border border-border rounded px-2.5 py-1.5">
              <Search className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search commands..."
                className="flex-1 bg-transparent text-xs font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
              />
            </div>
          </div>

          {/* Category filter */}
          <div className="px-3 py-2 border-b border-border flex flex-wrap gap-1">
            <button
              onClick={() => setActiveCategory(null)}
              className={cn(
                'text-[10px] font-mono px-2 py-0.5 rounded border transition-colors',
                !activeCategory ? 'text-foreground bg-muted border-border' : 'text-muted-foreground border-transparent hover:border-border'
              )}
            >
              all
            </button>
            {ALL_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                className={cn(
                  'text-[10px] font-mono px-2 py-0.5 rounded border transition-colors',
                  activeCategory === cat
                    ? cn(CATEGORY_COLORS[cat])
                    : 'text-muted-foreground border-transparent hover:border-border'
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Command list */}
          <div className="flex-1 overflow-y-auto terminal-scroll py-2">
            {Object.entries(grouped).map(([cat, cmds]) => (
              <div key={cat} className="mb-2">
                <div className="px-3 py-1.5">
                  <span className="text-[10px] font-mono font-semibold text-muted-foreground/60 uppercase tracking-widest">{cat}</span>
                </div>
                {cmds.map((cmd) => (
                  <button
                    key={cmd.name}
                    onClick={() => setSelected(cmd)}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 text-left transition-colors',
                      selected?.name === cmd.name
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-mono font-semibold truncate">{cmd.name}</p>
                      <p className="text-[10px] font-mono text-muted-foreground truncate mt-0.5">{cmd.description}</p>
                    </div>
                    <ChevronRight className="w-3 h-3 flex-shrink-0 ml-2" />
                  </button>
                ))}
              </div>
            ))}
            {Object.keys(grouped).length === 0 && (
              <p className="px-3 text-xs font-mono text-muted-foreground/50">No commands match your search.</p>
            )}
          </div>
        </div>

        {/* Right: form / detail */}
        <div className="flex-1 overflow-hidden">
          {selected ? (
            <CommandForm cmd={selected} onClose={() => setSelected(null)} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-2">
                <p className="font-mono text-sm text-muted-foreground">Select a command to execute</p>
                <p className="text-[10px] font-mono text-muted-foreground/50">{botCommands.length} commands across {ALL_CATEGORIES.length} categories</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
