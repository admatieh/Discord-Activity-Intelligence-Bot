const { requireInstructor } = require('../../utils/permissions');
// commands/interaction/interactions-raw.js
//
// Raw dump of all activity_events rows for a session.
//
// Usage:
//   !interactions-raw [--id <n>] [--channel <#ch>] [--latest]
// ---------------------------------------------------------------------------

const activityEventModel = require('../../modules/activity/activityEventModel');
const { resolveSessionContext } = require('../../utils/commandResolver');
const logger = require('../../utils/logger');

const MAX_ROWS = 15;

module.exports = {
    name: 'interactions-raw',
    requiredPermission: 'instructor',
    description: 'Raw dump of all activity_events rows for a session.',
    usage: '!interactions-raw [--id <n>] [--channel <#ch>] [--latest]',
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

            const events = activityEventModel.getEventsBySession(ctx.sessionId);

            if (!events || events.length === 0) {
                return message.reply(`⚠️ No activity events found for Session #${ctx.sessionId}.`);
            }

            const rows      = events.slice(0, MAX_ROWS);
            const truncated = events.length > MAX_ROWS;

            // Event type frequency summary
            const typeCounts = {};
            for (const ev of events) {
                typeCounts[ev.type] = (typeCounts[ev.type] || 0) + 1;
            }
            const freqLine = Object.entries(typeCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([t, n]) => `${t}=${n}`)
                .join('  ');

            const header  = `${'id'.padEnd(5)} ${'type'.padEnd(18)} ${'user_id'.padEnd(20)} ${'created_at'.padEnd(20)} meta`;
            const divider = '─'.repeat(header.length);

            const lines = rows.map(ev => {
                const id   = String(ev.id).padEnd(5);
                const type = (ev.type || '—').padEnd(18);
                const uid  = (ev.user_id || '—').padEnd(20);
                const time = (ev.created_at || '—').slice(0, 19).replace('T', ' ').padEnd(20);
                const meta = ev.metadata ? String(ev.metadata).slice(0, 20) : '—';
                return `${id} ${type} ${uid} ${time} ${meta}`;
            });

            let output = `🗂️ **RAW activity_events — Session #${ctx.sessionId}** (${events.length} rows)\n`;
            output    += `_${freqLine}_\n`;
            output    += `\`\`\`\n${header}\n${divider}\n${lines.join('\n')}\n\`\`\``;
            if (truncated) output += `\n_Showing ${MAX_ROWS} of ${events.length} rows._`;

            return message.reply(output);
        } catch (error) {
            logger.error(`interactions-raw command error: ${error.message}`, { error: error.message });
            return message.reply('❌ An error occurred while fetching raw interaction data.');
        }
    }
};
