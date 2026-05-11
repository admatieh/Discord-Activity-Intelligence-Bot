const { requireInstructor } = require('../../utils/permissions');
// commands/attendance/attendance-raw.js
//
// Raw dump of attendance_summary rows for a session (no aggregation).
// Returns all fields as a plaintext table — intended for exports/debugging.
//
// Usage:
//   !attendance-raw --id <sessionId>
//   !attendance-raw --channel <#ch>
//   !attendance-raw --latest
// ---------------------------------------------------------------------------

const attendanceSummaryModel = require('../../models/attendanceSummaryModel');
const { resolveSessionContext } = require('../../utils/commandResolver');
const logger = require('../../utils/logger');

const MAX_ROWS = 15;

module.exports = {
    name: 'attendance-raw',
    requiredPermission: 'instructor',
    description: 'Raw dump of all attendance_summary rows for a session.',
    usage: '!attendance-raw [--id <n>] [--channel <#ch>] [--latest]',
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

            const records = attendanceSummaryModel.getBySession(ctx.sessionId);

            if (!records || records.length === 0) {
                return message.reply(`⚠️ No attendance data available for Session #${ctx.sessionId}.`);
            }

            const rows      = records.slice(0, MAX_ROWS);
            const truncated = records.length > MAX_ROWS;

            const header  = 'id    sess  user_id              status       secs   first_join           last_leave';
            const divider = '─'.repeat(header.length);

            const lines = rows.map(r => {
                const id     = String(r.id).padEnd(5);
                const sess   = String(r.session_id).padEnd(5);
                const uid    = r.user_id.padEnd(20);
                const status = (r.status || '').padEnd(12);
                const secs   = String(r.total_time_seconds || 0).padEnd(6);
                const join   = (r.first_join_time  || '—').slice(0, 19).padEnd(20);
                const leave  = (r.last_leave_time  || '—').slice(0, 19);
                return `${id} ${sess} ${uid} ${status} ${secs} ${join} ${leave}`;
            });

            let output = `🗂️ **RAW attendance_summary — Session #${ctx.sessionId}** (${records.length} rows)\n`;
            output    += `\`\`\`\n${header}\n${divider}\n${lines.join('\n')}\n\`\`\``;
            if (truncated) output += `\n_Showing ${MAX_ROWS} of ${records.length} rows._`;

            return message.reply(output);
        } catch (error) {
            logger.error(`attendance-raw command error: ${error.message}`, { error: error.message });
            return message.reply('❌ An error occurred while fetching raw attendance data.');
        }
    }
};
