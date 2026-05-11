const { requireInstructor } = require('../../utils/permissions');
// commands/participation/participation.js
//
// Full participation table for a session, sorted by score DESC.
//
// Usage:
//   !participation                      → session in your voice channel
//   !participation --id <sessionId>
//   !participation --channel <#ch>
//   !participation --latest
// ---------------------------------------------------------------------------

const participationSummaryModel = require('../../models/participationSummaryModel');
const { resolveSessionContext } = require('../../utils/commandResolver');
const logger = require('../../utils/logger');

const MAX_ROWS = 15;

const LABEL_EMOJI = {
    HIGHLY_ACTIVE: '🔥',
    ACTIVE:        '✅',
    MODERATE:      '🟡',
    LOW:           '🟠',
    INACTIVE:      '⬛'
};

module.exports = {
    name: 'participation',
    category: 'participation',
    requiredPermission: 'instructor',
    aliases: ['part'],
    description: 'Show full participation scores for a session (sorted by score DESC).',
    usage: '!participation [--id <n>] [--channel <#ch>] [--latest]',
    options: [
        { name: 'id',      type: 'number',  required: false, description: 'Session ID' },
        { name: 'channel', type: 'channel', required: false, description: 'Voice channel' },
        { name: 'latest',  type: 'boolean', required: false, description: 'Use most recent session' }
    ],

    async execute(message, _args, { parsed } = {}) {
        const permission = await requireInstructor(message);
        if (!permission.allowed) return message.reply(permission.message);

        try {
            if (!message.guild) return message.reply('❌ Server only.');

            const options = parsed?.options || {};
            const ctx     = resolveSessionContext(message, options);

            if (ctx.error) return message.reply(ctx.error);

            const records = participationSummaryModel.getBySession(ctx.sessionId);

            if (!records || records.length === 0) {
                return message.reply(`⚠️ No participation data for Session #${ctx.sessionId}. The session may not have been finalized yet.`);
            }

            // Sort by score DESC
            const sorted    = [...records].sort((a, b) => b.score - a.score);
            const rows       = sorted.slice(0, MAX_ROWS);
            const truncated  = sorted.length > MAX_ROWS;

            const COL_USER  = 22;
            const COL_SCORE = 6;
            const COL_SPK   = 6;
            const COL_INT   = 8;
            const COL_ATT   = 7;

            const header  = `${'User'.padEnd(COL_USER)} ${'Score'.padEnd(COL_SCORE)} ${'Speak'.padEnd(COL_SPK)} ${'Interact'.padEnd(COL_INT)} ${'Attend'.padEnd(COL_ATT)} Label`;
            const divider = '─'.repeat(header.length);

            const lines = rows.map(r => {
                const user  = `<@${r.user_id}>`.padEnd(COL_USER);
                const score = String(r.score).padEnd(COL_SCORE);
                const spk   = String(r.speaking_score).padEnd(COL_SPK);
                const intr  = String(r.interaction_score).padEnd(COL_INT);
                const att   = String(r.attendance_score).padEnd(COL_ATT);
                const emoji = LABEL_EMOJI[r.label] || '—';
                return `${user} ${score} ${spk} ${intr} ${att} ${emoji} ${r.label}`;
            });

            const avgScore = Math.round(records.reduce((s, r) => s + r.score, 0) / records.length);

            let output = `📊 **Session #${ctx.sessionId} — Participation** (${records.length} users | avg score: ${avgScore})\n`;
            output    += `\`\`\`\n${header}\n${divider}\n${lines.join('\n')}\n\`\`\``;
            if (truncated) output += `\n_Showing top ${MAX_ROWS} of ${records.length}. Use \`!participation-raw\` for all._`;

            return message.reply(output);
        } catch (error) {
            logger.error(`participation command error: ${error.message}`, { error: error.message });
            return message.reply('❌ An error occurred while fetching participation data.');
        }
    }
};
