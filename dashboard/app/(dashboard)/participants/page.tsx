'use client'

import { useState, useEffect, useMemo } from 'react'
import { Topbar } from '@/components/dashboard/topbar'
import { cn } from '@/lib/utils'
import { Users, Mic, MessageSquare, CheckCircle, Search, Loader2, RefreshCw, Calendar, Activity } from 'lucide-react'

function UserDetail({ user }: { user: any }) {
  return (
    <div className="flex flex-col h-full overflow-y-auto p-6 space-y-6">
      <div className="bg-card border border-border rounded-xl shadow-sm p-6">
        <div className="flex items-start gap-5">
          <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
            <span className="text-xl font-bold text-primary">
              {(user.displayName || user.username || '?')[0]?.toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold">{user.displayName || user.username}</h2>
              {user.inVoice && (
                <span className="bg-status-online/10 text-status-online text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-status-online rounded-full"></span>
                  In Voice
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              @{user.username}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Voice Time', value: Math.round(user.totalVoiceMinutes || 0), unit: 'min', icon: Mic, color: 'text-chart-3', bg: 'bg-chart-3/10' },
          { label: 'Messages', value: user.messageCount || 0, icon: MessageSquare, color: 'text-chart-2', bg: 'bg-chart-2/10' },
          { label: 'Sessions', value: user.sessionsAttended || 0, icon: Activity, color: 'text-chart-1', bg: 'bg-chart-1/10' },
          { label: 'Last Active', value: user.lastActive ? new Date(user.lastActive).toLocaleDateString() : 'N/A', icon: Calendar, color: 'text-primary', bg: 'bg-primary/10' },
        ].map(item => {
          const Icon = item.icon
          return (
            <div key={item.label} className="bg-card border border-border rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", item.bg)}>
                  <Icon className={cn('w-4 h-4', item.color)} />
                </div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{item.label}</span>
              </div>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-bold">{item.value}</span>
                {'unit' in item && item.unit && <span className="text-sm text-muted-foreground">{item.unit}</span>}
              </div>
            </div>
          )
        })}
      </div>

      {user.voiceChannelName && (
        <div className="bg-status-online/5 border border-status-online/20 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-status-online" />
          <p className="text-sm text-foreground font-medium">
            Currently active in <span className="font-semibold text-status-online">#{user.voiceChannelName}</span>
          </p>
        </div>
      )}
    </div>
  )
}

export default function ParticipantsPage() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any>(null)
  const [search, setSearch] = useState('')

  async function fetchUsers() {
    setLoading(true)
    try {
      const res = await fetch('/api/users?pageSize=50')
      const data = await res.json()
      if (data.success && data.data?.data) {
        const mapped = data.data.data.map((u: any) => ({
          ...u,
          displayName: u.display_name || u.username,
          sessionsAttended: u.sessionsAttended || 0,
          totalVoiceMinutes: u.totalVoiceMinutes || 0,
          messageCount: u.totalMessages || 0,
          lastActive: u.lastActive || u.updated_at,
          inVoice: false,
          voiceChannelName: null
        }))
        setUsers(mapped)
      }
    } catch (err: any) {
      console.error(err)
    }
    setLoading(false)
  }

  useEffect(() => { fetchUsers() }, [])

  const filtered = useMemo(() => {
    if (!search) return users
    const q = search.toLowerCase()
    return users.filter(u =>
      u.username?.toLowerCase().includes(q) ||
      u.displayName?.toLowerCase().includes(q)
    )
  }, [users, search])

  return (
    <div className="flex flex-col h-screen">
      <Topbar
        title="Participants"
        subtitle="Manage and view student engagement"
        actions={
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg border border-border hover:bg-muted/50 transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </button>
        }
      />

      <div className="flex flex-1 overflow-hidden bg-background">
        {/* User list sidebar */}
        <div className="w-80 border-r border-border flex flex-col bg-card/30 flex-shrink-0">
          {/* Search */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-2 bg-background border border-input rounded-lg px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-primary/50 transition-all">
              <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search participants..."
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </div>
          </div>

          {/* User list */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-32 gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Loading participants...</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center">
                <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  {users.length === 0 ? 'No participants found yet.' : 'No matches found.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {filtered.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => setSelected(user)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50',
                      selected?.id === user.id ? 'bg-primary/5 border-l-2 border-l-primary' : 'border-l-2 border-l-transparent'
                    )}
                  >
                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-foreground">
                        {(user.displayName || user.username || '?')[0]?.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold truncate">{user.displayName || user.username}</span>
                        {user.inVoice && <div className="w-2 h-2 bg-status-online rounded-full"></div>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {user.sessionsAttended} sessions
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* User detail */}
        <div className="flex-1 overflow-hidden bg-background">
          {selected ? (
            <UserDetail user={selected} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-muted-foreground/50" />
                </div>
                <h3 className="text-lg font-medium text-foreground mb-1">No Participant Selected</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Select a participant from the list to view their engagement stats, voice activity, and session history.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
