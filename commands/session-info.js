const { sendResponse } = require('utils/responseHelper');
const { requireInstructor } = require('../utils/permissions');
// commands/session-info.js
//
// Display session information with named arguments.
// Usage:
//   !session-info                   → show session for your voice channel
//   !session-info --view all        → list all sessions
//   !session-info --view open       → list active sessions
//   !session-info --id <sessionId>  → detailed info for a specific session
// ---------------------------------------------------------------------------

const sessionService = require('../modules/sessions/sessionService');
const sessionModel = require('../models/sessionModel');
const logger = require('../utils/logger');
const { sendSplitMessage } = require('../utils/messageSender');

module.exports = {
    name: 'session-info',
    category: 'session',
    requiredPermission: 'instructor',
    aliases: ['info'],
    description: 'View details about sessions (all, active, or specific).',
    usage: '!session-info [--view all|open] [--id <sessionId>]',
    options: [
        { name: 'view', type: 'string', required: false, description: '"all" for all sessions, "open" for active sessions only' },
        { name: 'id', type: 'number', required: false, description: 'Specific session ID for detailed info' },
        { name: 'private', type: 'boolean', required: false, description: 'Send the response privately by DM' },
        { name: 'quiet', type: 'boolean', required: false, description: 'Only send a short confirmation' },
        { name: 'silent', type: 'boolean', required: false, description: 'Do not send a public response' }
    ],
    async execute(message, _args, { parsed } = {}) {
        const permission = await requireInstructor(message);
        if (!permission.allowed) return message.reply(permission.message);

        try {
            if (!message.guild) {
                return sendResponse(message, '❌ Server only.', parsed?.options || {});
            }

            const options = parsed?.options || {};

            // --view all
            if (options.view === 'all') {
                const sessions = sessionModel.getAllSessions();
                if (sessions.length === 0) {
                    return sendResponse(message, '📋 No sessions found.', parsed?.options || {});
                }
                const lines = sessions.map(s => {
                    const status = s.end_time ? '🔴 Ended' : '🟢 Active';
                    return `**#${s.id}** | ${status} | Channel: ${s.channel_id} | Started: ${s.start_time}`;
                });

                return sendSplitMessage(message, `📋 **All Sessions (${sessions.length}):**`, lines);
            }

            // --view open
            if (options.view === 'open') {
                const sessions = sessionModel.getActiveSessions();
                if (sessions.length === 0) {
                    return sendResponse(message, '📋 No active sessions.', parsed?.options || {});
                }
                const lines = sessions.map(s =>
                    `**#${s.id}** | Channel: ${s.channel_id} | Started: ${s.start_time} | Auto-end: ${s.auto_end_at}`
                );

                return sendSplitMessage(message, `📋 **Active Sessions (${sessions.length}):**`, lines);
            }

            // --id <sessionId>
            if (options.id !== undefined) {
                const sessionId = Number(options.id);
                if (isNaN(sessionId)) {
                    return sendResponse(message, '❌ Session ID must be a number.', parsed?.options || {});
                }
                return replySessionDetail(message, sessionId);
            }

            // Default: show active session for user's current voice channel
            const voiceChannel = message.member.voice?.channel;
            if (voiceChannel && sessionService.isSessionActive(voiceChannel.id)) {
                const sid = sessionService.getSessionId(voiceChannel.id);
                if (sid) {
                    return replySessionDetail(message, sid);
                }
            }

            return sendResponse(message,
                'ℹ️ Usage: `!session-info --view all` | `!session-info --view open` | `!session-info --id <id>`'
                , parsed?.options || {});
        } catch (error) {
            logger.error(`session-info command error: ${error.message}`, { error: error.message });
            return sendResponse(message, '❌ An error occurred while retrieving session info.', parsed?.options || {});
        }
    }
};

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function replySessionDetail(message, sessionId) {
    const info = sessionService.getSessionInfo(sessionId);
    if (!info) {
        return sendResponse(message, '❌ Session not found.', parsed?.options || {});
    }
    const status = info.end_time ? '🔴 Ended' : '🟢 Active';
    const lines = [
        `**Session #${info.id}** ${status}`,
        `📍 Channel: ${info.channel_id}`,
        `👤 Triggered by: ${info.triggered_by}`,
        `🕐 Start: ${info.start_time}`,
        `🕐 End: ${info.end_time || 'N/A'}`,
        `⏱️ Duration: ${info.duration_minutes} min`,
        `👥 Attendees: ${info.attendeeCount}`,
        `🎙️ Voice events: ${info.eventCount}`
    ];
    return message.reply(lines.join('\n'));
}
