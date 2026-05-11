const { requireInstructor } = require('../../utils/permissions');
// commands/participation/participation-top.js
//
// Top N participants by score for a session.
//
// Usage:
//   !participation-top [--id <n>] [--channel <#ch>] [--latest] [--limit <n>]
// ---------------------------------------------------------------------------

const participationSummaryModel = require('../../models/participationSummaryModel');
const { resolveSessionContext } = require('../../utils/commandResolver');
const logger = require('../../utils/logger');
const { COMMAND_LIMITS } = require('../../config/constants');

const MEDAL = ['🥇', '🥈', '🥉'];

module.exports = {
    name: 'participation-top',
    requiredPermission: 'instructor',
    description: 'Show top N participants by score for a session.',
    usage: '!participation-top [--id <n>] [--channel <#ch>] [--latest] [--limit <n>]',
    options: [
        { name: 'id', type: 'number', required: false, description: 'Session ID' },
        { name: 'channel', type: 'channel', required: false, description: 'Voice channel' },
        { name: 'latest', type: 'boolean', required: false, description: 'Use most recent session' },
        { name: 'limit', type: 'number', required: false, description: `Number of results (default: ${COMMAND_LIMITS.DEFAULT}, max: ${COMMAND_LIMITS.MAX})` }
    ],

    async execute(message, _args, { parsed } = {}) {
        const permission = await requireInstructor(message);
        if (!permission.allowed) return message.reply(permission.message);

        try {
            if (!message.guild) return message.reply('❌ Server only.');

            const options = parsed?.options || {};
            const ctx = resolveSessionContext(message, options);

            if (ctx.error) return message.reply(ctx.error);

            const rawLimit = parsed?.options?.limit;
            const limit = isNaN(rawLimit) || rawLimit < COMMAND_LIMITS.MIN
                ? COMMAND_LIMITS.DEFAULT
                : Math.min(rawLimit, COMMAND_LIMITS.MAX);

            const records = participationSummaryModel.getTop(ctx.sessionId, limit);

            if (!records || records.length === 0) {
                return message.reply(`⚠️ No participation data for Session #${ctx.sessionId}. Session may not be finalized.`);
            }

            const sorted = [...records].sort((a, b) => b.score - a.score).slice(0, limit);

            const lines = sorted.map((r, i) => {
                const medal = MEDAL[i] || `${i + 1}.`;
                const label = r.label.replace('_', ' ');
                return `${medal}  <@${r.user_id}>  —  **${r.score}** pts  _(${label})_`;
            });

            let output = `🏆 **Top ${limit} — Session #${ctx.sessionId} Participation** (${records.length} total)\n`;
            output += lines.join('\n');

            return message.reply(output);
        } catch (error) {
            logger.error(`participation-top command error: ${error.message}`, { error: error.message });
            return message.reply('❌ An error occurred while fetching top participants.');
        }
    }
};
