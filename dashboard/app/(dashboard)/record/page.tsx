'use client'

import { useState, useEffect } from 'react'
import { Topbar } from '@/components/dashboard/topbar'
import { cn } from '@/lib/utils'
import {
  Play, Square, RefreshCw, Loader2, CheckCircle, XCircle,
  AlertTriangle, Mic, Clock, Radio, Users, Settings2
} from 'lucide-react'
import Link from 'next/link'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Guild { id: string; name: string; memberCount: number }
interface VoiceChannel { id: string; name: string; memberCount: number; parentName?: string; members: { id: string; displayName: string }[] }
interface TextChannel { id: string; name: string; parentName?: string }
interface ActiveSession {
  id: number
  channel_id: string
  triggered_by: string
  start_time: string
  duration_minutes: number
  auto_end_at: string
}
interface ActionResult { ok: boolean; message?: string; error?: string }

function formatCountdown(isoEnd: string) {
  const diff = Math.floor((new Date(isoEnd).getTime() - Date.now()) / 1000)
  if (diff <= 0) return 'Ending soon'
  const m = Math.floor(diff / 60)
  return `${m} min left`
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function RecordSessionPage() {
  const [botOnline, setBotOnline] = useState<boolean | null>(null)
  const [guilds, setGuilds] = useState<Guild[]>([])
  const [voiceChannels, setVoiceChannels] = useState<VoiceChannel[]>([])
  const [textChannels, setTextChannels] = useState<TextChannel[]>([])
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([])
  const [lastResult, setLastResult] = useState<ActionResult | null>(null)

  // Form state
  const [selectedGuild, setSelectedGuild] = useState('')
  const [selectedVoice, setSelectedVoice] = useState('')
  const [selectedText, setSelectedText] = useState('')
  const [duration, setDuration] = useState(60)

  // Loading states
  const [loadingGuilds, setLoadingGuilds] = useState(false)
  const [loadingChannels, setLoadingChannels] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [endingId, setEndingId] = useState<number | null>(null)

  useEffect(() => {
    checkBotStatus()
    loadActiveSessions()
  }, [])

  async function checkBotStatus() {
    try {
      const res = await fetch('/api/system/health')
      const data = await res.json()
      setBotOnline(data.success !== false && data.data?.status !== 'unreachable')
      if (data.success !== false) loadGuilds()
    } catch {
      setBotOnline(false)
    }
  }

  async function loadGuilds() {
    setLoadingGuilds(true)
    try {
      const res = await fetch('/api/discord/guilds')
      const data = await res.json()
      if (data.ok && data.guilds) {
        setGuilds(data.guilds)
        if (data.guilds.length === 1) {
          setSelectedGuild(data.guilds[0].id)
          loadChannels(data.guilds[0].id)
        }
      }
    } catch {}
    setLoadingGuilds(false)
  }

  async function loadChannels(guildId: string) {
    setLoadingChannels(true)
    setSelectedVoice('')
    setSelectedText('')
    try {
      const [voiceRes, textRes] = await Promise.all([
        fetch(`/api/discord/guilds/${guildId}/voice-channels`),
        fetch(`/api/discord/guilds/${guildId}/text-channels`)
      ])
      const [voiceData, textData] = await Promise.all([voiceRes.json(), textRes.json()])
      setVoiceChannels(voiceData.channels || [])
      setTextChannels(textData.channels || [])
    } catch {}
    setLoadingChannels(false)
  }

  async function loadActiveSessions() {
    try {
      const res = await fetch('/api/sessions?status=active&pageSize=10')
      const data = await res.json()
      if (data.success && data.data?.data) {
        setActiveSessions(data.data.data.map((s: any) => ({
          id: parseInt(s.id.replace('sess_', '')),
          channel_id: s.channelId,
          triggered_by: s.triggeredBy || 'Instructor',
          start_time: s.startedAt,
          duration_minutes: s.duration || 60,
          auto_end_at: s.autoEndAt || new Date(new Date(s.startedAt).getTime() + (s.duration || 60) * 60000).toISOString()
        })))
      }
    } catch {}
  }

  const selectedVoiceChannel = voiceChannels.find(c => c.id === selectedVoice)
  const canStart = botOnline && selectedVoice && duration > 0

  async function handleStartSession() {
    if (!canStart) return
    setSubmitting(true)
    setLastResult(null)
    try {
      const res = await fetch('/api/actions/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guildId: selectedGuild || undefined,
          voiceChannelId: selectedVoice,
          textChannelId: selectedText || undefined,
          durationMinutes: duration,
          requestedBy: 'Instructor',
          source: 'dashboard'
        })
      })
      const data = await res.json()
      setLastResult(data)
      if (data.ok) {
        await loadActiveSessions()
        setSelectedVoice('')
        setSelectedText('')
      }
    } catch (err: any) {
      setLastResult({ ok: false, error: err.message })
    }
    setSubmitting(false)
  }

  async function handleEndSession(sessionId: number) {
    setEndingId(sessionId)
    setLastResult(null)
    try {
      const res = await fetch('/api/actions/session/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      })
      const data = await res.json()
      if (data.ok) await loadActiveSessions()
    } catch {}
    setEndingId(null)
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Topbar
        title="Record a Session"
        subtitle="Start tracking activity"
      />

      <div className="p-6 max-w-4xl mx-auto w-full">
        
        {/* Form Container */}
        <div className="bg-card border border-border rounded-xl shadow-sm p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold mb-2">New Recording</h1>
            <p className="text-muted-foreground text-sm">Choose where you want to start recording activity data.</p>
          </div>

          {botOnline === false && (
            <div className="mb-6 bg-status-error/10 border border-status-error/20 text-status-error px-4 py-3 rounded-lg flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">The Discord bot is currently offline. You cannot start a session right now.</p>
            </div>
          )}

          {lastResult && (
            <div className={cn(
              "mb-6 px-4 py-3 rounded-lg flex items-center gap-3 text-sm font-medium",
              lastResult.ok ? "bg-status-online/10 text-status-online border border-status-online/20" : "bg-status-error/10 text-status-error border border-status-error/20"
            )}>
              {lastResult.ok ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
              {lastResult.message || lastResult.error}
            </div>
          )}

          <div className="space-y-6 max-w-2xl">
            {/* Guild Selection */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">1. Select Server</label>
              <select
                value={selectedGuild}
                onChange={e => {
                  setSelectedGuild(e.target.value)
                  if (e.target.value) loadChannels(e.target.value)
                }}
                className="w-full bg-background border border-input rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
              >
                <option value="">Select a server...</option>
                {guilds.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            {/* Voice Channel */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">2. Voice Channel to Record</label>
              <select
                value={selectedVoice}
                onChange={e => setSelectedVoice(e.target.value)}
                disabled={!selectedGuild || loadingChannels}
                className="w-full bg-background border border-input rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow disabled:opacity-50"
              >
                <option value="">Select a voice channel...</option>
                {voiceChannels.map(ch => (
                  <option key={ch.id} value={ch.id}>
                    {ch.name} {ch.memberCount > 0 ? `(${ch.memberCount} active)` : ''}
                  </option>
                ))}
              </select>
              {selectedVoiceChannel && selectedVoiceChannel.memberCount > 0 && (
                <p className="text-sm text-status-online mt-2 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" />
                  {selectedVoiceChannel.memberCount} participant(s) currently waiting in channel.
                </p>
              )}
            </div>

            {/* Duration */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">3. Session Duration</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[30, 45, 60, 90].map(val => (
                  <button
                    key={val}
                    onClick={() => setDuration(val)}
                    className={cn(
                      "py-2.5 px-4 rounded-lg border text-sm font-medium transition-all",
                      duration === val
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-background border-input text-foreground hover:bg-muted"
                    )}
                  >
                    {val} Minutes
                  </button>
                ))}
              </div>
            </div>

            {/* Optional Settings */}
            <div className="pt-4 border-t border-border">
              <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-muted-foreground" />
                Optional: Post updates to channel
              </label>
              <select
                value={selectedText}
                onChange={e => setSelectedText(e.target.value)}
                disabled={!selectedGuild || loadingChannels}
                className="w-full bg-background border border-input rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow disabled:opacity-50"
              >
                <option value="">Do not post updates</option>
                {textChannels.map(ch => (
                  <option key={ch.id} value={ch.id}>#{ch.name}</option>
                ))}
              </select>
            </div>

            {/* Submit */}
            <div className="pt-6">
              <button
                onClick={handleStartSession}
                disabled={!canStart || submitting}
                className={cn(
                  "flex items-center justify-center gap-2 w-full md:w-auto px-8 py-3 rounded-lg text-sm font-semibold transition-all shadow-sm",
                  canStart && !submitting
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                )}
              >
                {submitting ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Starting Recording...</>
                ) : (
                  <><Play className="w-5 h-5" /> Start Recording Now</>
                )}
              </button>
              
              <div className="mt-4 flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Or</span>
                <Link href="/scheduled" className="text-sm font-medium text-primary hover:underline">
                  Schedule for later
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Active Sessions List */}
        {activeSessions.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Currently Recording</h2>
              <button onClick={loadActiveSessions} className="text-sm text-primary flex items-center gap-1 hover:underline">
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeSessions.map(session => (
                <div key={session.id} className="bg-card border border-status-online/30 rounded-xl p-5 shadow-sm relative overflow-hidden">
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
                      <h3 className="font-medium text-foreground">Session #{session.id}</h3>
                    </div>
                    <span className="text-sm font-medium text-muted-foreground bg-muted px-2 py-1 rounded">
                      {formatCountdown(session.auto_end_at)}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-5">
                    <span className="flex items-center gap-1.5"><Radio className="w-4 h-4" /> Channel: {session.channel_id.slice(-4)}</span>
                    <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {session.duration_minutes} min limit</span>
                  </div>

                  <button
                    onClick={() => handleEndSession(session.id)}
                    disabled={endingId === session.id}
                    className="w-full flex items-center justify-center gap-2 bg-status-error/10 text-status-error hover:bg-status-error/20 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {endingId === session.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
                    Stop Recording
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
