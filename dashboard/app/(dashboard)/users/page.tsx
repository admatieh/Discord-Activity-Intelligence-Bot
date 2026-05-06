'use client'

import { useState } from 'react'
import { Topbar } from '@/components/dashboard/topbar'
import { type Participant } from '@/lib/types'

const mockParticipants: any[] = []
const generateTimeSeriesData = (a?: any, b?: any, c?: any) => []

import { cn } from '@/lib/utils'
import { Users, Mic, MessageSquare, Zap, CheckCircle, Circle, Search } from 'lucide-react'
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  BarChart, Bar, CartesianGrid,
} from 'recharts'

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-status-online' : score >= 60 ? 'bg-status-warning' : 'bg-status-error'
  const textColor = score >= 80 ? 'text-status-online' : score >= 60 ? 'text-status-warning' : 'text-status-error'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${score}%` }} />
      </div>
      <span className={cn('text-[10px] font-mono w-8 text-right', textColor)}>{score.toFixed(1)}</span>
    </div>
  )
}

function UserDetail({ user }: { user: any }) {
  const scoreHistory = generateTimeSeriesData(10, user.participationScore, 15)
  const radarData = [
    { subject: 'Voice', value: Math.min(100, (user.voiceMinutes / 45) * 100) },
    { subject: 'Chat', value: Math.min(100, (user.messageCount / 45) * 100) },
    { subject: 'Reactions', value: Math.min(100, (user.reactionCount / 20) * 100) },
    { subject: 'Commands', value: Math.min(100, (user.commandCount / 10) * 100) },
    { subject: 'Attendance', value: user.attendanceRate * 100 },
    { subject: 'Overall', value: user.participationScore },
  ]
  const sessionHistory = Array.from({ length: 8 }, (_, i) => ({
    session: `S${i + 1}`,
    score: Math.max(30, user.participationScore + (Math.random() - 0.5) * 30),
    voice: Math.floor(Math.random() * 60) + 10,
  }))

  return (
    <div className="flex flex-col h-full overflow-y-auto terminal-scroll p-5 space-y-4">
      {/* User header */}
      <div className="bg-card border border-border rounded p-4">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
            <span className="font-mono text-sm font-bold text-primary">{user.displayName[0]}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-mono text-sm font-semibold">{user.displayName}</h2>
              {user.isActive ? (
                <CheckCircle className="w-3 h-3 text-status-online" />
              ) : (
                <Circle className="w-3 h-3 text-muted-foreground" />
              )}
              <span className={cn('text-[10px] font-mono', user.isActive ? 'text-status-online' : 'text-muted-foreground')}>
                {user.isActive ? 'active now' : 'offline'}
              </span>
            </div>
            <p className="text-[10px] font-mono text-muted-foreground mt-0.5">@{user.username} · {user.userId}</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-mono text-muted-foreground uppercase">Overall Score</p>
            <p className={cn(
              'text-2xl font-mono font-bold',
              user.participationScore >= 80 ? 'text-status-online' :
                user.participationScore >= 60 ? 'text-status-warning' : 'text-status-error'
            )}>
              {user.participationScore.toFixed(1)}
            </p>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Voice Minutes', value: user.voiceMinutes, unit: 'min', icon: Mic, color: 'text-chart-3' },
          { label: 'Messages', value: user.messageCount, icon: MessageSquare, color: 'text-chart-2' },
          { label: 'Reactions', value: user.reactionCount, icon: Zap, color: 'text-chart-1' },
          { label: 'Attendance', value: `${(user.attendanceRate * 100).toFixed(0)}%`, icon: CheckCircle, color: 'text-status-online' },
        ].map((item) => {
          const Icon = item.icon
          return (
            <div key={item.label} className="bg-card border border-border rounded p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">{item.label}</span>
                <Icon className={cn('w-3 h-3', item.color)} />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-mono font-semibold">{item.value}</span>
                {'unit' in item && item.unit && <span className="text-[10px] font-mono text-muted-foreground">{item.unit}</span>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Radar */}
        <div className="bg-card border border-border rounded p-4">
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Activity Profile</p>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="oklch(0.22 0 0)" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: 'oklch(0.55 0 0)', fontFamily: 'monospace' }} />
              <Radar name={user.displayName} dataKey="value" stroke="oklch(0.65 0.18 220)" fill="oklch(0.65 0.18 220)" fillOpacity={0.15} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Score over sessions */}
        <div className="bg-card border border-border rounded p-4">
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Score History (last 8 sessions)</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={sessionHistory} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="oklch(0.22 0 0)" />
              <XAxis dataKey="session" tick={{ fontSize: 9, fill: 'oklch(0.55 0 0)', fontFamily: 'monospace' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 9, fill: 'oklch(0.55 0 0)', fontFamily: 'monospace' }} tickLine={false} axisLine={false} domain={[0, 100]} />
              <Tooltip contentStyle={{ backgroundColor: 'oklch(0.13 0 0)', border: '1px solid oklch(0.22 0 0)', fontSize: 11, fontFamily: 'monospace', borderRadius: 4 }} />
              <Bar dataKey="score" fill="oklch(0.65 0.18 220)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Score trend */}
      <div className="bg-card border border-border rounded p-4">
        <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Score Trend</p>
        <ResponsiveContainer width="100%" height={100}>
          <AreaChart data={scoreHistory} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="oklch(0.65 0.18 220)" stopOpacity={0.15} />
                <stop offset="95%" stopColor="oklch(0.65 0.18 220)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="time" tick={{ fontSize: 9, fill: 'oklch(0.55 0 0)', fontFamily: 'monospace' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 9, fill: 'oklch(0.55 0 0)', fontFamily: 'monospace' }} tickLine={false} axisLine={false} domain={[0, 100]} />
            <Tooltip contentStyle={{ backgroundColor: 'oklch(0.13 0 0)', border: '1px solid oklch(0.22 0 0)', fontSize: 11, fontFamily: 'monospace', borderRadius: 4 }} />
            <Area type="monotone" dataKey="value" stroke="oklch(0.65 0.18 220)" strokeWidth={1.5} fill="url(#scoreGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default function UsersPage() {
  const [selected, setSelected] = useState<any>(null)
  const [search, setSearch] = useState('')

  const filtered = mockParticipants.filter(
    (p) =>
      !search ||
      p.username.includes(search.toLowerCase()) ||
      p.displayName.toLowerCase().includes(search.toLowerCase())
  )
  const sorted = [...filtered].sort((a, b) => b.participationScore - a.participationScore)

  return (
    <div className="flex flex-col h-screen">
      <Topbar
        title="User Analytics"
        subtitle={`${mockParticipants.length} users tracked`}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* User list */}
        <div className="w-72 border-r border-border flex flex-col bg-card flex-shrink-0">
          {/* Search */}
          <div className="p-3 border-b border-border">
            <div className="flex items-center gap-2 bg-input border border-border rounded px-2.5 py-1.5">
              <Search className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search users..."
                className="flex-1 bg-transparent text-xs font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
              />
            </div>
          </div>

          {/* Stat row */}
          <div className="grid grid-cols-3 border-b border-border divide-x divide-border">
            {[
              { label: 'Total', value: mockParticipants.length },
              { label: 'Active', value: mockParticipants.filter((p) => p.isActive).length },
              { label: 'Avg Score', value: (mockParticipants.reduce((s, p) => s + p.participationScore, 0) / mockParticipants.length).toFixed(1) },
            ].map((item) => (
              <div key={item.label} className="p-2 text-center">
                <p className="text-[9px] font-mono text-muted-foreground uppercase">{item.label}</p>
                <p className="text-sm font-mono font-semibold mt-0.5">{item.value}</p>
              </div>
            ))}
          </div>

          {/* User list */}
          <div className="flex-1 overflow-y-auto terminal-scroll">
            {sorted.map((user, i) => (
              <button
                key={user.userId}
                onClick={() => setSelected(user)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 text-left border-b border-border/50 transition-colors',
                  selected?.userId === user.userId
                    ? 'bg-primary/10 border-l-2 border-l-primary'
                    : 'hover:bg-muted/30'
                )}
              >
                <div className="relative flex-shrink-0">
                  <div className="w-7 h-7 rounded bg-muted border border-border flex items-center justify-center">
                    <span className="font-mono text-xs font-bold text-foreground">{user.displayName[0]}</span>
                  </div>
                  {user.isActive && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-status-online rounded-full border border-background" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-mono text-muted-foreground/50 w-4">#{i + 1}</span>
                    <span className="text-xs font-mono font-semibold truncate">{user.displayName}</span>
                  </div>
                  <div className="mt-0.5 w-full">
                    <ScoreBar score={user.participationScore} />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* User detail */}
        <div className="flex-1 overflow-hidden">
          {selected ? (
            <UserDetail user={selected} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Users className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="font-mono text-sm text-muted-foreground">Select a user to view analytics</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
