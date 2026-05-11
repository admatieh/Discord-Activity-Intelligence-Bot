const { requireInstructor } = require('../../utils/permissions');
// commands/voice/voice-activity.js
//
// Aggregated voice activity summary per user for a session.
// Shows speaking time (min), segment count, and avg segment duration.
//
// Usage:
//   !voice-activity                      → session in your voice channel
//   !voice-activity --id <sessionId>
//   !voice-activity --channel <#ch>
//   !voice-activity --latest
// ---------------------------------------------------------------------------

const voiceActivityModel = require('../../models/voiceActivityModel');
const { resolveSessionContext } = require('../../utils/commandResolver');
const logger = require('../../utils/logger');

const MAX_ROWS = 15;

module.exports = {
    name: 'voice-activity',
    requiredPermission: 'instructor',
    description: 'Show aggregated voice activity (speaking time) per user for a session.',
    usage: '!voice-activity [--id <n>] [--channel <#ch>] [--latest]',
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
                return message.reply(`⚠️ No voice activity data for Session #${ctx.sessionId}.`);
            }

            // Aggregate per user
            const userMap = new Map();
            for (const iv of intervals) {
                if (!userMap.has(iv.user_id)) {
                    userMap.set(iv.user_id, { totalSec: 0, segments: 0, open: 0 });
                }
                const u = userMap.get(iv.user_id);
                if (iv.end_time) {
                    const dur = (new Date(iv.end_time) - new Date(iv.start_time)) / 1000;
                    u.totalSec += Math.max(0, dur);
                    u.segments++;
                } else {
                    u.open++;
                }
            }

            // Sort by totalSec DESC
            const sorted = [...userMap.entries()]
                .sort((a, b) => b[1].totalSec - a[1].totalSec)
                .slice(0, MAX_ROWS);

            const truncated = userMap.size > MAX_ROWS;

            const COL_USER = 22;
            const COL_MIN  = 8;
            const COL_SEG  = 8;
            const COL_AVG  = 8;

            const header  = `${'User'.padEnd(COL_USER)} ${'Min'.padEnd(COL_MIN)} ${'Segs'.padEnd(COL_SEG)} ${'Avg(s)'.padEnd(COL_AVG)} Open`;
            const divider = '─'.repeat(header.length);

            const lines = sorted.map(([uid, u]) => {
                const user = `<@${uid}>`.padEnd(COL_USER);
                const mins = String(Math.round(u.totalSec / 60)).padEnd(COL_MIN);
                const segs = String(u.segments).padEnd(COL_SEG);
                const avg  = u.segments > 0
                    ? String(Math.round(u.totalSec / u.segments)).padEnd(COL_AVG)
                    : '—'.padEnd(COL_AVG);
                const open = u.open > 0 ? `⚠️ ${u.open}` : '—';
                return `${user} ${mins} ${segs} ${avg} ${open}`;
            });

            let output = `🎙️ **Session #${ctx.sessionId} — Voice Activity** (${userMap.size} users)\n`;
            output    += `\`\`\`\n${header}\n${divider}\n${lines.join('\n')}\n\`\`\``;
            if (truncated) output += `\n_Showing ${MAX_ROWS} of ${userMap.size}. Use \`!voice-raw\` for all rows._`;

            return message.reply(output);
        } catch (error) {
            logger.error(`voice-activity command error: ${error.message}`, { error: error.message });
            return message.reply('❌ An error occurred while fetching voice activity.');
        }
    }
};
