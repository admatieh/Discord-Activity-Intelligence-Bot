// dashboard/server/repositories/index.ts
import { db } from '../db';
import type { Session, LogEntry, UserStats, Command } from '@/lib/types'; // Using existing types for UI

export function getSessions(status?: string, limit = 10, offset = 0): { data: any[], total: number } {
    let where = '';
    let params: any[] = [];
    
    if (status === 'active') {
        where = 'WHERE end_time IS NULL';
    } else if (status === 'ended') {
        where = 'WHERE end_time IS NOT NULL';
    }

    const totalRow = db.prepare(`SELECT COUNT(*) as count FROM sessions \${where}`).get(...params) as { count: number };
    const rows = db.prepare(`SELECT * FROM sessions \${where} ORDER BY start_time DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);

    // Map to DTO
    const data = rows.map((r: any) => ({
        id: `sess_\${r.id}`,
        channelId: r.channel_id,
        channelName: 'Channel ' + r.channel_id, // We'd ideally join this or cache names
        guildName: 'Guild',
        startedAt: r.start_time,
        endedAt: r.end_time,
        duration: r.duration_minutes,
        status: r.end_time ? 'ended' : 'active',
        participantCount: (db.prepare('SELECT COUNT(DISTINCT user_id) as count FROM voice_events WHERE session_id = ?').get(r.id) as { count: number } | undefined)?.count || 0,
        totalMessages: 0,
        totalVoiceMinutes: 0,
        avgScore: 0
    }));

    return { data, total: totalRow.count };
}

export function getLogs(limit = 100): LogEntry[] {
    const rows = db.prepare('SELECT * FROM logs ORDER BY created_at DESC LIMIT ?').all(limit);
    return rows.map((r: any) => ({
        id: `log_\${r.id}`,
        timestamp: r.created_at,
        level: r.level,
        source: JSON.parse(r.context || '{}').source || 'system',
        message: r.message
    }));
}

export function getUsers(limit = 10, offset = 0): { data: any[], total: number } {
    const totalRow = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    const rows = db.prepare('SELECT * FROM users ORDER BY updated_at DESC LIMIT ? OFFSET ?').all(limit, offset);

    const data = rows.map((r: any) => ({
        id: r.id,
        username: r.username,
        discriminator: r.discriminator,
        totalCommands: 0,
        totalMessages: 0,
        totalVoiceMinutes: 0,
        totalReactions: 0,
        favoriteCommand: '',
        lastActive: r.updated_at,
        activityScore: 0,
        breakdown: { music: 0, moderation: 0, utility: 0, fun: 0 }
    }));

    return { data, total: totalRow.count };
}
