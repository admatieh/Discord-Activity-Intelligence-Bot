import { Topbar } from '@/components/dashboard/topbar'
import { StatCard } from '@/components/dashboard/stat-card'
import { LogLine } from '@/components/dashboard/log-line'
import { cn } from '@/lib/utils'
import {
  Radio,
  Users,
  MessageSquare,
  Mic,
  Zap,
  AlertTriangle,
  CheckCircle,
  Database,
  Cpu,
  Network,
} from 'lucide-react'
import Link from 'next/link'
import { OverviewCharts } from '@/components/dashboard/overview-charts'

const recentLogs: any[] = []
const activityData: any[] = []
const voiceData: any[] = []
const msgData: any[] = []

export default function OverviewPage() {
  const activeSession = {
    id: 'None',
    channelName: 'Unknown',
    participantCount: 0,
    totalMessages: 0,
    totalVoiceMinutes: 0,
    avgScore: 0
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Topbar
        title="Overview"
        subtitle="system-metrics"
        badge="LIVE"
        badgeVariant="default"
      />

      <div className="p-5 space-y-5">
        {/* System health banner */}
        <div className="flex items-center gap-3 bg-status-online/5 border border-status-online/20 rounded px-4 py-2.5">
          <CheckCircle className="w-3.5 h-3.5 text-status-online flex-shrink-0" />
          <span className="text-xs font-mono text-status-online">ALL SYSTEMS OPERATIONAL</span>
          <span className="ml-auto text-[10px] font-mono text-muted-foreground">Last checked 3s ago</span>
        </div>

        {/* Top stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
          <StatCard
            label="Active Sessions"
            value={1}
            icon={Radio}
            iconColor="text-status-online"
            trend="neutral"
            delta="1 running"
          />
          <StatCard
            label="Live Participants"
            value={activeSession.participantCount}
            icon={Users}
            iconColor="text-chart-1"
            trend="up"
            delta="+2 since start"
          />
          <StatCard
            label="Messages (session)"
            value={activeSession.totalMessages}
            icon={MessageSquare}
            iconColor="text-chart-2"
            trend="up"
            delta="+14 last 5m"
          />
          <StatCard
            label="Voice Minutes"
            value={activeSession.totalVoiceMinutes}
            icon={Mic}
            iconColor="text-chart-3"
            unit="min"
            trend="up"
            delta="+8 last 5m"
          />
          <StatCard
            label="Avg Score"
            value={activeSession.avgScore.toFixed(1)}
            icon={Zap}
            iconColor="text-status-warning"
            trend="up"
            delta="+1.2 this session"
          />
          <StatCard
            label="Bot Latency"
            value={42}
            unit="ms"
            icon={Network}
            iconColor="text-chart-1"
            trend="neutral"
            delta="stable"
          />
        </div>

        {/* Charts — client component to avoid SSR issues with Recharts */}
        <OverviewCharts voiceData={voiceData} msgData={msgData} activityData={activityData} />

        {/* System status */}
        <div className="bg-card border border-border rounded p-4">
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-3">System Status</p>
            <div className="space-y-2">
              {[
                { label: 'Gateway', status: 'OK', ms: '42ms', ok: true, icon: Network },
                { label: 'Database', status: 'OK', ms: '8ms', ok: true, icon: Database },
                { label: 'Event Bus', status: 'OK', ms: '0 queued', ok: true, icon: Zap },
                { label: 'Score Engine', status: 'IDLE', ms: null, ok: true, icon: Cpu },
                { label: 'Session Mgr', status: 'OK', ms: '1 active', ok: true, icon: Radio },
                { label: 'Error Rate', status: '0.02%', ms: null, ok: true, icon: AlertTriangle },
              ].map((item) => {
                const Icon = item.icon
                return (
                  <div key={item.label} className="flex items-center gap-2 py-1 border-b border-border/50 last:border-0">
                    <Icon className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs font-mono text-muted-foreground flex-1">{item.label}</span>
                    <span className={`text-[10px] font-mono font-semibold ${item.ok ? 'text-status-online' : 'text-status-error'}`}>
                      {item.status}
                    </span>
                    {item.ms && <span className="text-[10px] font-mono text-muted-foreground/60">{item.ms}</span>}
                  </div>
                )
              })}
            </div>
          </div>

        {/* Active session + recent logs */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {/* Active session */}
          <div className="bg-card border border-border rounded p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Active Session</p>
              <Link href="/sessions" className="text-[10px] font-mono text-primary hover:underline">
                view all →
              </Link>
            </div>
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-online opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-status-online" />
                  </span>
                  <span className="text-base font-mono font-semibold">#{activeSession.channelName}</span>
                </div>
                <p className="text-[10px] font-mono text-muted-foreground mt-0.5">ID: {activeSession.id}</p>
              </div>
              <span className="text-[10px] font-mono bg-status-online/10 text-status-online border border-status-online/20 px-1.5 py-0.5 rounded">ACTIVE</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Participants', value: activeSession.participantCount },
                { label: 'Messages', value: activeSession.totalMessages },
                { label: 'Voice Min', value: activeSession.totalVoiceMinutes },
                { label: 'Avg Score', value: activeSession.avgScore.toFixed(1) },
                { label: 'Duration', value: '45m' },
                { label: 'Guild', value: 'DevOps' },
              ].map((item) => (
                <div key={item.label} className="bg-muted/30 rounded p-2">
                  <p className="text-[9px] font-mono text-muted-foreground uppercase">{item.label}</p>
                  <p className="text-sm font-mono font-semibold mt-0.5">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-border">
              <Link
                href={`/sessions/${activeSession.id}`}
                className="text-[10px] font-mono text-primary hover:underline"
              >
                Open session detail →
              </Link>
            </div>
          </div>

          {/* Recent logs */}
          <div className="bg-card border border-border rounded p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Recent Logs</p>
              <Link href="/logs" className="text-[10px] font-mono text-primary hover:underline">
                view all →
              </Link>
            </div>
            <div className="space-y-0.5">
              {recentLogs.slice(0, 10).map((log) => (
                <LogLine key={log.id} {...log} compact />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
