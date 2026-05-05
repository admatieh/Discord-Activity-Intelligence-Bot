// commands/attendance/attendance-user.js
//
// Show all attendance records across sessions for a specific user.
//
// Usage:
//   !attendance-user --user <@mention|id>
// ---------------------------------------------------------------------------

const attendanceSummaryModel = require('../../models/attendanceSummaryModel');
const { resolveUserContext } = require('../../utils/commandResolver');
const { checkInstructor } = require('../../utils/permissions');
const logger = require('../../utils/logger');

const MAX_ROWS = 15;

const STATUS_EMOJI = {
    ON_TIME:    '✅',
    LATE:       '⏰',
    LEFT_EARLY: '🚪',
    ABSENT:     '❌'
};

module.exports = {
    name: 'attendance-user',
    description: "Show a user's attendance history across all sessions.",
    usage: '!attendance-user --user <@mention|id>',
    options: [
        { name: 'user', type: 'string', required: true, description: 'User mention or ID' }
    ],

    execute(message, _args, { parsed } = {}) {
        try {
            if (!message.guild) return message.reply('❌ Server only.');

            const perm = checkInstructor(message.member);
            if (!perm.allowed) return message.reply(perm.message);

            const options = parsed?.options || {};
            const userCtx = resolveUserContext(options);

            if (userCtx.error) return message.reply(userCtx.error);

            const records = attendanceSummaryModel.getByUser(userCtx.userId);

            if (!records || records.length === 0) {
                return message.reply(`⚠️ No attendance records found for <@${userCtx.userId}>.`);
            }

            const rows     = records.slice(0, MAX_ROWS);
            const truncated = records.length > MAX_ROWS;

            const COL_SID    = 6;
            const COL_STATUS = 11;
            const COL_MIN    = 6;

            const header  = `${'Sess'.padEnd(COL_SID)} ${'Status'.padEnd(COL_STATUS)} ${'Min'.padEnd(COL_MIN)} First Join`;
            const divider = '─'.repeat(header.length);

            const lines = rows.map(r => {
                const sid    = String(r.session_id).padEnd(COL_SID);
                const emoji  = STATUS_EMOJI[r.status] || '?';
                const status = `${emoji} ${r.status}`.padEnd(COL_STATUS);
                const mins   = String(Math.round(r.total_time_seconds / 60)).padEnd(COL_MIN);
                const join   = r.first_join_time ? r.first_join_time.slice(0, 16).replace('T', ' ') : '—';
                return `${sid} ${status} ${mins} ${join}`;
            });

            let output = `📋 **Attendance History — <@${userCtx.userId}>** (${records.length} sessions)\n`;
            output    += `\`\`\`\n${header}\n${divider}\n${lines.join('\n')}\n\`\`\``;
            if (truncated) output += `\n_Showing ${MAX_ROWS} of ${records.length} records (most recent first)._`;

            return message.reply(output);
        } catch (error) {
            logger.error(`attendance-user command error: ${error.message}`, { error: error.message });
            return message.reply('❌ An error occurred while fetching user attendance.');
        }
    }
};
