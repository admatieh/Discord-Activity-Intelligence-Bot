'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  CartesianGrid,
} from 'recharts'

interface VoicePoint {
  t: string
  active: number
  muted: number
}

interface InteractionPoint {
  t: string
  messages: number
  reactions: number
  commands: number
}

interface SessionChartsProps {
  voiceTimeline: VoicePoint[]
  interactionTimeline: InteractionPoint[]
}

export function SessionCharts({ voiceTimeline, interactionTimeline }: SessionChartsProps) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
      <div className="bg-card border border-border rounded p-4">
        <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Voice Activity Over Time</p>
        <p className="text-sm font-semibold mb-3">Active vs Muted Participants</p>
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart data={voiceTimeline} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <XAxis dataKey="t" tick={{ fontSize: 9, fill: 'oklch(0.55 0 0)', fontFamily: 'monospace' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 9, fill: 'oklch(0.55 0 0)', fontFamily: 'monospace' }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ backgroundColor: 'oklch(0.13 0 0)', border: '1px solid oklch(0.22 0 0)', fontSize: 11, fontFamily: 'monospace', borderRadius: 4 }} />
            <Area type="monotone" dataKey="active" stroke="oklch(0.65 0.18 145)" fill="oklch(0.65 0.18 145 / 0.1)" strokeWidth={1.5} />
            <Area type="monotone" dataKey="muted" stroke="oklch(0.60 0.22 25)" fill="oklch(0.60 0.22 25 / 0.05)" strokeWidth={1.5} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-card border border-border rounded p-4">
        <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Interaction Activity</p>
        <p className="text-sm font-semibold mb-3">Messages / Reactions / Commands</p>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={interactionTimeline} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="oklch(0.22 0 0)" />
            <XAxis dataKey="t" tick={{ fontSize: 9, fill: 'oklch(0.55 0 0)', fontFamily: 'monospace' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 9, fill: 'oklch(0.55 0 0)', fontFamily: 'monospace' }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ backgroundColor: 'oklch(0.13 0 0)', border: '1px solid oklch(0.22 0 0)', fontSize: 11, fontFamily: 'monospace', borderRadius: 4 }} />
            <Bar dataKey="messages" fill="oklch(0.65 0.18 220)" radius={[2, 2, 0, 0]} />
            <Bar dataKey="reactions" fill="oklch(0.65 0.18 145)" radius={[2, 2, 0, 0]} />
            <Bar dataKey="commands" fill="oklch(0.75 0.18 75)" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
