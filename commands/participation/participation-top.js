// commands/participation/participation-top.js
//
// Top N participants by score for a session.
//
// Usage:
//   !participation-top [--id <n>] [--channel <#ch>] [--latest] [--limit <n>]
// ---------------------------------------------------------------------------

const participationSummaryModel = require('../../models/participationSummaryModel');
const { resolveSessionContext } = require('../../utils/commandResolver');
const { checkInstructor } = require('../../utils/permissions');
const logger = require('../../utils/logger');

const DEFAULT_LIMIT = 5;
const MAX_LIMIT     = 15;

const MEDAL = ['🥇', '🥈', '🥉'];

module.exports = {
    name: 'participation-top',
    description: 'Show top N participants by score for a session.',
    usage: '!participation-top [--id <n>] [--channel <#ch>] [--latest] [--limit <n>]',
    options: [
        { name: 'id',      type: 'number',  required: false, description: 'Session ID' },
        { name: 'channel', type: 'channel', required: false, description: 'Voice channel' },
        { name: 'latest',  type: 'boolean', required: false, description: 'Use most recent session' },
        { name: 'limit',   type: 'number',  required: false, description: `Number of results (default: ${DEFAULT_LIMIT}, max: ${MAX_LIMIT})` }
    ],

    execute(message, _args, { parsed } = {}) {
        try {
            if (!message.guild) return message.reply('❌ Server only.');

            const perm = checkInstructor(message.member);
            if (!perm.allowed) return message.reply(perm.message);

            const options = parsed?.options || {};
            const ctx     = resolveSessionContext(message, options);

            if (ctx.error) return message.reply(ctx.error);

            const rawLimit = options.limit !== undefined ? Number(options.limit) : DEFAULT_LIMIT;
            const limit    = isNaN(rawLimit) || rawLimit < 1
                ? DEFAULT_LIMIT
                : Math.min(rawLimit, MAX_LIMIT);

            const records = participationSummaryModel.getBySession(ctx.sessionId);

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
            output    += lines.join('\n');

            return message.reply(output);
        } catch (error) {
            logger.error(`participation-top command error: ${error.message}`, { error: error.message });
            return message.reply('❌ An error occurred while fetching top participants.');
        }
    }
};
