const { requireInstructor } = require('../../utils/permissions');
// commands/interaction/interactions.js
//
// Session interaction events summary — counts per user, broken down by type.
//
// Usage:
//   !interactions                      → session in your voice channel
//   !interactions --id <sessionId>
//   !interactions --channel <#ch>
//   !interactions --latest
// ---------------------------------------------------------------------------

const activityEventModel = require('../../modules/activity/activityEventModel');
const { resolveSessionContext } = require('../../utils/commandResolver');
const logger = require('../../utils/logger');

const MAX_ROWS = 15;

module.exports = {
    name: 'interactions',
    requiredPermission: 'instructor',
    description: 'Show interaction event counts per user for a session.',
    usage: '!interactions [--id <n>] [--channel <#ch>] [--latest]',
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
                return message.reply(`⚠️ No interaction events found for Session #${ctx.sessionId}.`);
            }

            // Aggregate per user
            const userMap = new Map();
            for (const ev of events) {
                if (!userMap.has(ev.user_id)) {
                    userMap.set(ev.user_id, { msgs: 0, replies: 0, reactions: 0, other: 0, total: 0 });
                }
                const u = userMap.get(ev.user_id);
                switch (ev.type) {
                    case 'MESSAGE_CREATE': u.msgs++;      break;
                    case 'MESSAGE_REPLY':  u.replies++;   break;
                    case 'REACTION_ADD':   u.reactions++; break;
                    default:               u.other++;     break;
                }
                u.total++;
            }

            // Sort by total DESC
            const sorted = [...userMap.entries()]
                .sort((a, b) => b[1].total - a[1].total)
                .slice(0, MAX_ROWS);

            const truncated = userMap.size > MAX_ROWS;

            const COL_USER  = 22;
            const COL_NUM   = 6;

            const header  = `${'User'.padEnd(COL_USER)} ${'Total'.padEnd(COL_NUM)} ${'Msgs'.padEnd(COL_NUM)} ${'Reply'.padEnd(COL_NUM)} ${'React'.padEnd(COL_NUM)} Other`;
            const divider = '─'.repeat(header.length);

            const lines = sorted.map(([uid, u]) => {
                const user  = `<@${uid}>`.padEnd(COL_USER);
                const total = String(u.total).padEnd(COL_NUM);
                const msgs  = String(u.msgs).padEnd(COL_NUM);
                const rep   = String(u.replies).padEnd(COL_NUM);
                const reac  = String(u.reactions).padEnd(COL_NUM);
                return `${user} ${total} ${msgs} ${rep} ${reac} ${u.other}`;
            });

            let output = `💬 **Session #${ctx.sessionId} — Interactions** (${userMap.size} users, ${events.length} events)\n`;
            output    += `\`\`\`\n${header}\n${divider}\n${lines.join('\n')}\n\`\`\``;
            if (truncated) output += `\n_Showing ${MAX_ROWS} of ${userMap.size} users. Use \`!interactions-raw\` for all events._`;

            return message.reply(output);
        } catch (error) {
            logger.error(`interactions command error: ${error.message}`, { error: error.message });
            return message.reply('❌ An error occurred while fetching interaction data.');
        }
    }
};
