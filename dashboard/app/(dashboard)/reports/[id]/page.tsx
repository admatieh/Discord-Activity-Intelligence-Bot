import { notFound } from 'next/navigation'
const mockSessions: any[] = []
const mockParticipants: any[] = []
const generateLogs = (n: number) => [] as any[]

import { Topbar } from '@/components/dashboard/topbar'
import { LogLine } from '@/components/dashboard/log-line'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { Users, MessageSquare, Mic, Zap, ArrowLeft, CheckCircle, Circle, BarChart2 } from 'lucide-react'
import { SessionCharts } from '@/components/dashboard/session-charts'

function formatDuration(startedAt: string, endedAt?: string): string {
  const end = endedAt ? new Date(endedAt) : new Date()
  const start = new Date(startedAt)
  const diffMs = end.getTime() - start.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 60) return `${diffMin} min`
  const h = Math.floor(diffMin / 60)
  const m = diffMin % 60
  return `${h}h ${m}m`
}

function ScoreBar({ score, max = 100 }: { score: number; max?: number }) {
  const pct = (score / max) * 100
  const color = pct >= 80 ? 'bg-status-online' : pct >= 60 ? 'bg-status-warning' : 'bg-status-error'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium text-muted-foreground w-8 text-right">{score.toFixed(1)}</span>
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
        title={`Report: #${session.channelName}`}
        subtitle={`ID: ${session.id}`}
        actions={
          <Link href="/reports" className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors bg-secondary/50 hover:bg-secondary px-3 py-1.5 rounded-lg">
            <ArrowLeft className="w-4 h-4" />
            Back to Reports
          </Link>
        }
      />

      <div className="p-6 max-w-6xl mx-auto w-full space-y-8">
        
        {/* Header Summary */}
        <div className="bg-card border border-border rounded-xl shadow-sm p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold">#{session.channelName}</h1>
                <span className={cn(
                  "px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider",
                  isActive ? "bg-status-online/10 text-status-online border border-status-online/20" : "bg-secondary text-muted-foreground border border-border"
                )}>
                  {isActive ? 'LIVE NOW' : 'COMPLETED'}
                </span>
              </div>
              <p className="text-muted-foreground text-sm">
                Recorded in <strong>{session.guildName}</strong> • {new Date(session.startedAt).toLocaleDateString()}
              </p>
            </div>
            
            <div className="flex gap-8">
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Duration</p>
                <p className="text-lg font-medium">{formatDuration(session.startedAt, session.endedAt)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Attendees</p>
                <p className="text-lg font-medium">{session.participantCount}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Highlights */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Participants', value: session.participantCount, icon: Users, color: 'text-chart-1', bg: 'bg-chart-1/10' },
            { label: 'Messages', value: session.totalMessages, icon: MessageSquare, color: 'text-chart-2', bg: 'bg-chart-2/10' },
            { label: 'Voice Time', value: `${session.totalVoiceMinutes} min`, icon: Mic, color: 'text-chart-3', bg: 'bg-chart-3/10' },
            { label: 'Avg Score', value: session.avgScore.toFixed(1), icon: BarChart2, color: 'text-status-warning', bg: 'bg-status-warning/10' },
          ].map((item) => {
            const Icon = item.icon
            return (
              <div key={item.label} className="bg-card border border-border rounded-xl p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", item.bg)}>
                    <Icon className={cn('w-4 h-4', item.color)} />
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">{item.label}</span>
                </div>
                <span className="text-2xl font-bold">{item.value}</span>
              </div>
            )
          })}
        </div>

        <SessionCharts voiceTimeline={voiceTimeline} interactionTimeline={interactionTimeline} />

        {/* Participants Table */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Participant Breakdown</h2>
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-secondary/50 text-muted-foreground font-medium border-b border-border">
                  <tr>
                    <th className="px-5 py-4 font-medium w-16">#</th>
                    <th className="px-5 py-4 font-medium">Student</th>
                    <th className="px-5 py-4 font-medium">Status</th>
                    <th className="px-5 py-4 font-medium">Voice Min</th>
                    <th className="px-5 py-4 font-medium">Messages</th>
                    <th className="px-5 py-4 font-medium">Score</th>
                    <th className="px-5 py-4 font-medium">Attendance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sortedParticipants.map((p, i) => (
                    <tr key={p.userId} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-4 text-muted-foreground font-medium">{i + 1}</td>
                      <td className="px-5 py-4">
                        <Link href={`/participants?user=${p.userId}`} className="hover:underline">
                          <p className="font-semibold text-foreground">{p.displayName}</p>
                          <p className="text-xs text-muted-foreground">@{p.username}</p>
                        </Link>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          {p.isActive ? (
                            <span className="flex items-center gap-1 text-xs font-medium text-status-online bg-status-online/10 px-2 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-status-online"></span>
                              Present
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                              Left
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 font-medium">
                        {p.voiceMinutes}
                      </td>
                      <td className="px-5 py-4 font-medium">
                        {p.messageCount}
                      </td>
                      <td className="px-5 py-4 min-w-[150px]">
                        <ScoreBar score={p.participationScore} />
                      </td>
                      <td className="px-5 py-4">
                        <span className={cn(
                          'font-semibold',
                          p.attendanceRate >= 0.8 ? 'text-status-online' :
                          p.attendanceRate >= 0.6 ? 'text-status-warning' : 'text-status-error'
                        )}>
                          {(p.attendanceRate * 100).toFixed(0)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                  {sortedParticipants.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-8 text-center text-muted-foreground">
                        No participants recorded for this session.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Logs */}
        {logs.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Event Logs</h2>
            <div className="bg-card border border-border rounded-xl shadow-sm p-4">
              <div className="space-y-1">
                {logs.map((log: any) => (
                  <LogLine key={log.id} {...log} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
