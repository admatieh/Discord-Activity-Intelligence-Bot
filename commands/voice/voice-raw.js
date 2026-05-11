const { requireInstructor } = require('../../utils/permissions');
// commands/voice/voice-raw.js
//
// Raw dump of all voice_activity_intervals rows for a session.
//
// Usage:
//   !voice-raw [--id <n>] [--channel <#ch>] [--latest]
// ---------------------------------------------------------------------------

const voiceActivityModel = require('../../models/voiceActivityModel');
const { resolveSessionContext } = require('../../utils/commandResolver');
const logger = require('../../utils/logger');

const MAX_ROWS = 15;

module.exports = {
    name: 'voice-raw',
    requiredPermission: 'instructor',
    description: 'Raw dump of all voice_activity_intervals rows for a session.',
    usage: '!voice-raw [--id <n>] [--channel <#ch>] [--latest]',
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

            const intervals = voiceActivityModel.getIntervalsBySession(ctx.sessionId);

            if (!intervals || intervals.length === 0) {
                return message.reply(`⚠️ No voice interval data for Session #${ctx.sessionId}.`);
            }

            const rows      = intervals.slice(0, MAX_ROWS);
            const truncated = intervals.length > MAX_ROWS;
            const openCount = intervals.filter(i => !i.end_time).length;

            const header  = 'id    user_id              start_time           end_time            ';
            const divider = '─'.repeat(header.length);

            const lines = rows.map(iv => {
                const id    = String(iv.id).padEnd(5);
                const uid   = iv.user_id.padEnd(20);
                const start = (iv.start_time || '—').slice(0, 19).padEnd(20);
                const end   = iv.end_time ? iv.end_time.slice(0, 19) : '⚠️ NULL';
                return `${id} ${uid} ${start} ${end}`;
            });

            let output = `🗂️ **RAW voice_activity_intervals — Session #${ctx.sessionId}** (${intervals.length} rows`;
            if (openCount > 0) output += `, ⚠️ ${openCount} open`;
            output += `)\n`;
            output += `\`\`\`\n${header}\n${divider}\n${lines.join('\n')}\n\`\`\``;
            if (truncated) output += `\n_Showing ${MAX_ROWS} of ${intervals.length} rows._`;

            return message.reply(output);
        } catch (error) {
            logger.error(`voice-raw command error: ${error.message}`, { error: error.message });
            return message.reply('❌ An error occurred while fetching raw voice data.');
        }
    }
};
