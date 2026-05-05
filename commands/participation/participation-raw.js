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

const MAX_ROWS = 15;

module.exports = {
    name: 'participation-raw',
    description: 'Raw dump of all participation_summary rows for a session.',
    usage: '!participation-raw [--id <n>] [--channel <#ch>] [--latest]',
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

            const records = participationSummaryModel.getBySession(ctx.sessionId);

            if (!records || records.length === 0) {
                return message.reply(`⚠️ No participation data for Session #${ctx.sessionId}.`);
            }

            // Sort by score DESC for consistency
            const sorted    = [...records].sort((a, b) => b.score - a.score);
            const rows       = sorted.slice(0, MAX_ROWS);
            const truncated  = sorted.length > MAX_ROWS;

            const header  = `${'id'.padEnd(5)} ${'user_id'.padEnd(20)} ${'score'.padEnd(6)} ${'spk'.padEnd(5)} ${'int'.padEnd(5)} ${'att'.padEnd(5)} label`;
            const divider = '─'.repeat(header.length);

            const lines = rows.map(r => {
                const id    = String(r.id).padEnd(5);
                const uid   = r.user_id.padEnd(20);
                const score = String(r.score).padEnd(6);
                const spk   = String(r.speaking_score).padEnd(5);
                const intr  = String(r.interaction_score).padEnd(5);
                const att   = String(r.attendance_score).padEnd(5);
                return `${id} ${uid} ${score} ${spk} ${intr} ${att} ${r.label}`;
            });

            let output = `🗂️ **RAW participation_summary — Session #${ctx.sessionId}** (${records.length} rows)\n`;
            output    += `\`\`\`\n${header}\n${divider}\n${lines.join('\n')}\n\`\`\``;
            if (truncated) output += `\n_Showing ${MAX_ROWS} of ${records.length} rows (sorted by score DESC)._`;

            return message.reply(output);
        } catch (error) {
            logger.error(`participation-raw command error: ${error.message}`, { error: error.message });
            return message.reply('❌ An error occurred while fetching raw participation data.');
        }
    }
};
