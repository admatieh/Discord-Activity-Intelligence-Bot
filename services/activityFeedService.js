// services/activityFeedService.js
//
// Builds a unified, human-readable activity feed by combining:
//   - activity_events
//   - logs
//   - sessions (start/end events)
//   - scheduled_items (state changes)
//   - message_deliveries
// ---------------------------------------------------------------------------

const db = require('../database/db');
const logger = require('../utils/logger');

// ---------------------------------------------------------------------------
// Human-readable label builder
// ---------------------------------------------------------------------------

function buildLabel(row) {
    // If the row has a human_label already stored, use it
    if (row.human_label && row.human_label.trim().length > 0) {
        return row.human_label;
    }

    const type = row.type || row._source_type || '';

    switch (type) {
        case 'VOICE_JOIN':
            return `User joined voice channel`;
        case 'VOICE_LEAVE':
            return `User left voice channel`;
        case 'VOICE_MUTE':
            return `User muted`;
        case 'VOICE_UNMUTE':
            return `User unmuted`;
        case 'MESSAGE_CREATE':
            return `Message sent in channel`;
        case 'MESSAGE_REPLY':
            return `Reply sent in channel`;
        case 'REACTION_ADD':
            return `Reaction added`;
        case 'SESSION_STARTED':
            return `Recording session started`;
        case 'SESSION_ENDED':
            return `Recording session ended`;
        case 'SESSION_SCHEDULED':
            return `Session scheduled`;
        case 'MESSAGE_SCHEDULED':
            return `Message scheduled`;
        case 'MESSAGE_SENT':
            return `Message sent to channel`;
        case 'SCHEDULED_SESSION_STARTED':
            return `Scheduled session started`;
        case 'SCHEDULED_SESSION_FAILED':
            return `Scheduled session failed to start`;
        case 'SCHEDULED_MESSAGE_SENT':
            return `Scheduled message delivered`;
        case 'SCHEDULED_ITEM_CANCELLED':
            return `Scheduled item cancelled`;
        case 'REPORT_GENERATED':
            return `Session report generated`;
        default:
            return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    }
}

function getSeverity(type, level) {
    if (level === 'error') return 'error';
    if (level === 'warn') return 'warning';

    if (type && (
        type.includes('FAILED') ||
        type.includes('ERROR') ||
        type.includes('CRASH')
    )) return 'error';

    if (type && (
        type.includes('WARN') ||
        type.includes('CANCEL')
    )) return 'warning';

    return 'info';
}

// ---------------------------------------------------------------------------
// getActivityFeed
// ---------------------------------------------------------------------------

/**
 * Get unified activity feed entries.
 * @param {{ limit?, guildId?, sessionId?, type? }} filters
 * @returns {Array<{ id, timestamp, type, label, description, severity, guildId, channelId, sessionId, userId, metadata }>}
 */
function getActivityFeed(filters = {}) {
    const limit = Math.min(Number(filters.limit) || 100, 500);
    const entries = [];

    try {
        // ---- 1. activity_events ----
        let aeQuery = `
            SELECT id, type, user_id, channel_id, session_id, metadata, created_at,
                   guild_id, human_label, severity
            FROM activity_events
            WHERE 1=1
        `;
        const aeParams = [];

        if (filters.guildId) { aeQuery += ' AND (guild_id = ? OR guild_id IS NULL)'; aeParams.push(filters.guildId); }
        if (filters.sessionId) { aeQuery += ' AND session_id = ?'; aeParams.push(filters.sessionId); }
        if (filters.type) { aeQuery += ' AND type = ?'; aeParams.push(filters.type); }

        aeQuery += ` ORDER BY created_at DESC LIMIT ${limit}`;

        const activityRows = db.prepare(aeQuery).all(...aeParams);

        for (const row of activityRows) {
            let metadata = null;
            try { metadata = row.metadata ? JSON.parse(row.metadata) : null; } catch {}

            entries.push({
                id: `ae_${row.id}`,
                timestamp: row.created_at,
                type: row.type,
                label: buildLabel(row),
                description: row.human_label || buildLabel(row),
                severity: row.severity || getSeverity(row.type, null),
                guildId: row.guild_id || null,
                channelId: row.channel_id || null,
                sessionId: row.session_id || null,
                userId: row.user_id || null,
                source: 'activity',
                metadata
            });
        }
    } catch (err) {
        logger.error(`[ActivityFeed] activity_events query error: ${err.message}`);
    }

    // Only include logs if no sessionId/type filter (to avoid noise)
    if (!filters.sessionId && !filters.type) {
        try {
            let logQuery = `
                SELECT id, level, message, context, created_at,
                       source, event, guild_id, session_id, user_id, command, execution_id
                FROM logs
                WHERE level IN ('warn', 'error')
            `;
            const logParams = [];

            if (filters.guildId) { logQuery += ' AND (guild_id = ? OR guild_id IS NULL)'; logParams.push(filters.guildId); }

            logQuery += ` ORDER BY created_at DESC LIMIT ${Math.min(limit, 50)}`;

            const logRows = db.prepare(logQuery).all(...logParams);

            for (const row of logRows) {
                entries.push({
                    id: `log_${row.id}`,
                    timestamp: row.created_at,
                    type: `LOG_${(row.level || 'info').toUpperCase()}`,
                    label: row.message.slice(0, 120),
                    description: row.message,
                    severity: getSeverity(null, row.level),
                    guildId: row.guild_id || null,
                    channelId: null,
                    sessionId: row.session_id || null,
                    userId: row.user_id || null,
                    source: 'log',
                    metadata: null
                });
            }
        } catch (err) {
            logger.error(`[ActivityFeed] logs query error: ${err.message}`);
        }
    }

    // ---- Sort all entries by timestamp descending ----
    entries.sort((a, b) => {
        const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return tb - ta;
    });

    return entries.slice(0, limit);
}

// ---------------------------------------------------------------------------
// getRecentSessions (for activity page context)
// ---------------------------------------------------------------------------

function getRecentSessions(limit = 10) {
    try {
        return db.prepare(`
            SELECT id, channel_id, voice_channel_id, text_channel_id, guild_id,
                   title, triggered_by, source, start_time, end_time, duration_minutes,
                   auto_end_at, status
            FROM sessions
            ORDER BY start_time DESC
            LIMIT ?
        `).all(limit);
    } catch (err) {
        logger.error(`[ActivityFeed] getRecentSessions error: ${err.message}`);
        return [];
    }
}

module.exports = {
    getActivityFeed,
    getRecentSessions
};
