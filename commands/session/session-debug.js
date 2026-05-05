// commands/session/session-debug.js
//
// Low-level debug dump of a session — raw DB fields + integrity metrics.
// Instructor/admin only.
//
// Usage:
//   !session-debug --id <sessionId>
//   !session-debug --channel <#ch>
//   !session-debug --latest
// ---------------------------------------------------------------------------

const sessionModel       = require('../../models/sessionModel');
const voiceActivityModel = require('../../models/voiceActivityModel');
const attendanceModel    = require('../../models/attendanceModel');
const { resolveSessionContext } = require('../../utils/commandResolver');
const { checkInstructor } = require('../../utils/permissions');
const logger = require('../../utils/logger');

module.exports = {
    name: 'session-debug',
    description: 'Raw debug dump of a session (instructor only).',
    usage: '!session-debug [--id <n>] [--channel <#ch>] [--latest]',
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

            const session = sessionModel.getSessionById(ctx.sessionId);
            if (!session) return message.reply(`❌ Session #${ctx.sessionId} not found in DB.`);

            const intervals     = voiceActivityModel.getIntervalsBySession(ctx.sessionId);
            const openIntervals = intervals.filter(i => i.end_time === null || i.end_time === undefined);
            const attendeeCount = attendanceModel.getAttendeeCount(ctx.sessionId);

            const lines = [
                `🔧 **SESSION DEBUG — #${session.id}**`,
                `\`\`\``,
                `id             : ${session.id}`,
                `channel_id     : ${session.channel_id}`,
                `triggered_by   : ${session.triggered_by}`,
                `start_time     : ${session.start_time || 'NULL'}`,
                `end_time       : ${session.end_time   || 'NULL'}`,
                `duration_min   : ${session.duration_minutes ?? 'NULL'}`,
                `auto_end_at    : ${session.auto_end_at  || 'NULL'}`,
                ``,
                `attendees      : ${attendeeCount}`,
                `total_intervals: ${intervals.length}`,
                `open_intervals : ${openIntervals.length}`,
                `\`\`\``
            ];

            if (openIntervals.length > 0) {
                lines.push(`⚠️ **Warning:** ${openIntervals.length} unclosed voice interval(s) detected.`);
            }

            return message.reply(lines.join('\n'));
        } catch (error) {
            logger.error(`session-debug command error: ${error.message}`, { error: error.message });
            return message.reply('❌ An error occurred during session debug.');
        }
    }
};
