const { sendResponse } = require('../../utils/responseHelper');
const { requireInstructor } = require('../../utils/permissions');
// commands/attendance/attendance-user.js
//
// Show all attendance records across sessions for a specific user.
//
// Usage:
//   !attendance-user --user <@mention|id>
// ---------------------------------------------------------------------------

const attendanceSummaryModel = require('../../models/attendanceSummaryModel');
const { resolveUserContext } = require('../../utils/commandResolver');
const logger = require('../../utils/logger');
const { COMMAND_LIMITS } = require('../../config/constants');

const STATUS_EMOJI = {
    ON_TIME:    '✅',
    LATE:       '⏰',
    LEFT_EARLY: '🚪',
    ABSENT:     '❌'
};

module.exports = {
    name: 'attendance-user',
    requiredPermission: 'instructor',
    description: "Show a user's attendance history across all sessions.",
    usage: '!attendance-user --user <@mention|id>',
    options: [
{ name: 'user', type: 'string', required: true, description: 'User mention or ID' },
        { name: 'private', type: 'boolean', required: false, description: 'Send the response privately by DM' },
        { name: 'quiet', type: 'boolean', required: false, description: 'Only send a short confirmation' },
        { name: 'silent', type: 'boolean', required: false, description: 'Do not send a public response' }
    ],

    async execute(message, _args, { parsed } = {}) {
        const permission = await requireInstructor(message);
        if (!permission.allowed) return message.reply(permission.message);

        try {
            if (!message.guild) return sendResponse(message, '❌ Server only.', parsed?.options || {});

            const options = parsed?.options || {};
            const userCtx = resolveUserContext(message, options);

            if (userCtx.error) return sendResponse(message, userCtx.error, parsed?.options || {});

            const records = attendanceSummaryModel.getByUser(userCtx.userId);

            if (!records || records.length === 0) {
                return sendResponse(message, `⚠️ No attendance records found for <@${userCtx.userId}>.`, parsed?.options || {});
            }

            const limit     = COMMAND_LIMITS.DEFAULT;
            const rows      = records.slice(0, limit);
            const truncated = records.length > limit;

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
            if (truncated) output += `\n_Showing ${limit} of ${records.length} records (most recent first)._`;

            return sendResponse(message, output, parsed?.options || {});
        } catch (error) {
            logger.error(`attendance-user command error: ${error.message}`, { error: error.message });
            return sendResponse(message, '❌ An error occurred while fetching user attendance.', parsed?.options || {});
        }
    }
};
