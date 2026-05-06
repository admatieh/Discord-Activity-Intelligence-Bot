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

interface TimePoint {
  time: string
  value: number
}

interface ActivityPoint {
  day: string
  participants: number
  sessions: number
}

interface OverviewChartsProps {
  voiceData: TimePoint[]
  msgData: TimePoint[]
  activityData: ActivityPoint[]
}

export function OverviewCharts({ voiceData, msgData, activityData }: OverviewChartsProps) {
  return (
    <>
      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Voice Activity</p>
              <p className="text-sm font-semibold mt-0.5">Active Voice Minutes / Hour</p>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground">Last 24h</span>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={voiceData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="voiceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.65 0.18 220)" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="oklch(0.65 0.18 220)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" tick={{ fontSize: 9, fill: 'oklch(0.55 0 0)', fontFamily: 'monospace' }} tickLine={false} axisLine={false} interval={5} />
              <YAxis tick={{ fontSize: 9, fill: 'oklch(0.55 0 0)', fontFamily: 'monospace' }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: 'oklch(0.13 0 0)', border: '1px solid oklch(0.22 0 0)', fontSize: 11, fontFamily: 'monospace', borderRadius: 4 }}
                labelStyle={{ color: 'oklch(0.55 0 0)' }}
                itemStyle={{ color: 'oklch(0.65 0.18 220)' }}
              />
              <Area type="monotone" dataKey="value" stroke="oklch(0.65 0.18 220)" strokeWidth={1.5} fill="url(#voiceGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Message Activity</p>
              <p className="text-sm font-semibold mt-0.5">Messages per Hour</p>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground">Last 24h</span>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={msgData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="msgGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.65 0.18 145)" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="oklch(0.65 0.18 145)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" tick={{ fontSize: 9, fill: 'oklch(0.55 0 0)', fontFamily: 'monospace' }} tickLine={false} axisLine={false} interval={5} />
              <YAxis tick={{ fontSize: 9, fill: 'oklch(0.55 0 0)', fontFamily: 'monospace' }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: 'oklch(0.13 0 0)', border: '1px solid oklch(0.22 0 0)', fontSize: 11, fontFamily: 'monospace', borderRadius: 4 }}
                labelStyle={{ color: 'oklch(0.55 0 0)' }}
                itemStyle={{ color: 'oklch(0.65 0.18 145)' }}
              />
              <Area type="monotone" dataKey="value" stroke="oklch(0.65 0.18 145)" strokeWidth={1.5} fill="url(#msgGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Weekly activity chart */}
      <div className="bg-card border border-border rounded p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Weekly Activity</p>
            <p className="text-sm font-semibold mt-0.5">Sessions &amp; Participants by Day</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={activityData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="oklch(0.22 0 0)" />
            <XAxis dataKey="day" tick={{ fontSize: 9, fill: 'oklch(0.55 0 0)', fontFamily: 'monospace' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 9, fill: 'oklch(0.55 0 0)', fontFamily: 'monospace' }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ backgroundColor: 'oklch(0.13 0 0)', border: '1px solid oklch(0.22 0 0)', fontSize: 11, fontFamily: 'monospace', borderRadius: 4 }}
              labelStyle={{ color: 'oklch(0.55 0 0)' }}
            />
            <Bar dataKey="participants" fill="oklch(0.65 0.18 220)" radius={[2, 2, 0, 0]} />
            <Bar dataKey="sessions" fill="oklch(0.65 0.18 145)" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  )
}
