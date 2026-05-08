import { Topbar } from '@/components/dashboard/topbar'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { Radio, Users, MessageSquare, Mic, Clock, ChevronRight, BarChart, Calendar, PlayCircle } from 'lucide-react'
import { getSessions } from '@/server/repositories'

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
  active: { label: 'Live Now', dot: 'bg-status-online', text: 'text-status-online', badge: 'bg-status-online/10 border-status-online/20 text-status-online' },
  ended: { label: 'Completed', dot: 'bg-muted-foreground', text: 'text-muted-foreground', badge: 'bg-muted/50 border-border text-muted-foreground' },
  paused: { label: 'Paused', dot: 'bg-status-warning', text: 'text-status-warning', badge: 'bg-status-warning/10 border-status-warning/20 text-status-warning' },
  idle: { label: 'Idle', dot: 'bg-status-warning', text: 'text-status-warning', badge: 'bg-status-warning/10 border-status-warning/20 text-status-warning' },
}

export default function ReportsPage() {
  const { data: allSessions, total } = getSessions(undefined, 100, 0)
  const active = allSessions.filter(s => s.status === 'active')
  const historical = allSessions.filter(s => s.status !== 'active')

  return (
    <div className="flex flex-col min-h-screen">
      <Topbar
        title="Reports"
        subtitle="Review past sessions and insights"
      />

      <div className="p-6 max-w-6xl mx-auto w-full space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold mb-2">Session Reports</h1>
            <p className="text-muted-foreground text-sm">Review engagement, attendance, and activity for your past sessions.</p>
          </div>
          <Link href="/record" className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm">
            <PlayCircle className="w-4 h-4" />
            Record Session
          </Link>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Live Sessions', value: active.length, icon: Radio, color: 'text-status-online', bg: 'bg-status-online/10' },
            { label: 'Total Recorded', value: total, icon: BarChart, color: 'text-chart-1', bg: 'bg-chart-1/10' },
            { label: 'Total Attendees', value: allSessions.reduce((s, x) => s + (x.participantCount || 0), 0), icon: Users, color: 'text-chart-2', bg: 'bg-chart-2/10' },
            { label: 'Voice Time', value: `${allSessions.reduce((s, x) => s + (x.totalVoiceMinutes || 0), 0)} min`, icon: Mic, color: 'text-chart-3', bg: 'bg-chart-3/10' },
          ].map(item => {
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

        {total === 0 && (
          <div className="bg-card border border-border border-dashed rounded-xl p-12 text-center flex flex-col items-center shadow-sm">
            <Radio className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="text-lg font-medium mb-2">No Reports Available</p>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm">
              You haven't recorded any sessions yet. Once you complete a session, its report will appear here.
            </p>
            <Link href="/record" className="text-primary text-sm font-medium hover:underline">
              Start your first recording
            </Link>
          </div>
        )}

        {/* Active sessions */}
        {active.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Currently Recording</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {active.map(session => (
                <Link
                  key={session.id}
                  href={`/reports/${session.id}`}
                  className="bg-card border border-status-online/30 rounded-xl p-5 shadow-sm relative overflow-hidden group hover:border-status-online/50 transition-colors"
                >
                  <div className="absolute top-0 left-0 w-1 h-full bg-status-online"></div>
                  
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-online opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-status-online" />
                        </span>
                        <span className="text-xs font-semibold text-status-online uppercase tracking-wider">Live</span>
                      </div>
                      <h3 className="font-medium text-lg mt-1">#{session.channelName || session.channelId}</h3>
                      <p className="text-sm text-muted-foreground mt-0.5">Started {formatAgo(session.startedAt)}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-secondary/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5"><Users className="w-3.5 h-3.5"/> Participants</p>
                      <p className="text-base font-semibold">{session.participantCount}</p>
                    </div>
                    <div className="bg-secondary/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5"/> Duration</p>
                      <p className="text-base font-semibold">{formatDuration(session.startedAt)}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Historical sessions */}
        {historical.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Past Sessions</h2>
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-secondary/50 text-muted-foreground font-medium border-b border-border">
                    <tr>
                      <th className="px-5 py-4 font-medium">Session / Channel</th>
                      <th className="px-5 py-4 font-medium">Date</th>
                      <th className="px-5 py-4 font-medium">Status</th>
                      <th className="px-5 py-4 font-medium">Attendees</th>
                      <th className="px-5 py-4 font-medium">Duration</th>
                      <th className="px-5 py-4 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {historical.map((session) => {
                      const cfg = statusConfig[session.status] || statusConfig.ended
                      return (
                        <tr key={session.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-5 py-4">
                            <div className="font-medium text-foreground">#{session.channelName || session.channelId}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">ID: {session.id}</div>
                          </td>
                          <td className="px-5 py-4 text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5" />
                              {new Date(session.startedAt).toLocaleDateString()}
                            </div>
                            <div className="text-xs mt-0.5">{formatAgo(session.startedAt)}</div>
                          </td>
                          <td className="px-5 py-4">
                            <span className={cn('inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border', cfg.badge)}>
                              {cfg.label}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-1.5 font-medium">
                              <Users className="w-4 h-4 text-muted-foreground" />
                              {session.participantCount}
                            </div>
                          </td>
                          <td className="px-5 py-4 text-muted-foreground">
                            {formatDuration(session.startedAt, session.endedAt)}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <Link
                              href={`/reports/${session.id}`}
                              className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-secondary text-secondary-foreground hover:bg-secondary/80 h-8 px-3"
                            >
                              View Report
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
        )}
      </div>
    </div>
  )
}
