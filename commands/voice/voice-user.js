const { sendResponse } = require('../../utils/responseHelper');
const { requireInstructor } = require('../../utils/permissions');
// commands/voice/voice-user.js
//
// Show all voice intervals for a specific user in a session.
//
// Usage:
//   !voice-user --user <@mention|id> [--id <n>] [--channel <#ch>] [--latest]
// ---------------------------------------------------------------------------

const voiceActivityModel = require('../../models/voiceActivityModel');
const { resolveSessionContext, resolveUserContext } = require('../../utils/commandResolver');
const logger = require('../../utils/logger');
const { COMMAND_LIMITS } = require('../../config/constants');

module.exports = {
    name: 'voice-user',
    requiredPermission: 'instructor',
    description: "Show all voice intervals for a specific user in a session.",
    usage: '!voice-user --user <@mention|id> [--id <n>] [--channel <#ch>] [--latest]',
    options: [
{ name: 'user',    type: 'string',  required: true,  description: 'User mention or ID' },
        { name: 'id',      type: 'number',  required: false, description: 'Session ID' },
        { name: 'channel', type: 'channel', required: false, description: 'Voice channel' },
        { name: 'latest',  type: 'boolean', required: false, description: 'Use most recent session' },
        { name: 'private', type: 'boolean', required: false, description: 'Send the response privately by DM' },
        { name: 'quiet', type: 'boolean', required: false, description: 'Only send a short confirmation' },
        { name: 'silent', type: 'boolean', required: false, description: 'Do not send a public response' }
    ],

    async execute(message, _args, { parsed } = {}) {
        const permission = await requireInstructor(message);
        if (!permission.allowed) return message.reply(permission.message);

        try {
            if (!message.guild) return sendResponse(message, '❌ Server only.', parsed?.options || {});

            const options = parsed?.options || {};
            const ctx     = resolveSessionContext(message, options);
            const userCtx = resolveUserContext(message, options);

            if (ctx.error)     return sendResponse(message, ctx.error, parsed?.options || {});
            if (userCtx.error) return sendResponse(message, userCtx.error, parsed?.options || {});

            const intervals = voiceActivityModel.getIntervalsBySessionAndUser(ctx.sessionId, userCtx.userId);

            if (!intervals || intervals.length === 0) {
                return sendResponse(message, `⚠️ No voice intervals found for <@${userCtx.userId}> in Session #${ctx.sessionId}.`, parsed?.options || {});
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

            return sendResponse(message, output, parsed?.options || {});
        } catch (error) {
            logger.error(`voice-user command error: ${error.message}`, { error: error.message });
            return sendResponse(message, '❌ An error occurred while fetching user voice intervals.', parsed?.options || {});
        }
    }
};
