// commands/voice/voice-user.js
//
// Show all voice intervals for a specific user in a session.
//
// Usage:
//   !voice-user --user <@mention|id> [--id <n>] [--channel <#ch>] [--latest]
// ---------------------------------------------------------------------------

const voiceActivityModel = require('../../models/voiceActivityModel');
const { resolveSessionContext, resolveUserContext } = require('../../utils/commandResolver');
const { checkInstructor } = require('../../utils/permissions');
const logger = require('../../utils/logger');
const { COMMAND_LIMITS } = require('../../config/constants');

module.exports = {
    name: 'voice-user',
    description: "Show all voice intervals for a specific user in a session.",
    usage: '!voice-user --user <@mention|id> [--id <n>] [--channel <#ch>] [--latest]',
    options: [
        { name: 'user',    type: 'string',  required: true,  description: 'User mention or ID' },
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
            const userCtx = resolveUserContext(message, options);

            if (ctx.error)     return message.reply(ctx.error);
            if (userCtx.error) return message.reply(userCtx.error);

            const intervals = voiceActivityModel.getIntervalsBySessionAndUser(ctx.sessionId, userCtx.userId);

            if (!intervals || intervals.length === 0) {
                return message.reply(`⚠️ No voice intervals found for <@${userCtx.userId}> in Session #${ctx.sessionId}.`);
            }

            const limit     = COMMAND_LIMITS.DEFAULT;
            const rows      = intervals.slice(0, limit);
            const truncated = intervals.length > limit;

            let totalSec = 0;
            const lines = rows.map((iv, i) => {
                const start = iv.start_time ? iv.start_time.slice(11, 19) : '—';
                const end   = iv.end_time   ? iv.end_time.slice(11, 19)   : '⚠️ OPEN';
                const dur   = iv.end_time
                    ? Math.round((new Date(iv.end_time) - new Date(iv.start_time)) / 1000)
                    : null;
                if (dur !== null) totalSec += dur;
                const durStr = dur !== null ? `${dur}s` : '—';
                return `#${String(i + 1).padEnd(3)} ${start} → ${end}  (${durStr})`;
            });

            let output = `🎙️ **Voice Intervals — <@${userCtx.userId}> / Session #${ctx.sessionId}** (${intervals.length} segments)\n`;
            output    += `Total speaking: **${Math.round(totalSec / 60)} min ${totalSec % 60}s**\n`;
            output    += `\`\`\`\n${lines.join('\n')}\n\`\`\``;
            if (truncated) output += `\n_Showing ${limit} of ${intervals.length} intervals._`;

            return message.reply(output);
        } catch (error) {
            logger.error(`voice-user command error: ${error.message}`, { error: error.message });
            return message.reply('❌ An error occurred while fetching user voice intervals.');
        }
    }
};
