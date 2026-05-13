// services/sessionActionService.js
//
// Structured action wrappers for dashboard-driven session workflows.
// These call the existing sessionService internally without breaking
// existing Discord commands.
//
// Correct flow:
//   Dashboard -> API -> sessionActionService -> sessionService -> DB
// ---------------------------------------------------------------------------

const db = require('../database/db');
const logger = require('../utils/logger');
const sessionService = require('../modules/sessions/sessionService');
const sessionModel = require('../models/sessionModel');
const { eventBus, Events } = require('../core/eventBus');

let _client = null;
let _initialized = false;

function setClient(discordClient) {
    _client = discordClient;
}

function getClient() {
    return _client;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function writeActivityEvent({ type, human_label, guild_id, session_id, severity, metadata }) {
    try {
        db.prepare(`
            INSERT INTO activity_events
                (type, user_id, channel_id, session_id, metadata, guild_id, human_label, severity, created_at)
            VALUES (?, 'system', NULL, ?, ?, ?, ?, ?, datetime('now'))
        `).run(
            type,
            session_id || null,
            metadata ? JSON.stringify(metadata) : null,
            guild_id || null,
            human_label || null,
            severity || 'info'
        );
    } catch {}
}

function updateSessionMeta(sessionId, { guildId, voiceChannelId, textChannelId, title, source, trackingJson, optionsJson }) {
    try {
        // Build a dynamic update using only the columns that were added via migration
        const updates = [];
        const params = [];

        if (guildId !== undefined) { updates.push('guild_id = ?'); params.push(guildId); }
        if (voiceChannelId !== undefined) { updates.push('voice_channel_id = ?'); params.push(voiceChannelId); }
        if (textChannelId !== undefined) { updates.push('text_channel_id = ?'); params.push(textChannelId); }
        if (title !== undefined) { updates.push('title = ?'); params.push(title); }
        if (source !== undefined) { updates.push('source = ?'); params.push(source); }
        if (trackingJson !== undefined) { updates.push('tracking_json = ?'); params.push(trackingJson); }
        if (optionsJson !== undefined) { updates.push('options_json = ?'); params.push(optionsJson); }

        updates.push("updated_at = datetime('now')");

        if (updates.length > 0) {
            params.push(sessionId);
            db.prepare(`UPDATE sessions SET ${updates.join(', ')} WHERE id = ?`).run(...params);
        }
    } catch (err) {
        logger.warn(`[SessionAction] updateSessionMeta error (non-fatal): ${err.message}`);
    }
}

// ---------------------------------------------------------------------------
// startSessionFromAction
// ---------------------------------------------------------------------------

/**
 * Start a session from a structured dashboard action.
 * Does not break existing Discord command flow.
 *
 * @param {{ guildId, voiceChannelId, textChannelId, title, durationMinutes,
 *           tracking, options, requestedBy, source, sendDiscordAnnouncement }} input
 * @returns {{ ok, action, session, message, warning, executionId, error }}
 */
async function startSessionFromAction(input) {
    const action = 'session.start';
    const execId = `sess_${Date.now()}`;
    const {
        guildId,
        voiceChannelId,
        textChannelId,
        title,
        durationMinutes = 60,
        tracking = {},
        options = {},
        requestedBy = 'dashboard',
        source = 'dashboard',
        sendDiscordAnnouncement = false
    } = input || {};

    if (!voiceChannelId) {
        return { ok: false, action, error: 'voiceChannelId is required', executionId: execId };
    }
    if (!durationMinutes || durationMinutes <= 0 || durationMinutes > 1440) {
        return { ok: false, action, error: 'durationMinutes must be between 1 and 1440', executionId: execId };
    }

    // Guild/channel validation if client is ready
    const client = getClient();
    let guild = null;
    let voiceChannel = null;
    let warning = null;

    if (client && client.isReady() && guildId) {
        guild = client.guilds.cache.get(guildId);
        if (!guild) {
            return { ok: false, action, error: `Guild ${guildId} not found`, executionId: execId };
        }

        voiceChannel = guild.channels.cache.get(voiceChannelId);
        if (!voiceChannel) {
            return { ok: false, action, error: `Voice channel ${voiceChannelId} not found`, executionId: execId };
        }

        // Empty channel warning (don't block start)
        const humanCount = voiceChannel.members ? voiceChannel.members.filter(m => !m.user.bot).size : 0;
        if (humanCount === 0) {
            warning = 'No members currently in voice channel. Tracking will start when they join.';
        }
    }

    // Delegate to core session service
    const result = sessionService.startSession(voiceChannelId, requestedBy, { durationMinutes });

    if (!result.success) {
        return {
            ok: false,
            action,
            error: result.message,
            executionId: execId
        };
    }

    const sessionId = result.sessionId;

    // Store extended metadata
    updateSessionMeta(sessionId, {
        guildId,
        voiceChannelId,
        textChannelId: textChannelId || null,
        title: title || null,
        source,
        trackingJson: Object.keys(tracking).length > 0 ? JSON.stringify(tracking) : null,
        optionsJson: Object.keys(options).length > 0 ? JSON.stringify(options) : null
    });

    // Bootstrap members already in voice
    if (voiceChannel) {
        sessionService.bootstrapChannelUsers(voiceChannel, sessionId);
        sessionService.ensureChannelState(voiceChannel);
    }

    // Get initial participants
    const initialParticipants = voiceChannel
        ? [...(voiceChannel.members || new Map()).values()]
            .filter(m => !m.user.bot)
            .map(m => ({ id: m.id, username: m.user.username, displayName: m.displayName }))
        : [];

    // Compute autoEndAt
    const autoEndAt = new Date(Date.now() + durationMinutes * 60_000).toISOString();

    // Optional Discord announcement
    if (sendDiscordAnnouncement && textChannelId && client && client.isReady()) {
        try {
            const textChannel = guild?.channels?.cache?.get(textChannelId);
            if (textChannel && textChannel.isTextBased()) {
                await textChannel.send(
                    `📋 **Session started** — ${title || 'Recording session'} in <#${voiceChannelId}> (${durationMinutes} min). Tracking is live.`
                );
            }
        } catch (announceErr) {
            logger.warn(`[SessionAction] Announcement failed: ${announceErr.message}`);
        }
    }

    // Write activity
    writeActivityEvent({
        type: 'SESSION_STARTED',
        human_label: `Session "${title || 'Untitled'}" started in voice channel`,
        guild_id: guildId,
        session_id: sessionId,
        severity: 'info',
        metadata: { sessionId, voiceChannelId, requestedBy, source, durationMinutes }
    });

    logger.log(`[SessionAction] Session #${sessionId} started from dashboard action.`);

    return {
        ok: true,
        action,
        message: result.message,
        warning: warning || null,
        session: {
            id: sessionId,
            title: title || null,
            guildId: guildId || null,
            voiceChannelId,
            textChannelId: textChannelId || null,
            startedAt: new Date().toISOString(),
            autoEndAt,
            durationMinutes,
            initialParticipants,
            status: 'active',
            source
        },
        executionId: execId
    };
}

// ---------------------------------------------------------------------------
// endSessionFromAction
// ---------------------------------------------------------------------------

/**
 * End a session via dashboard action.
 */
async function endSessionFromAction({ sessionId, voiceChannelId, requestedBy, reason }) {
    const action = 'session.end';
    const execId = `end_${Date.now()}`;

    let result;
    if (sessionId) {
        result = sessionService.endSessionById(Number(sessionId), reason || 'Dashboard end');
    } else if (voiceChannelId) {
        result = sessionService.endSession(voiceChannelId);
    } else {
        result = sessionService.endAllSessions();
    }

    if (result.success) {
        const sid = sessionId || result.sessionId;

        // Store ended_reason
        if (sid) {
            try {
                db.prepare(`UPDATE sessions SET ended_reason = ?, updated_at = datetime('now') WHERE id = ?`)
                    .run(reason || 'Dashboard end', sid);
            } catch {}
        }

        writeActivityEvent({
            type: 'SESSION_ENDED',
            human_label: `Session ended${reason ? `: ${reason}` : ''}`,
            guild_id: null,
            session_id: sid || null,
            severity: 'info',
            metadata: { sessionId: sid, requestedBy, reason }
        });

        // Check for auto-report option
        let reportGenerated = false;
        let reportId = null;
        let reportError = null;

        if (sid) {
            const session = sessionModel.getSessionById(sid);
            let options = {};
            try {
                if (session?.options_json) options = JSON.parse(session.options_json);
            } catch {}

            if (options.generateReport) {
                try {
                    // 1. Manually finalize attendance so the report has data
                    const attendanceService = require('../modules/attendance/attendanceService');
                    attendanceService.finalizeSessionAttendance(sid);

                    // 2. Generate report
                    const reportService = require('./reportService');
                    const rptResult = await reportService.generateSessionReport(sid, {
                        requestedBy: requestedBy || 'dashboard',
                        skipIfExists: false // Force update since we just ended it
                    });

                    if (rptResult.ok) {
                        reportGenerated = true;
                        reportId = rptResult.report?.id;
                    } else {
                        reportError = rptResult.error;
                    }
                } catch (err) {
                    reportError = err.message;
                    logger.error(`[SessionAction] Manual auto-report failed: ${err.message}`);
                }
            }
        }

        return {
            ok: true,
            action,
            message: result.message,
            executionId: execId,
            sessionId: sid,
            reportGenerated,
            reportId,
            reportError
        };
    }

    return {
        ok: false,
        action,
        message: result.message,
        executionId: execId
    };
}

// ---------------------------------------------------------------------------
// generateReportFromAction
// ---------------------------------------------------------------------------

/**
 * Generate a report for a completed or active session.
 */
async function generateReportFromAction({ sessionId, requestedBy, postToChannelId }) {
    const action = 'session.report';
    const execId = `rpt_${Date.now()}`;

    if (!sessionId) {
        return { ok: false, action, error: 'sessionId is required', executionId: execId };
    }

    const reportService = require('./reportService');
    const result = await reportService.generateSessionReport(Number(sessionId), { requestedBy });

    if (!result.ok) {
        return { ok: false, action, error: result.error, executionId: execId };
    }

    // Post to Discord if requested
    if (postToChannelId && result.report) {
        const client = getClient();
        if (client && client.isReady()) {
            try {
                const guildId = result.report.guildId;
                let channel = null;
                if (guildId) {
                    channel = client.guilds.cache.get(guildId)?.channels?.cache?.get(postToChannelId);
                } else {
                    for (const [, g] of client.guilds.cache) {
                        const ch = g.channels.cache.get(postToChannelId);
                        if (ch) { channel = ch; break; }
                    }
                }
                if (channel && channel.isTextBased()) {
                    const text = reportService.formatReportForDiscord(result.report);
                    const discordMsg = await channel.send(text.slice(0, 2000));

                    // Update record
                    db.prepare(
                        `UPDATE session_reports SET posted_to_channel_id = ?, discord_message_id = ? WHERE session_id = ? ORDER BY id DESC LIMIT 1`
                    ).run(postToChannelId, discordMsg.id, sessionId);
                }
            } catch (postErr) {
                logger.warn(`[SessionAction] Report post failed: ${postErr.message}`);
            }
        }
    }

    return {
        ok: true,
        action,
        message: `Report generated for session #${sessionId}.`,
        report: result.report,
        executionId: execId
    };
}

// ---------------------------------------------------------------------------
// Utility: refreshSessionState
// ---------------------------------------------------------------------------

/**
 * Sync current voice members for an active session.
 */
function syncVoiceMembers({ guildId, voiceChannelId, sessionId }) {
    const client = getClient();
    if (!client || !client.isReady()) {
        return { ok: false, error: 'Discord client not ready' };
    }
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return { ok: false, error: 'Guild not found' };

    const channel = guild.channels.cache.get(voiceChannelId);
    if (!channel) return { ok: false, error: 'Voice channel not found' };

    const members = channel.members
        ? [...channel.members.values()]
            .filter(m => !m.user.bot)
            .map(m => ({ id: m.id, username: m.user.username, displayName: m.displayName }))
        : [];

    if (sessionId) {
        sessionService.bootstrapChannelUsers(channel, Number(sessionId));
    }

    return { ok: true, members, memberCount: members.length };
}

function registerListeners() {
    if (_initialized) return;
    _initialized = true;

    eventBus.on(Events.ATTENDANCE_FINALIZED, async ({ sessionId }) => {
        try {
            const session = sessionModel.getSessionById(sessionId);
            if (!session) return;

            let options = {};
            try {
                if (session.options_json) {
                    options = JSON.parse(session.options_json);
                }
            } catch (err) {
                logger.warn(`[SessionAction] Failed to parse options for session #${sessionId}: ${err.message}`);
            }

            if (options.generateReport) {
                logger.log(`[SessionAction] Auto-generating report for session #${sessionId} (generateReport option enabled).`);
                const reportService = require('./reportService');
                const result = await reportService.generateSessionReport(sessionId, {
                    requestedBy: 'system_auto',
                    skipIfExists: true
                });

                if (result.ok && !result.skipped) {
                    logger.log(`[SessionAction] Auto-report generated for session #${sessionId}.`);
                }
            }
        } catch (error) {
            logger.error(`[SessionAction] Auto-report listener error for session #${sessionId}: ${error.message}`);
        }
    });

    logger.log('[SessionAction] Listeners registered.');
}

module.exports = {
    setClient,
    registerListeners,
    startSessionFromAction,
    endSessionFromAction,
    generateReportFromAction,
    syncVoiceMembers
};
