// commands/session/session-status.js
//
// Show detailed status for a resolved session.
//
// Usage:
//   !session-status                          → session in your voice channel
//   !session-status --id <sessionId>         → by ID
//   !session-status --channel <#ch>          → by channel
//   !session-status --latest                 → most recent session
// ---------------------------------------------------------------------------

const sessionService = require('../../modules/sessions/sessionService');
const { resolveSessionContext } = require('../../utils/commandResolver');
const { checkInstructor } = require('../../utils/permissions');
const logger = require('../../utils/logger');

module.exports = {
    name: 'session-status',
    description: 'Show detailed status for a session.',
    usage: '!session-status [--id <n>] [--channel <#ch>] [--latest]',
    options: [
        { name: 'id',      type: 'number',  required: false, description: 'Session ID' },
        { name: 'channel', type: 'channel', required: false, description: 'Voice channel' },
        { name: 'latest',  type: 'boolean', required: false, description: 'Use most recent session' }
    ],

    execute(message, _args, { parsed } = {}) {
        try {
            if (!message.guild) return message.reply('❌ Server only.');

            const perm = checkInstructor(message.member);
            if (!perm.allowed) return message.reply(perm.message);

            const options = parsed?.options || {};
            const ctx     = resolveSessionContext(message, options);

            if (ctx.error) return message.reply(ctx.error);

            const info = sessionService.getSessionInfo(ctx.sessionId);
            if (!info) return message.reply(`❌ Session #${ctx.sessionId} not found.`);

            const status    = info.end_time ? '🔴 Ended' : '🟢 Active';
            const started   = info.start_time ? info.start_time.replace('T', ' ').slice(0, 19) : '—';
            const ended     = info.end_time   ? info.end_time.replace('T', ' ').slice(0, 19)   : '—';
            const autoEnd   = info.auto_end_at ? info.auto_end_at.replace('T', ' ').slice(0, 19) : '—';

            const lines = [
                `📊 **Session #${info.id}** — ${status}`,
                ``,
                `📍 Channel:     ${info.channel_id}`,
                `👤 Started by:  ${info.triggered_by}`,
                `⏱️  Duration:    ${info.duration_minutes} min`,
                `🕐 Start:       ${started}`,
                `🕐 End:         ${ended}`,
                `⏰ Auto-end:    ${autoEnd}`,
                ``,
                `👥 Attendees:   ${info.attendeeCount}`,
                `🎙️  Voice events: ${info.eventCount}`
            ];

            return message.reply(lines.join('\n'));
        } catch (error) {
            logger.error(`session-status command error: ${error.message}`, { error: error.message });
            return message.reply('❌ An error occurred while fetching session status.');
        }
    }
};
