import { cn } from '@/lib/utils'
import type { LogLevel } from '@/lib/types'

interface LogLineProps {
  timestamp: string
  level: LogLevel
  source: string
  message: string
  compact?: boolean
}

const levelConfig: Record<LogLevel, { label: string; className: string }> = {
  info: { label: 'INFO ', className: 'text-chart-1' },
  debug: { label: 'DEBUG', className: 'text-muted-foreground' },
  warn: { label: 'WARN ', className: 'text-status-warning' },
  error: { label: 'ERROR', className: 'text-status-error' },
  success: { label: 'OK   ', className: 'text-status-online' },
  trace: { label: 'TRACE', className: 'text-muted-foreground/70' },
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0')
}

export function LogLine({ timestamp, level, source, message, compact }: LogLineProps) {
  const cfg = levelConfig[level]
  return (
    <div
      className={cn(
        'flex items-start gap-2 font-mono text-xs hover:bg-muted/20 px-2 rounded',
        compact ? 'py-0.5' : 'py-1'
      )}
    >
      <span className="text-muted-foreground/60 flex-shrink-0 tabular-nums">{formatTime(timestamp)}</span>
      <span className={cn('flex-shrink-0 font-semibold w-11', cfg.className)}>{cfg.label}</span>
      <span className="text-muted-foreground flex-shrink-0 w-32 truncate">{source}</span>
      <span className="text-foreground/90 min-w-0">{message}</span>
    </div>
  )
}
