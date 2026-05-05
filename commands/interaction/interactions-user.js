// commands/interaction/interactions-user.js
//
// All interaction events for a specific user in a session.
//
// Usage:
//   !interactions-user --user <@mention|id> [--id <n>] [--channel <#ch>] [--latest]
// ---------------------------------------------------------------------------

const activityEventModel = require('../../modules/activity/activityEventModel');
const { resolveSessionContext, resolveUserContext } = require('../../utils/commandResolver');
const { checkInstructor } = require('../../utils/permissions');
const logger = require('../../utils/logger');

const MAX_ROWS = 15;

module.exports = {
    name: 'interactions-user',
    description: "Show all interaction events for a specific user in a session.",
    usage: '!interactions-user --user <@mention|id> [--id <n>] [--channel <#ch>] [--latest]',
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
            const userCtx = resolveUserContext(options);

            if (ctx.error)     return message.reply(ctx.error);
            if (userCtx.error) return message.reply(userCtx.error);

            const allEvents   = activityEventModel.getEventsBySession(ctx.sessionId);
            const userEvents  = allEvents.filter(ev => ev.user_id === userCtx.userId);

            if (!userEvents || userEvents.length === 0) {
                return message.reply(`⚠️ No interaction events found for <@${userCtx.userId}> in Session #${ctx.sessionId}.`);
            }

            const rows      = userEvents.slice(0, MAX_ROWS);
            const truncated = userEvents.length > MAX_ROWS;

            // Count by type
            const counts = {};
            for (const ev of userEvents) {
                counts[ev.type] = (counts[ev.type] || 0) + 1;
            }
            const countSummary = Object.entries(counts)
                .map(([type, n]) => `${type}: ${n}`)
                .join('  |  ');

            const header  = `${'#'.padEnd(4)} ${'Type'.padEnd(18)} ${'Time'.padEnd(20)} Metadata`;
            const divider = '─'.repeat(Math.max(header.length, 60));

            const lines = rows.map((ev, i) => {
                const idx  = String(i + 1).padEnd(4);
                const type = (ev.type || '—').padEnd(18);
                const time = (ev.created_at || '—').slice(0, 19).replace('T', ' ').padEnd(20);
                const meta = ev.metadata ? String(ev.metadata).slice(0, 30) : '—';
                return `${idx} ${type} ${time} ${meta}`;
            });

            let output = `💬 **Interactions — <@${userCtx.userId}> / Session #${ctx.sessionId}** (${userEvents.length} events)\n`;
            output    += `_${countSummary}_\n`;
            output    += `\`\`\`\n${header}\n${divider}\n${lines.join('\n')}\n\`\`\``;
            if (truncated) output += `\n_Showing ${MAX_ROWS} of ${userEvents.length} events._`;

            return message.reply(output);
        } catch (error) {
            logger.error(`interactions-user command error: ${error.message}`, { error: error.message });
            return message.reply('❌ An error occurred while fetching user interaction events.');
        }
    }
};
