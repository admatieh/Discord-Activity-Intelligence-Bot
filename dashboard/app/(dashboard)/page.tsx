import { Topbar } from '@/components/dashboard/topbar'
import { StatCard } from '@/components/dashboard/stat-card'
import {
  Radio,
  Users,
  MessageSquare,
  Calendar,
  PlayCircle,
  FileText,
  Activity,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react'
import Link from 'next/link'
import { getSessions, getLogs } from '@/server/repositories'
import { dbExists } from '@/server/db'

export default function OverviewPage() {
  const { data: allSessions, total: totalSessions } = getSessions(undefined, 100, 0)
  const activeSessions = allSessions.filter(s => s.status === 'active')
  const totalParticipants = allSessions.reduce((s, x) => s + (x.participantCount || 0), 0)

  const activeSession = activeSessions[0] || null

  return (
    <div className="flex flex-col min-h-screen">
      <Topbar
        title="Home"
        subtitle="Instructor Workspace"
      />

      <div className="p-6 space-y-8 max-w-6xl mx-auto w-full">
        {/* System health banner - gentle style */}
        {!dbExists && (
          <div className="flex items-center gap-3 bg-status-warning/10 border-status-warning/30 border rounded-lg px-4 py-3">
            <AlertTriangle className="w-5 h-5 text-status-warning flex-shrink-0" />
            <span className="text-sm font-medium text-status-warning">
              System notice: Database connection missing. Please configure your environment.
            </span>
          </div>
        )}

        {/* Welcome Section */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">Welcome back.</h1>
          <p className="text-muted-foreground">Here is what is happening in your workspace today.</p>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/record" className="group relative overflow-hidden bg-primary text-primary-foreground border-transparent rounded-xl p-5 hover:bg-primary/90 transition-all shadow-sm">
              <div className="flex flex-col gap-3">
                <PlayCircle className="w-6 h-6 text-primary-foreground/80 group-hover:scale-110 transition-transform" />
                <div>
                  <h3 className="font-semibold text-lg">Record a Session</h3>
                  <p className="text-sm text-primary-foreground/80 mt-1">Start tracking activity in a voice channel immediately.</p>
                </div>
              </div>
            </Link>

            <Link href="/scheduled" className="group bg-card border border-border rounded-xl p-5 hover:border-primary/50 hover:shadow-sm transition-all">
              <div className="flex flex-col gap-3">
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                  <Calendar className="w-5 h-5 text-secondary-foreground group-hover:text-primary transition-colors" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Schedule</h3>
                  <p className="text-sm text-muted-foreground mt-1">Plan a session for later.</p>
                </div>
              </div>
            </Link>

            <Link href="/messages" className="group bg-card border border-border rounded-xl p-5 hover:border-primary/50 hover:shadow-sm transition-all">
              <div className="flex flex-col gap-3">
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                  <MessageSquare className="w-5 h-5 text-secondary-foreground group-hover:text-primary transition-colors" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Send Message</h3>
                  <p className="text-sm text-muted-foreground mt-1">Announce to a channel.</p>
                </div>
              </div>
            </Link>

            <Link href="/reports" className="group bg-card border border-border rounded-xl p-5 hover:border-primary/50 hover:shadow-sm transition-all">
              <div className="flex flex-col gap-3">
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                  <FileText className="w-5 h-5 text-secondary-foreground group-hover:text-primary transition-colors" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">View Reports</h3>
                  <p className="text-sm text-muted-foreground mt-1">Review past sessions.</p>
                </div>
              </div>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Live Session Status */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Live Now</h2>
              </div>
              
              {activeSession ? (
                <div className="bg-card border border-status-online/30 rounded-xl p-6 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-status-online"></div>
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-online opacity-75" />
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-status-online" />
                        </span>
                        <span className="text-xs font-semibold text-status-online uppercase tracking-wider">Recording in Progress</span>
                      </div>
                      <h3 className="text-xl font-semibold mt-1">#{activeSession.channelName}</h3>
                      <p className="text-sm text-muted-foreground mt-1">Started by {activeSession.triggeredBy || 'Instructor'}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-secondary/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-1">Participants</p>
                      <p className="text-lg font-semibold">{activeSession.participantCount}</p>
                    </div>
                    <div className="bg-secondary/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-1">Duration</p>
                      <p className="text-lg font-semibold">{activeSession.duration || 60} min limit</p>
                    </div>
                  </div>

                  <Link href={`/reports/${activeSession.id}`} className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-secondary text-secondary-foreground hover:bg-secondary/80 h-10 px-4 py-2">
                    Open Dashboard
                  </Link>
                </div>
              ) : (
                <div className="bg-card border border-border border-dashed rounded-xl p-8 text-center flex flex-col items-center justify-center shadow-sm">
                  <Radio className="w-8 h-8 text-muted-foreground/30 mb-4" />
                  <h3 className="text-base font-medium mb-1">No active sessions</h3>
                  <p className="text-sm text-muted-foreground mb-4">You are not currently recording any channels.</p>
                  <Link href="/record" className="text-sm text-primary hover:underline font-medium">
                    Start a new recording
                  </Link>
                </div>
              )}
            </div>

            {/* Upcoming / Scheduled */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Coming Up</h2>
                <Link href="/scheduled" className="text-sm text-primary hover:underline">View Calendar</Link>
              </div>
              <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                <div className="text-center py-6">
                  <Calendar className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No sessions scheduled for today.</p>
                </div>
              </div>
            </div>

          </div>

          {/* Right Sidebar Area */}
          <div className="space-y-6">
            
            {/* Overview Stats */}
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">This Week</h2>
              <div className="space-y-3">
                <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-chart-1/10 flex items-center justify-center">
                      <Radio className="w-4 h-4 text-chart-1" />
                    </div>
                    <span className="text-sm font-medium">Sessions Hosted</span>
                  </div>
                  <span className="text-xl font-bold">{totalSessions}</span>
                </div>
                
                <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-chart-2/10 flex items-center justify-center">
                      <Users className="w-4 h-4 text-chart-2" />
                    </div>
                    <span className="text-sm font-medium">Total Participants</span>
                  </div>
                  <span className="text-xl font-bold">{totalParticipants}</span>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Recent Activity</h2>
                <Link href="/activity" className="text-sm text-primary hover:underline">View All</Link>
              </div>
              <div className="bg-card border border-border rounded-xl p-1 shadow-sm overflow-hidden">
                 <div className="text-center py-8">
                  <Activity className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Activity feed will appear here.</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
