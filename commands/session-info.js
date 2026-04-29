// commands/session-info.js
const sessionManager = require('../services/sessionManager');
const sessionModel = require('../models/sessionModel');

module.exports = {
    name: 'session-info',
    execute(message, args) {
        if (!message.guild) {
            return message.reply('❌ Server only.');
        }

        const sub = (args && args.length > 0) ? args[0].toLowerCase() : '';

        // !session-info all — list all sessions
        if (sub === 'all') {
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

        // !session-info open — list active sessions
        if (sub === 'open') {
            const sessions = sessionModel.getActiveSessions();
            if (sessions.length === 0) {
                return message.reply('📋 No active sessions.');
            }
            const lines = sessions.map(s =>
                `**#${s.id}** | Channel: ${s.channel_id} | Started: ${s.start_time} | Auto-end: ${s.auto_end_at}`
            );
            return message.reply(`📋 **Active Sessions (${sessions.length}):**\n${lines.join('\n')}`);
        }

        // !session-info <sessionId> — detailed info
        const sessionId = parseInt(sub, 10);
        if (!isNaN(sessionId)) {
            const info = sessionManager.getSessionInfo(sessionId);
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

        // No args — show active session for user's channel
        const voiceChannel = message.member.voice?.channel;
        if (voiceChannel && sessionManager.isSessionActive(voiceChannel.id)) {
            const sid = sessionManager.getSessionId(voiceChannel.id);
            const info = sessionManager.getSessionInfo(sid);
            if (info) {
                const lines = [
                    `**Session #${info.id}** 🟢 Active`,
                    `📍 Channel: ${info.channel_id}`,
                    `👤 Triggered by: ${info.triggered_by}`,
                    `🕐 Start: ${info.start_time}`,
                    `⏱️ Duration: ${info.duration_minutes} min`,
                    `👥 Attendees: ${info.attendeeCount}`,
                    `🎙️ Voice events: ${info.eventCount}`
                ];
                return message.reply(lines.join('\n'));
            }
        }

        return message.reply('ℹ️ Usage: `!session-info all` | `!session-info open` | `!session-info <id>`');
    }
};
