// dashboard/server/repositories/index.ts
import { db } from '../db';
import type { LogEntry, LogSource } from '@/lib/types';

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export function getSessions(status?: string, limit = 50, offset = 0): { data: any[], total: number } {
    let where = '';
    let params: any[] = [];

    if (status === 'active') {
        where = 'WHERE s.end_time IS NULL';
    } else if (status === 'ended') {
        where = 'WHERE s.end_time IS NOT NULL';
    }

    const totalRow = db.prepare(`SELECT COUNT(*) as count FROM sessions s ${where}`).get(...params) as { count: number };
    const rows = db.prepare(
        `SELECT s.* FROM sessions s ${where} ORDER BY s.start_time DESC LIMIT ? OFFSET ?`
    ).all(...params, limit, offset);

    const data = rows.map((r: any) => {
        // Count unique attendees via voice_events
        const attendeeRow = db.prepare(
            'SELECT COUNT(DISTINCT user_id) as count FROM voice_events WHERE session_id = ?'
        ).get(r.id) as { count: number } | undefined;

        // Total voice minutes from closed voice events
        const voiceRow = db.prepare(
            `SELECT COALESCE(SUM(ROUND((julianday(leave_time) - julianday(join_time)) * 1440)), 0) as total
             FROM voice_events WHERE session_id = ? AND leave_time IS NOT NULL`
        ).get(r.id) as { total: number } | undefined;

        // Average participation score
        const scoreRow = db.prepare(
            'SELECT AVG(score) as avg FROM participation_summary WHERE session_id = ?'
        ).get(r.id) as { avg: number | null } | undefined;

        return {
            id: `sess_${r.id}`,
            channelId: r.channel_id,
            channelName: `ch_${r.channel_id?.slice(-6)}`,
            guildName: 'Guild',
            triggeredBy: r.triggered_by,
            startedAt: r.start_time,
            endedAt: r.end_time,
            autoEndAt: r.auto_end_at,
            duration: r.duration_minutes,
            status: r.end_time ? 'ended' : 'active',
            participantCount: attendeeRow?.count || 0,
            totalMessages: 0,
            totalVoiceMinutes: Math.round(voiceRow?.total || 0),
            avgScore: Math.round((scoreRow?.avg || 0) * 10) / 10,
        };
    });

    return { data, total: totalRow?.count || 0 };
}

// ---------------------------------------------------------------------------
// Logs
// ---------------------------------------------------------------------------

export function getLogs(limit = 200): LogEntry[] {
    const rows = db.prepare(
        'SELECT * FROM logs ORDER BY created_at DESC LIMIT ?'
    ).all(limit);

    return rows.map((r: any) => {
        const VALID_SOURCES: LogSource[] = ['bot', 'api', 'db', 'voice', 'gateway', 'system'];
        let contextSource: LogSource = 'system';
        try {
            const ctx = JSON.parse(r.context || '{}');
            const s = ctx.source || 'system';
            contextSource = VALID_SOURCES.includes(s as LogSource) ? s as LogSource : 'system';
        } catch {}

        return {
            id: `log_${r.id}`,
            timestamp: r.created_at,
            level: r.level || 'info',
            source: contextSource,
            message: r.message || ''
        };
    });
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export function getUsers(limit = 50, offset = 0): { data: any[], total: number } {
    const totalRow = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    const rows = db.prepare(
        'SELECT * FROM users ORDER BY updated_at DESC LIMIT ? OFFSET ?'
    ).all(limit, offset);

    const data = rows.map((r: any) => {
        // Count sessions attended
        const sessionsRow = db.prepare(
            'SELECT COUNT(DISTINCT session_id) as count FROM voice_events WHERE user_id = ?'
        ).get(r.id) as { count: number } | undefined;

        // Total voice minutes
        const voiceRow = db.prepare(
            `SELECT COALESCE(SUM(ROUND((julianday(leave_time) - julianday(join_time)) * 1440)), 0) as total
             FROM voice_events WHERE user_id = ? AND leave_time IS NOT NULL`
        ).get(r.id) as { total: number } | undefined;

        return {
            id: r.id,
            username: r.username,
            discriminator: r.discriminator,
            display_name: r.display_name,
            sessionsAttended: sessionsRow?.count || 0,
            totalVoiceMinutes: Math.round(voiceRow?.total || 0),
            totalMessages: 0,
            totalReactions: 0,
            totalCommands: 0,
            favoriteCommand: '',
            lastActive: r.updated_at,
            activityScore: 0,
            breakdown: { music: 0, moderation: 0, utility: 0, fun: 0 }
        };
    });

    return { data, total: totalRow?.count || 0 };
}

// ---------------------------------------------------------------------------
// Session detail
// ---------------------------------------------------------------------------

export function getSessionById(sessionId: number): any | null {
    const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) as any;
    if (!row) return null;

    const attendance = db.prepare(
        `SELECT a.*, u.username, u.display_name
         FROM attendance_summary a
         LEFT JOIN users u ON u.id = a.user_id
         WHERE a.session_id = ?`
    ).all(sessionId);

    const participation = db.prepare(
        `SELECT p.*, u.username, u.display_name
         FROM participation_summary p
         LEFT JOIN users u ON u.id = p.user_id
         WHERE p.session_id = ?`
    ).all(sessionId);

    const voiceEvents = db.prepare(
        `SELECT v.*, u.username, u.display_name
         FROM voice_events v
         LEFT JOIN users u ON u.id = v.user_id
         WHERE v.session_id = ?
         ORDER BY v.join_time`
    ).all(sessionId);

    const voiceRow = db.prepare(
        `SELECT COALESCE(SUM(ROUND((julianday(leave_time) - julianday(join_time)) * 1440)), 0) as total
         FROM voice_events WHERE session_id = ? AND leave_time IS NOT NULL`
    ).get(sessionId) as { total: number } | undefined;

    return {
        id: `sess_${row.id}`,
        channelId: row.channel_id,
        triggeredBy: row.triggered_by,
        startedAt: row.start_time,
        endedAt: row.end_time,
        autoEndAt: row.auto_end_at,
        durationMinutes: row.duration_minutes,
        status: row.end_time ? 'ended' : 'active',
        totalVoiceMinutes: Math.round(voiceRow?.total || 0),
        attendance,
        participation,
        voiceEvents,
    };
}
