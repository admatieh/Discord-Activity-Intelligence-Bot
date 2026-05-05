// commands/attendance/attendance.js
//
// Session-level attendance summary table.
//
// Usage:
//   !attendance                      → session in your voice channel
//   !attendance --id <sessionId>     → by ID
//   !attendance --channel <#ch>      → by channel
//   !attendance --latest             → most recent session
// ---------------------------------------------------------------------------

const attendanceSummaryModel = require('../../models/attendanceSummaryModel');
const { resolveSessionContext } = require('../../utils/commandResolver');
const { checkInstructor } = require('../../utils/permissions');
const logger = require('../../utils/logger');

const MAX_ROWS = 15;

// Status emoji map
const STATUS_EMOJI = {
    ON_TIME:    '✅',
    LATE:       '⏰',
    LEFT_EARLY: '🚪',
    ABSENT:     '❌'
};

module.exports = {
    name: 'attendance',
    description: 'Show attendance summary for a session.',
    usage: '!attendance [--id <n>] [--channel <#ch>] [--latest]',
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

            const records = attendanceSummaryModel.getBySession(ctx.sessionId);

            if (!records || records.length === 0) {
                return message.reply(`⚠️ No attendance data available for Session #${ctx.sessionId}.`);
            }

            const rows    = records.slice(0, MAX_ROWS);
            const truncated = records.length > MAX_ROWS;

            // Build table
            const COL_USER   = 20;
            const COL_STATUS = 11;
            const COL_TIME   = 8;

            const header = `${'User'.padEnd(COL_USER)} ${'Status'.padEnd(COL_STATUS)} ${'Min'.padEnd(COL_TIME)} First Join`;
            const divider = '─'.repeat(header.length);

            const lines = rows.map(r => {
                const uid    = `<@${r.user_id}>`.padEnd(COL_USER);
                const emoji  = STATUS_EMOJI[r.status] || '?';
                const status = `${emoji} ${r.status}`.padEnd(COL_STATUS);
                const mins   = String(Math.round(r.total_time_seconds / 60)).padEnd(COL_TIME);
                const join   = r.first_join_time ? r.first_join_time.slice(11, 19) : '—';
                return `${uid} ${status} ${mins} ${join}`;
            });

            // Status counts
            const counts = { ON_TIME: 0, LATE: 0, LEFT_EARLY: 0, ABSENT: 0 };
            for (const r of records) counts[r.status] = (counts[r.status] || 0) + 1;

            const summary = `✅ ${counts.ON_TIME}  ⏰ ${counts.LATE}  🚪 ${counts.LEFT_EARLY}  ❌ ${counts.ABSENT}`;

            let output = `📋 **Session #${ctx.sessionId} — Attendance** (${records.length} users)\n`;
            output    += `${summary}\n`;
            output    += `\`\`\`\n${header}\n${divider}\n${lines.join('\n')}\n\`\`\``;
            if (truncated) output += `\n_Showing ${MAX_ROWS} of ${records.length}. Use \`!attendance-raw --id ${ctx.sessionId}\` for full data._`;

            return message.reply(output);
        } catch (error) {
            logger.error(`attendance command error: ${error.message}`, { error: error.message });
            return message.reply('❌ An error occurred while fetching attendance.');
        }
    }
};
