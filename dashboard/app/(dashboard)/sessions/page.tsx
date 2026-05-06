import { Topbar } from '@/components/dashboard/topbar'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { Radio, Users, MessageSquare, Mic, Zap, Clock, ChevronRight, Circle } from 'lucide-react'

function formatDuration(startedAt: string, endedAt?: string): string {
  const end = endedAt ? new Date(endedAt) : new Date()
  const start = new Date(startedAt)
  const diffMs = end.getTime() - start.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 60) return `${diffMin}m`
  const h = Math.floor(diffMin / 60)
  const m = diffMin % 60
  return `${h}h ${m}m`
}

function formatAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const statusConfig: Record<string, { label: string; dot: string; text: string; badge: string }> = {
  active: { label: 'ACTIVE', dot: 'bg-status-online', text: 'text-status-online', badge: 'bg-status-online/10 border-status-online/20 text-status-online' },
  ended: { label: 'ENDED', dot: 'bg-muted-foreground', text: 'text-muted-foreground', badge: 'bg-muted/30 border-border text-muted-foreground' },
  paused: { label: 'PAUSED', dot: 'bg-status-warning', text: 'text-status-warning', badge: 'bg-status-warning/10 border-status-warning/20 text-status-warning' },
  idle: { label: 'IDLE', dot: 'bg-status-warning', text: 'text-status-warning', badge: 'bg-status-warning/10 border-status-warning/20 text-status-warning' },
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-status-online' : score >= 60 ? 'bg-status-warning' : 'bg-status-error'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${score}%` }} />
      </div>
      <span className="text-[10px] font-mono text-muted-foreground w-8 text-right">{score.toFixed(1)}</span>
    </div>
  )
}

export default function SessionsPage() {
  const active: any[] = []
  const historical: any[] = []
  const mockSessions: any[] = []

  return (
    <div className="flex flex-col min-h-screen">
      <Topbar
        title="Live Sessions"
        subtitle="monitor & history"
        badge={`${active.length} ACTIVE`}
        badgeVariant="default"
      />

      <div className="p-5 space-y-5">
        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Active Sessions', value: active.length, icon: Radio, color: 'text-status-online' },
            { label: 'Total Sessions', value: mockSessions.length, icon: Circle, color: 'text-chart-1' },
            { label: 'Total Participants', value: mockSessions.reduce((s, x) => s + x.participantCount, 0), icon: Users, color: 'text-chart-2' },
            { label: 'Total Voice Min', value: mockSessions.reduce((s, x) => s + x.totalVoiceMinutes, 0), icon: Mic, color: 'text-chart-3' },
          ].map((item) => {
            const Icon = item.icon
            return (
              <div key={item.label} className="bg-card border border-border rounded p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{item.label}</span>
                  <Icon className={cn('w-3.5 h-3.5', item.color)} />
                </div>
                <span className="text-2xl font-semibold">{item.value}</span>
              </div>
            )
          })}
        </div>

        {/* Active sessions */}
        {active.length > 0 && (
          <div>
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Active Sessions</p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {active.map((session) => {
                const cfg = statusConfig[session.status]
                return (
                  <Link
                    key={session.id}
                    href={`/sessions/${session.id}`}
                    className="bg-card border border-status-online/20 rounded p-4 hover:border-status-online/40 transition-colors group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-online opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-status-online" />
                          </span>
                          <span className="font-mono text-sm font-semibold">#{session.channelName}</span>
                        </div>
                        <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{session.id} · {session.guildName}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded border', cfg.badge)}>
                          {cfg.label}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      {[
                        { label: 'Participants', value: session.participantCount, icon: Users },
                        { label: 'Messages', value: session.totalMessages, icon: MessageSquare },
                        { label: 'Voice Min', value: session.totalVoiceMinutes, icon: Mic },
                        { label: 'Duration', value: formatDuration(session.startedAt), icon: Clock },
                      ].map((item) => {
                        const Icon = item.icon
                        return (
                          <div key={item.label}>
                            <p className="text-[9px] font-mono text-muted-foreground uppercase">{item.label}</p>
                            <div className="flex items-center gap-1 mt-0.5">
                              <Icon className="w-2.5 h-2.5 text-muted-foreground" />
                              <span className="text-sm font-mono font-semibold">{item.value}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div className="mt-3 pt-3 border-t border-border">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] font-mono text-muted-foreground">AVG SCORE</span>
                        <span className="text-[9px] font-mono text-status-warning">{session.avgScore.toFixed(1)}</span>
                      </div>
                      <ScoreBar score={session.avgScore} />
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* Historical sessions */}
        <div>
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Session History</p>
          <div className="bg-card border border-border rounded overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {['Session ID', 'Channel', 'Status', 'Participants', 'Messages', 'Voice Min', 'Avg Score', 'Started', 'Duration', ''].map((h) => (
                    <th key={h} className="text-left px-3 py-2.5 text-[10px] font-mono text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historical.map((session, i) => {
                  const cfg = statusConfig[session.status]
                  return (
                    <tr
                      key={session.id}
                      className={cn(
                        'border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors',
                        i % 2 === 0 ? '' : 'bg-muted/5'
                      )}
                    >
                      <td className="px-3 py-2.5">
                        <span className="text-[10px] font-mono text-muted-foreground">{session.id}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-xs font-mono">#{session.channelName}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded border', cfg.badge)}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          <Users className="w-2.5 h-2.5 text-muted-foreground" />
                          <span className="text-xs font-mono">{session.participantCount}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-xs font-mono">{session.totalMessages}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          <Mic className="w-2.5 h-2.5 text-muted-foreground" />
                          <span className="text-xs font-mono">{session.totalVoiceMinutes}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="w-24">
                          <ScoreBar score={session.avgScore} />
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-[10px] font-mono text-muted-foreground">{formatAgo(session.startedAt)}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-[10px] font-mono text-muted-foreground">{formatDuration(session.startedAt, session.endedAt)}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <Link
                          href={`/sessions/${session.id}`}
                          className="text-[10px] font-mono text-primary hover:underline whitespace-nowrap"
                        >
                          Detail →
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
