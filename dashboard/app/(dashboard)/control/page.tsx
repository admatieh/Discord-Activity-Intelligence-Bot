'use client'

import { useState } from 'react'
import { Topbar } from '@/components/dashboard/topbar'
import { LogLine } from '@/components/dashboard/log-line'
import { cn } from '@/lib/utils'
import {
  Play, Square, RefreshCw, Heart, FileText, Mic,
  ChevronRight, CheckCircle, XCircle, Loader2,
  AlertTriangle, Zap, Database, Network, Cpu, Radio,
} from 'lucide-react'
import type { LogLevel } from '@/lib/types'

interface ActionResult {
  output: string
  exitCode: number
  executionMs: number
  logs: string[]
}

interface ControlAction {
  id: string
  label: string
  description: string
  command: string
  icon: React.ElementType
  variant: 'primary' | 'danger' | 'warning' | 'default'
  group: string
  confirm?: boolean
  confirmText?: string
}

const controlActions: ControlAction[] = [
  {
    id: 'session-start',
    label: 'Start Session',
    description: 'Begin tracking in #general-voice',
    command: '!session-start --channel general-voice --duration 60',
    icon: Play,
    variant: 'primary',
    group: 'Session Management',
    confirm: false,
  },
  {
    id: 'session-end',
    label: 'End Session',
    description: 'End active session & generate report',
    command: '!session-end --generate-report true',
    icon: Square,
    variant: 'danger',
    group: 'Session Management',
    confirm: true,
    confirmText: 'End active session?',
  },
  {
    id: 'session-switch',
    label: 'Switch Channel',
    description: 'Move tracking to #standup',
    command: '!session-switch --channel standup',
    icon: RefreshCw,
    variant: 'warning',
    group: 'Session Management',
  },
  {
    id: 'attendance-snapshot',
    label: 'Attendance Snapshot',
    description: 'Take manual attendance snapshot now',
    command: '!attendance-snapshot',
    icon: Mic,
    variant: 'default',
    group: 'Session Management',
  },
  {
    id: 'health-check',
    label: 'Health Check',
    description: 'Run full system diagnostics',
    command: '!health-check --verbose true',
    icon: Heart,
    variant: 'default',
    group: 'System',
  },
  {
    id: 'bot-status',
    label: 'Bot Status',
    description: 'Fetch current bot runtime metrics',
    command: '!bot-status',
    icon: Cpu,
    variant: 'default',
    group: 'System',
  },
  {
    id: 'view-logs',
    label: 'View Recent Logs',
    description: 'Fetch last 50 system log entries',
    command: '!logs --level info --limit 50',
    icon: FileText,
    variant: 'default',
    group: 'System',
  },
  {
    id: 'score-summary',
    label: 'Score Summary',
    description: 'Dump participation scores for active session',
    command: '!score-summary',
    icon: Zap,
    variant: 'default',
    group: 'Participation',
  },
  {
    id: 'score-recalc',
    label: 'Recalculate Scores',
    description: 'Force score recalculation for sess_01HZ4K',
    command: '!score-recalculate --session-id sess_01HZ4K',
    icon: RefreshCw,
    variant: 'warning',
    group: 'Participation',
  },
]

const variantStyles = {
  primary: 'border-primary/30 bg-primary/5 hover:bg-primary/10 text-foreground',
  danger: 'border-status-error/30 bg-status-error/5 hover:bg-status-error/10 text-foreground',
  warning: 'border-status-warning/30 bg-status-warning/5 hover:bg-status-warning/10 text-foreground',
  default: 'border-border bg-card hover:bg-muted/30 text-foreground',
}

const variantIconStyles = {
  primary: 'text-primary',
  danger: 'text-status-error',
  warning: 'text-status-warning',
  default: 'text-muted-foreground',
}

interface ExecEntry {
  id: string
  actionId: string
  label: string
  command: string
  result: ActionResult | null
  status: 'running' | 'success' | 'error'
  timestamp: string
}

const SERVICE_STATUSES = [
  { name: 'Gateway WS', status: 'online' as const, metric: '42ms', icon: Network },
  { name: 'PostgreSQL', status: 'online' as const, metric: '8ms', icon: Database },
  { name: 'Event Bus', status: 'online' as const, metric: 'q=0', icon: Zap },
  { name: 'Score Engine', status: 'online' as const, metric: 'idle', icon: Cpu },
  { name: 'Session Mgr', status: 'online' as const, metric: '1 active', icon: Radio },
  { name: 'Attendance', status: 'online' as const, metric: 'tracking', icon: Mic },
  { name: 'Voice Monitor', status: 'online' as const, metric: 'live', icon: Mic },
  { name: 'Command Handler', status: 'online' as const, metric: 'ready', icon: ChevronRight },
]

export default function ControlPage() {
  const [execLog, setExecLog] = useState<ExecEntry[]>([])
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set())
  const [pendingConfirm, setPendingConfirm] = useState<string | null>(null)

  async function executeAction(action: ControlAction) {
    if (action.confirm && pendingConfirm !== action.id) {
      setPendingConfirm(action.id)
      return
    }
    setPendingConfirm(null)

    const entryId = `exec_${Date.now()}`
    const entry: ExecEntry = {
      id: entryId,
      actionId: action.id,
      label: action.label,
      command: action.command,
      result: null,
      status: 'running',
      timestamp: new Date().toISOString(),
    }

    setExecLog((prev) => [entry, ...prev])
    setRunningIds((prev) => new Set(prev).add(action.id))

    try {
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: action.command }),
      })
      const json = await res.json()
      
      const result: ActionResult = json.success && json.data ? json.data : {
        output: json.error || 'Execution failed',
        exitCode: 1,
        executionMs: 0,
        logs: []
      }

      setExecLog((prev) =>
        prev.map((e) =>
          e.id === entryId
            ? { ...e, result, status: result.exitCode === 0 ? 'success' : 'error' }
            : e
        )
      )
    } catch (err: any) {
      setExecLog((prev) =>
        prev.map((e) =>
          e.id === entryId
            ? { ...e, result: { output: err.message || 'Network error', exitCode: 1, executionMs: 0, logs: [] }, status: 'error' }
            : e
        )
      )
    } finally {
      setRunningIds((prev) => {
        const next = new Set(prev)
        next.delete(action.id)
        return next
      })
    }
  }

  const groups = Array.from(new Set(controlActions.map((a) => a.group)))

  // Convert exec log entries to log lines
  const activityLogs = execLog.flatMap((entry): { timestamp: string; level: LogLevel; source: string; message: string; id: string }[] => {
    const base = {
      id: entry.id + '_start',
      timestamp: entry.timestamp,
      level: 'info' as LogLevel,
      source: 'control-panel',
      message: `Dispatched: ${entry.command}`,
    }
    if (!entry.result) return [base]
    const result = {
      id: entry.id + '_end',
      timestamp: new Date(new Date(entry.timestamp).getTime() + entry.result.executionMs).toISOString(),
      level: (entry.status === 'success' ? 'success' : 'error') as LogLevel,
      source: 'control-panel',
      message: entry.status === 'success'
        ? `${entry.label} completed in ${entry.result.executionMs}ms`
        : `${entry.label} failed: exit ${entry.result.exitCode}`,
    }
    return [base, result]
  })

  return (
    <div className="flex flex-col min-h-screen">
      <Topbar title="System Control Panel" subtitle="execute system actions" />

      <div className="p-5 space-y-5">
        {/* Service health grid */}
        <div>
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Service Health</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2">
            {SERVICE_STATUSES.map((svc) => {
              const Icon = svc.icon
              return (
                <div key={svc.name} className="bg-card border border-border rounded p-2.5 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <Icon className="w-3 h-3 text-muted-foreground" />
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-online opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-status-online" />
                    </span>
                  </div>
                  <p className="text-[10px] font-mono font-semibold text-foreground leading-tight">{svc.name}</p>
                  <p className="text-[9px] font-mono text-muted-foreground">{svc.metric}</p>
                </div>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          {/* Control actions */}
          <div className="xl:col-span-2 space-y-4">
            {groups.map((group) => (
              <div key={group}>
                <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">{group}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {controlActions.filter((a) => a.group === group).map((action) => {
                    const Icon = action.icon
                    const isRunning = runningIds.has(action.id)
                    const isPendingConfirm = pendingConfirm === action.id

                    return (
                      <div key={action.id} className={cn('border rounded p-3.5 transition-all', variantStyles[action.variant])}>
                        <div className="flex items-start gap-3">
                          <div className={cn('flex-shrink-0 mt-0.5', variantIconStyles[action.variant])}>
                            {isRunning ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Icon className="w-4 h-4" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold font-mono">{action.label}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{action.description}</p>
                            <code className="text-[9px] font-mono text-muted-foreground/60 block mt-1 truncate">{action.command}</code>
                          </div>
                          <div className="flex flex-col gap-1 flex-shrink-0">
                            {isPendingConfirm ? (
                              <div className="flex gap-1">
                                <button
                                  onClick={() => executeAction(action)}
                                  className="text-[10px] font-mono bg-status-error/20 text-status-error border border-status-error/30 px-2 py-1 rounded hover:bg-status-error/30 transition-colors"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setPendingConfirm(null)}
                                  className="text-[10px] font-mono text-muted-foreground border border-border px-2 py-1 rounded hover:bg-muted transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => executeAction(action)}
                                disabled={isRunning}
                                className={cn(
                                  'flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded border transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                                  action.variant === 'primary' && 'bg-primary/10 border-primary/30 text-primary hover:bg-primary/20',
                                  action.variant === 'danger' && 'bg-status-error/10 border-status-error/30 text-status-error hover:bg-status-error/20',
                                  action.variant === 'warning' && 'bg-status-warning/10 border-status-warning/30 text-status-warning hover:bg-status-warning/20',
                                  action.variant === 'default' && 'bg-muted/30 border-border text-foreground hover:bg-muted/60',
                                )}
                              >
                                <ChevronRight className="w-2.5 h-2.5" />
                                Run
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Execution log */}
          <div className="bg-card border border-border rounded flex flex-col">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Execution Log</p>
              <span className="text-[10px] font-mono text-muted-foreground">{execLog.length} actions</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 terminal-scroll min-h-64">
              {execLog.length === 0 && (
                <p className="text-[10px] font-mono text-muted-foreground/40 p-1">No actions executed yet.</p>
              )}
              {execLog.map((entry) => (
                <div key={entry.id} className="mb-3 last:mb-0">
                  <div className="flex items-center gap-2 mb-1">
                    {entry.status === 'running' && <Loader2 className="w-2.5 h-2.5 text-status-warning animate-spin" />}
                    {entry.status === 'success' && <CheckCircle className="w-2.5 h-2.5 text-status-online" />}
                    {entry.status === 'error' && <XCircle className="w-2.5 h-2.5 text-status-error" />}
                    <span className="text-[10px] font-mono font-semibold text-foreground">{entry.label}</span>
                    {entry.result && (
                      <span className="text-[9px] font-mono text-muted-foreground ml-auto">{entry.result.executionMs}ms</span>
                    )}
                  </div>
                  {entry.result && (
                    <pre className={cn(
                      'text-[9px] font-mono whitespace-pre-wrap leading-relaxed pl-4 border-l border-border',
                      entry.status === 'success' ? 'text-foreground/80' : 'text-status-error'
                    )}>
                      {entry.result.output.split('\n').slice(0, 4).join('\n')}
                      {entry.result.output.split('\n').length > 4 && '\n  ...'}
                    </pre>
                  )}
                </div>
              ))}
            </div>

            {/* Activity log feed */}
            {activityLogs.length > 0 && (
              <div className="border-t border-border p-3">
                <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Activity</p>
                <div className="space-y-0.5">
                  {activityLogs.slice(0, 8).map((log) => (
                    <LogLine key={log.id} {...log} compact />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Alert banner */}
        <div className="flex items-start gap-3 bg-status-warning/5 border border-status-warning/20 rounded px-4 py-3">
          <AlertTriangle className="w-3.5 h-3.5 text-status-warning flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-mono text-status-warning font-semibold">Control plane actions are executed immediately</p>
            <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
              Actions marked as destructive will prompt for confirmation. All executions are logged in the audit trail.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
