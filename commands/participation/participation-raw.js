// commands/participation/participation-raw.js
//
// Raw dump of all participation_summary rows for a session.
//
// Usage:
//   !participation-raw [--id <n>] [--channel <#ch>] [--latest]
// ---------------------------------------------------------------------------

const participationSummaryModel = require('../../models/participationSummaryModel');
const { resolveSessionContext } = require('../../utils/commandResolver');
const { checkInstructor } = require('../../utils/permissions');
const logger = require('../../utils/logger');
const { COMMAND_LIMITS } = require('../../config/constants');

module.exports = {
    name: 'participation-raw',
    description: 'Raw dump of all participation_summary rows for a session.',
    usage: '!participation-raw [--id <n>] [--channel <#ch>] [--latest] [--limit <n>]',
    options: [
        { name: 'id', type: 'number', required: false, description: 'Session ID' },
        { name: 'channel', type: 'channel', required: false, description: 'Voice channel' },
        { name: 'latest', type: 'boolean', required: false, description: 'Use most recent session' },
        { name: 'limit', type: 'number', required: false, description: `Number of results (default: ${COMMAND_LIMITS.MAX}, max: ${COMMAND_LIMITS.MAX})` }
    ],

    execute(message, _args, { parsed } = {}) {
        try {
            if (!message.guild) return message.reply('❌ Server only.');

            const perm = checkInstructor(message.member);
            if (!perm.allowed) return message.reply(perm.message);

            const options = parsed?.options || {};
            const ctx = resolveSessionContext(message, options);

            if (ctx.error) return message.reply(ctx.error);

            const rawLimit = parsed?.options?.limit;
            const limit = isNaN(rawLimit) || rawLimit < COMMAND_LIMITS.MIN
                ? COMMAND_LIMITS.MAX // raw default is higher typically, but let's cap at MAX
                : Math.min(rawLimit, COMMAND_LIMITS.MAX);

            const records = participationSummaryModel.getTop(ctx.sessionId, limit);

            if (!records || records.length === 0) {
                return message.reply(`⚠️ No participation data for Session #${ctx.sessionId}. Session may not be finalized.`);
            }

            const truncated = records.length >= limit && limit < COMMAND_LIMITS.MAX; // Simplification

            const header = `${'id'.padEnd(5)} ${'user_id'.padEnd(20)} ${'score'.padEnd(6)} ${'spk'.padEnd(5)} ${'int'.padEnd(5)} ${'att'.padEnd(5)} label`;
            const divider = '─'.repeat(header.length);

            const lines = records.map(r => {
                const id = String(r.id).padEnd(5);
                const uid = r.user_id.padEnd(20);
                const score = String(r.score).padEnd(6);
                const spk = String(r.speaking_score).padEnd(5);
                const intr = String(r.interaction_score).padEnd(5);
                const att = String(r.attendance_score).padEnd(5);
                return `${id} ${uid} ${score} ${spk} ${intr} ${att} ${r.label}`;
            });

            let output = `⚙️ **Raw Participation — Session #${ctx.sessionId}** (${records.length} total)\n`;
            output += `\`\`\`\n${header}\n${divider}\n${lines.join('\n')}\n\`\`\``;
            if (truncated) output += `\n_Showing ${limit} rows (sorted by score DESC)._`;

            return message.reply(output);
        } catch (error) {
            logger.error(`participation-raw command error: ${error.message}`, { error: error.message });
            return message.reply('❌ An error occurred while fetching raw participation data.');
        }
    }
};
