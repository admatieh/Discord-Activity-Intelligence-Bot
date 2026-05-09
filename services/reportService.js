// services/reportService.js
//
// Generates real session reports from DB data.
// Never invents fake data — always computes from voice_events,
// attendance_summary, participation_summary, activity_events.
// ---------------------------------------------------------------------------

const db = require('../database/db');
const logger = require('../utils/logger');
const sessionModel = require('../models/sessionModel');
const attendanceSummaryModel = require('../models/attendanceSummaryModel');
const participationSummaryModel = require('../models/participationSummaryModel');

// ---------------------------------------------------------------------------
// generateSessionReport
// ---------------------------------------------------------------------------

/**
 * Generate and persist a report for a session.
 * @param {number} sessionId
 * @param {{ requestedBy? }} options
 * @returns {{ ok, report, error }}
 */
async function generateSessionReport(sessionId, options = {}) {
    try {
        const session = sessionModel.getSessionById(sessionId);
        if (!session) {
            return { ok: false, error: `Session #${sessionId} not found` };
        }

        // ---- Basic session metadata ----
        const startTime = new Date(session.start_time);
        const endTime = session.end_time ? new Date(session.end_time) : null;
        const durationMs = endTime ? endTime - startTime : Date.now() - startTime.getTime();
        const durationMinutes = Math.round(durationMs / 60_000);

        // ---- Attendance summary ----
        const attendanceRecords = attendanceSummaryModel.getBySession(sessionId);

        // ---- Participation summary ----
        const participationRecords = participationSummaryModel.getBySession(sessionId);

        // ---- Voice events (raw timeline) ----
        const voiceEvents = db.prepare(
            `SELECT * FROM voice_events WHERE session_id = ? ORDER BY join_time ASC`
        ).all(sessionId);

        // ---- Activity events ----
        const activityEvents = db.prepare(
            `SELECT * FROM activity_events WHERE session_id = ? ORDER BY created_at ASC`
        ).all(sessionId);

        // ---- Compute participants ----
        let participants = [];

        if (attendanceRecords.length > 0) {
            // Use finalized attendance summary
            participants = attendanceRecords.map(r => {
                const participation = participationRecords.find(p => p.user_id === r.user_id);
                const voiceMinutes = Math.round(r.total_time_seconds / 60);
                return {
                    userId: r.user_id,
                    status: r.status,
                    voiceMinutes,
                    firstJoinTime: r.first_join_time,
                    lastLeaveTime: r.last_leave_time,
                    participationScore: participation?.score ?? null,
                    participationLabel: participation?.label ?? null
                };
            });
        } else {
            // Fallback: compute from voice_events directly
            const userMap = new Map();
            for (const ev of voiceEvents) {
                if (!userMap.has(ev.user_id)) {
                    userMap.set(ev.user_id, { userId: ev.user_id, totalMs: 0, firstJoin: ev.join_time, lastLeave: null });
                }
                const u = userMap.get(ev.user_id);
                if (ev.leave_time) {
                    u.totalMs += new Date(ev.leave_time) - new Date(ev.join_time);
                    u.lastLeave = ev.leave_time;
                } else {
                    // Still in session or left without event
                    u.totalMs += Date.now() - new Date(ev.join_time).getTime();
                }
            }
            participants = [...userMap.values()].map(u => ({
                userId: u.userId,
                status: null,
                voiceMinutes: Math.round(u.totalMs / 60_000),
                firstJoinTime: u.firstJoin,
                lastLeaveTime: u.lastLeave,
                participationScore: null,
                participationLabel: null
            }));
        }

        // Sort by voice minutes descending
        participants.sort((a, b) => b.voiceMinutes - a.voiceMinutes);

        // ---- Attendance counts ----
        const counts = {
            ON_TIME: attendanceRecords.filter(r => r.status === 'ON_TIME').length,
            LATE: attendanceRecords.filter(r => r.status === 'LATE').length,
            LEFT_EARLY: attendanceRecords.filter(r => r.status === 'LEFT_EARLY').length,
            ABSENT: attendanceRecords.filter(r => r.status === 'ABSENT').length
        };

        // ---- Top / Low participants ----
        const topParticipants = participants.slice(0, 5);
        const lowParticipants = participants
            .filter(p => p.voiceMinutes < (durationMinutes * 0.3))
            .slice(0, 5);

        // ---- Late joiners ----
        const gracePeriodMs = 5 * 60_000;
        const lateJoiners = voiceEvents
            .filter(ev => {
                const joinMs = new Date(ev.join_time) - startTime;
                return joinMs > gracePeriodMs;
            })
            .map(ev => ({
                userId: ev.user_id,
                joinedAfterMs: Math.round((new Date(ev.join_time) - startTime) / 1000),
                joinedAfterMinutes: Math.round((new Date(ev.join_time) - startTime) / 60_000)
            }));

        // ---- Early leavers ----
        const earlyLeaveThresholdMs = durationMs * 0.7;
        const earlyLeavers = voiceEvents
            .filter(ev => {
                if (!ev.leave_time || !endTime) return false;
                const sessionRemainingMs = endTime - new Date(ev.leave_time);
                return sessionRemainingMs > (durationMs * 0.3);
            })
            .map(ev => ({
                userId: ev.user_id,
                leftAt: ev.leave_time,
                minutesBeforeEnd: Math.round((endTime - new Date(ev.leave_time)) / 60_000)
            }));

        // ---- Message/reaction counts from activity ----
        const messageCounts = activityEvents.filter(e => e.type === 'MESSAGE_CREATE').length;
        const reactionCounts = activityEvents.filter(e => e.type === 'REACTION_ADD').length;

        // ---- Build report object ----
        const report = {
            sessionId: session.id,
            title: session.title || `Session #${session.id}`,
            guildId: session.guild_id || null,
            voiceChannelId: session.voice_channel_id || session.channel_id,
            textChannelId: session.text_channel_id || null,
            channelId: session.channel_id,
            triggeredBy: session.triggered_by,
            source: session.source || 'command',
            startTime: session.start_time,
            endTime: session.end_time || null,
            durationMinutes,
            status: session.end_time ? 'ended' : 'active',
            totalParticipants: participants.length,
            attendanceCounts: counts,
            participants,
            topParticipants,
            lowParticipants,
            lateJoiners: [...new Map(lateJoiners.map(l => [l.userId, l])).values()],
            earlyLeavers: [...new Map(earlyLeavers.map(l => [l.userId, l])).values()],
            messageCounts,
            reactionCounts,
            voiceEventCount: voiceEvents.length,
            timeline: voiceEvents.map(ev => ({
                userId: ev.user_id,
                joinTime: ev.join_time,
                leaveTime: ev.leave_time || null,
                durationMinutes: ev.leave_time
                    ? Math.round((new Date(ev.leave_time) - new Date(ev.join_time)) / 60_000)
                    : null
            })),
            generatedAt: new Date().toISOString(),
            generatedBy: options.requestedBy || 'system'
        };

        // ---- Persist to session_reports ----
        try {
            db.prepare(`
                INSERT OR REPLACE INTO session_reports
                    (session_id, summary_json, generated_at, generated_by, status)
                VALUES (?, ?, datetime('now'), ?, 'generated')
            `).run(sessionId, JSON.stringify(report), options.requestedBy || 'system');
        } catch (persistErr) {
            logger.warn(`[ReportService] Could not persist report: ${persistErr.message}`);
        }

        // Write activity event
        try {
            db.prepare(`
                INSERT INTO activity_events
                    (type, user_id, channel_id, session_id, metadata, guild_id, human_label, severity, created_at)
                VALUES ('REPORT_GENERATED', 'system', NULL, ?, NULL, ?, ?, 'info', datetime('now'))
            `).run(sessionId, session.guild_id || null, `Report generated for session #${sessionId}`);
        } catch {}

        logger.log(`[ReportService] Report generated for session #${sessionId}.`);

        return { ok: true, report };
    } catch (err) {
        logger.error(`[ReportService] generateSessionReport error: ${err.message}`);
        return { ok: false, error: err.message };
    }
}

// ---------------------------------------------------------------------------
// getSessionReport
// ---------------------------------------------------------------------------

function getSessionReport(sessionId) {
    try {
        const row = db.prepare(
            `SELECT * FROM session_reports WHERE session_id = ? ORDER BY generated_at DESC LIMIT 1`
        ).get(sessionId);

        if (!row) return { ok: false, error: 'No report found for this session' };

        let report = null;
        try { report = JSON.parse(row.summary_json); } catch {}

        return { ok: true, report, generatedAt: row.generated_at };
    } catch (err) {
        logger.error(`[ReportService] getSessionReport error: ${err.message}`);
        return { ok: false, error: err.message };
    }
}

// ---------------------------------------------------------------------------
// listSessionReports
// ---------------------------------------------------------------------------

function listSessionReports(filters = {}) {
    try {
        let query = `
            SELECT sr.id, sr.session_id, sr.generated_at, sr.generated_by, sr.status,
                   sr.posted_to_channel_id, sr.discord_message_id,
                   s.title, s.start_time, s.end_time, s.channel_id, s.guild_id
            FROM session_reports sr
            LEFT JOIN sessions s ON s.id = sr.session_id
            WHERE 1=1
        `;
        const params = [];

        if (filters.sessionId) { query += ' AND sr.session_id = ?'; params.push(filters.sessionId); }
        if (filters.guildId) { query += ' AND s.guild_id = ?'; params.push(filters.guildId); }

        query += ' ORDER BY sr.generated_at DESC';
        if (filters.limit) { query += ' LIMIT ?'; params.push(Number(filters.limit)); }
        else { query += ' LIMIT 50'; }

        return db.prepare(query).all(...params);
    } catch (err) {
        logger.error(`[ReportService] listSessionReports error: ${err.message}`);
        return [];
    }
}

// ---------------------------------------------------------------------------
// formatReportForDiscord
// ---------------------------------------------------------------------------

function formatReportForDiscord(report) {
    if (!report) return '❌ No report data.';

    let text = `📊 **Session Report** — ${report.title}\n`;
    text += `**Duration:** ${report.durationMinutes} min | **Status:** ${report.status}\n`;
    text += `**Total Participants:** ${report.totalParticipants}\n\n`;

    if (report.attendanceCounts) {
        const c = report.attendanceCounts;
        text += `✅ On Time: ${c.ON_TIME} | ⏰ Late: ${c.LATE} | 🚪 Left Early: ${c.LEFT_EARLY} | ❌ Absent: ${c.ABSENT}\n\n`;
    }

    if (report.topParticipants && report.topParticipants.length > 0) {
        text += `🏆 **Top Participants:**\n`;
        for (const p of report.topParticipants) {
            text += `• <@${p.userId}> — ${p.voiceMinutes} min${p.participationLabel ? ` (${p.participationLabel})` : ''}\n`;
        }
        text += '\n';
    }

    if (report.lateJoiners && report.lateJoiners.length > 0) {
        text += `⏰ **Late Joiners:** ${report.lateJoiners.length}\n`;
    }

    text += `_Generated at ${new Date(report.generatedAt).toLocaleString()}_`;

    return text.trim();
}

module.exports = {
    generateSessionReport,
    getSessionReport,
    listSessionReports,
    formatReportForDiscord
};
