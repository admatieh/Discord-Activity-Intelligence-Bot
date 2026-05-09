const attendanceSummaryModel = require('../../models/attendanceSummaryModel');
const logger = require('../../utils/logger');
const { COMMAND_LIMITS } = require('../../config/constants');

const STATUS_EMOJI = {
    ON_TIME:    '✅',
    LATE:       '⏰',
    LEFT_EARLY: '🚪',
    ABSENT:     '❌'
};

module.exports = {
    name: 'my-attendance',
    description: 'View your own attendance history across sessions.',
    usage: '!my-attendance',
    category: 'attendance',
    aliases: ['attendance-me'],
    requiredPermission: 'public',
    supportsDashboard: true,

    execute(message) {
        try {
            if (!message.guild) return message.reply('❌ Server only.');

            const userId = message.author?.id;
            if (!userId) return message.reply('❌ Could not determine your user ID.');

            const records = attendanceSummaryModel.getByUser(userId);

            if (!records || records.length === 0) {
                return message.reply(`ℹ️ I don't have any attendance records for you yet.`);
            }

            const limit = COMMAND_LIMITS.DEFAULT;
            const rows = records.slice(0, limit);
            const truncated = records.length > limit;

            let totalSec = 0;
            for (const r of records) {
                totalSec += r.total_time_seconds || 0;
            }

            const COL_SID = 6;
            const COL_STATUS = 11;
            const COL_MIN = 6;

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

            let output = `📋 **Your Attendance History** (${records.length} sessions)\n`;
            output += `Total voice time: **${Math.round(totalSec / 60)} min**\n`;
            output += `\`\`\`\n${header}\n${divider}\n${lines.join('\n')}\n\`\`\``;
            
            if (truncated) output += `\n_Showing recent ${limit} sessions._`;

            return message.reply(output);
        } catch (error) {
            logger.error(`my-attendance error: ${error.message}`, { error: error.message });
            return message.reply('❌ An error occurred while fetching your attendance.');
        }
    }
};
