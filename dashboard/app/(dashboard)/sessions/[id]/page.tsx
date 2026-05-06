import { notFound } from 'next/navigation'
const mockSessions: any[] = []
const mockParticipants: any[] = []
const generateLogs = (n: number) => [] as any[]

import { Topbar } from '@/components/dashboard/topbar'
import { LogLine } from '@/components/dashboard/log-line'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { Users, MessageSquare, Mic, Zap, ArrowLeft, CheckCircle, Circle } from 'lucide-react'
import { SessionCharts } from '@/components/dashboard/session-charts'

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

function ScoreBar({ score, max = 100 }: { score: number; max?: number }) {
  const pct = (score / max) * 100
  const color = pct >= 80 ? 'bg-status-online' : pct >= 60 ? 'bg-status-warning' : 'bg-status-error'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-mono text-muted-foreground w-8 text-right">{score.toFixed(1)}</span>
    </div>
  )
}

function generateVoiceTimeline(count = 20) {
  return Array.from({ length: count }, (_, i) => ({
    t: `${i * 2}m`,
    active: Math.floor(Math.random() * 8) + 2,
    muted: Math.floor(Math.random() * 3),
  }))
}

function generateInteractionTimeline(count = 20) {
  return Array.from({ length: count }, (_, i) => ({
    t: `${i * 2}m`,
    messages: Math.floor(Math.random() * 12),
    reactions: Math.floor(Math.random() * 5),
    commands: Math.floor(Math.random() * 3),
  }))
}

export default function SessionDetailPage({ params }: { params: { id: string } }) {
  const session = mockSessions.find((s) => s.id === params.id)
  if (!session) notFound()

  const logs = generateLogs(20)
  const voiceTimeline = generateVoiceTimeline()
  const interactionTimeline = generateInteractionTimeline()
  const isActive = session.status === 'active'

  const sortedParticipants = [...mockParticipants].sort((a, b) => b.participationScore - a.participationScore)

  return (
    <div className="flex flex-col min-h-screen">
      <Topbar
        title={`Session — #${session.channelName}`}
        subtitle={session.id}
        badge={isActive ? 'LIVE' : 'ENDED'}
        badgeVariant={isActive ? 'default' : 'secondary'}
        actions={
          <Link href="/sessions" className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-3 h-3" />
            Sessions
          </Link>
        }
      />

      <div className="p-5 space-y-5">
        <div className="bg-card border border-border rounded p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-6 gap-x-8 gap-y-3">
              {[
                { label: 'Session ID', value: session.id },
                { label: 'Channel', value: `#${session.channelName}` },
                { label: 'Guild', value: session.guildName },
                { label: 'Status', value: isActive ? 'ACTIVE' : 'ENDED' },
                { label: 'Duration', value: formatDuration(session.startedAt, session.endedAt) },
                { label: 'Participants', value: session.participantCount },
              ].map((item) => (
                <div key={item.label}>
                  <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">{item.label}</p>
                  <p className={cn('text-xs font-mono font-semibold mt-0.5',
                    item.label === 'Status' && (isActive ? 'text-status-online' : 'text-muted-foreground')
                  )}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Participants', value: session.participantCount, icon: Users, color: 'text-chart-1' },
            { label: 'Total Messages', value: session.totalMessages, icon: MessageSquare, color: 'text-chart-2' },
            { label: 'Voice Minutes', value: session.totalVoiceMinutes, icon: Mic, color: 'text-chart-3' },
            { label: 'Avg Score', value: session.avgScore.toFixed(1), icon: Zap, color: 'text-status-warning' },
          ].map((item) => {
            const Icon = item.icon
            return (
              <div key={item.label} className="bg-card border border-border rounded p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{item.label}</span>
                  <Icon className={cn('w-3.5 h-3.5', item.color)} />
                </div>
                <span className="text-2xl font-semibold font-mono">{item.value}</span>
              </div>
            )
          })}
        </div>

        <SessionCharts voiceTimeline={voiceTimeline} interactionTimeline={interactionTimeline} />

        <div>
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Participant Breakdown</p>
          <div className="bg-card border border-border rounded overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {['Rank', 'User', 'Status', 'Voice Min', 'Messages', 'Reactions', 'Commands', 'Score', 'Attendance'].map((h) => (
                    <th key={h} className="text-left px-3 py-2.5 text-[10px] font-mono text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedParticipants.map((p, i) => (
                  <tr key={p.userId} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2.5">
                      <span className="text-[10px] font-mono text-muted-foreground">#{i + 1}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <Link href={`/users?user=${p.userId}`} className="hover:underline">
                        <p className="text-xs font-mono font-semibold">{p.displayName}</p>
                        <p className="text-[9px] font-mono text-muted-foreground">{p.username}</p>
                      </Link>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        {p.isActive ? (
                          <CheckCircle className="w-3 h-3 text-status-online" />
                        ) : (
                          <Circle className="w-3 h-3 text-muted-foreground" />
                        )}
                        <span className={cn('text-[10px] font-mono', p.isActive ? 'text-status-online' : 'text-muted-foreground')}>
                          {p.isActive ? 'present' : 'left'}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <Mic className="w-2.5 h-2.5 text-muted-foreground" />
                        <span className="text-xs font-mono">{p.voiceMinutes}m</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs font-mono">{p.messageCount}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs font-mono">{p.reactionCount}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs font-mono">{p.commandCount}</span>
                    </td>
                    <td className="px-3 py-2.5 min-w-36">
                      <ScoreBar score={p.participationScore} />
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={cn(
                        'text-[10px] font-mono',
                        p.attendanceRate >= 0.8 ? 'text-status-online' :
                        p.attendanceRate >= 0.6 ? 'text-status-warning' : 'text-status-error'
                      )}>
                        {(p.attendanceRate * 100).toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Session Logs</p>
          <div className="bg-card border border-border rounded p-3">
            <div className="space-y-0.5">
              {logs.map((log: any) => (
                <LogLine key={log.id} {...log} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
