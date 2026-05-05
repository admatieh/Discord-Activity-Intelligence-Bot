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

module.exports = {
    name: 'session-info',
    category: 'session',
    aliases: ['info'],
    description: 'View details about sessions (all, active, or specific).',
    usage: '!session-info [--view all|open] [--id <sessionId>]',
    options: [
        { name: 'view', type: 'string', required: false, description: '"all" for all sessions, "open" for active sessions only' },
        { name: 'id', type: 'number', required: false, description: 'Specific session ID for detailed info' }
    ],
    execute(message, _args, { parsed } = {}) {
        try {
            if (!message.guild) {
                return message.reply('❌ Server only.');
            }

            const options = parsed?.options || {};

            // --view all
            if (options.view === 'all') {
                const sessions = sessionModel.getAllSessions();
                if (sessions.length === 0) {
                    return message.reply('📋 No sessions found.');
                }
                const lines = sessions.map(s => {
                    const status = s.end_time ? '🔴 Ended' : '🟢 Active';
                    return `**#${s.id}** | ${status} | Channel: ${s.channel_id} | Started: ${s.start_time}`;
                });
                return message.reply(`📋 **All Sessions (${sessions.length}):**\n${lines.join('\n')}`);
            }

            // --view open
            if (options.view === 'open') {
                const sessions = sessionModel.getActiveSessions();
                if (sessions.length === 0) {
                    return message.reply('📋 No active sessions.');
                }
                const lines = sessions.map(s =>
                    `**#${s.id}** | Channel: ${s.channel_id} | Started: ${s.start_time} | Auto-end: ${s.auto_end_at}`
                );
                return message.reply(`📋 **Active Sessions (${sessions.length}):**\n${lines.join('\n')}`);
            }

            // --id <sessionId>
            if (options.id !== undefined) {
                const sessionId = Number(options.id);
                if (isNaN(sessionId)) {
                    return message.reply('❌ Session ID must be a number.');
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

            return message.reply(
                'ℹ️ Usage: `!session-info --view all` | `!session-info --view open` | `!session-info --id <id>`'
            );
        } catch (error) {
            logger.error(`session-info command error: ${error.message}`, { error: error.message });
            return message.reply('❌ An error occurred while retrieving session info.');
        }
    }
};

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function replySessionDetail(message, sessionId) {
    const info = sessionService.getSessionInfo(sessionId);
    if (!info) {
        return message.reply('❌ Session not found.');
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
