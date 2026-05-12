const attendanceSummaryModel = require('../../models/attendanceSummaryModel');
const logger = require('../../utils/logger');
const { COMMAND_LIMITS } = require('../../config/constants');
const attendanceService = require('../../services/attendanceCheckpointService');
const attendanceSettingsService = require('../../services/attendanceSettingsService');

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

            // Checkpoint attendance (today + recent 7 days)
            const today = new Date();
            const yyyy = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const dd = String(today.getDate()).padStart(2, '0');
            const endDate = `${yyyy}-${mm}-${dd}`;
            const start = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
            const sy = start.getFullYear();
            const sm = String(start.getMonth() + 1).padStart(2, '0');
            const sd = String(start.getDate()).padStart(2, '0');
            const startDate = `${sy}-${sm}-${sd}`;

            const cpRes = attendanceService.getUserCheckpointRange({
                guildId: message.guild.id,
                userId,
                startDate,
                endDate
            });
            const cpRows = cpRes.ok ? (cpRes.rows || []) : [];

            if ((!records || records.length === 0) && cpRows.length === 0) {
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

            if (cpRows.length > 0) {
                const defsRes = attendanceSettingsService.getCheckpointDefinitions(message.guild.id);
                const activeDefs = (defsRes.definitions || [])
                    .filter((d) => d.active)
                    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
                const byDate = new Map();
                for (const r of cpRows) {
                    const v = byDate.get(r.attendance_date) || {};
                    v[r.checkpoint_key] = r.status;
                    byDate.set(r.attendance_date, v);
                }
                const dateLines = [];
                for (const [d, v] of Array.from(byDate.entries()).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 7)) {
                    const orderedStatuses = activeDefs.map((cp) => v[cp.key] || '—');
                    dateLines.push(`${d}: ${orderedStatuses.join(' / ')}`);
                }
                output += `\n\n🧾 **Checkpoints (last 7 days)**\n`;
                output += `\`${activeDefs.map((cp) => cp.label).join(' / ')}\`\n`;
                output += `\`\`\`\n${dateLines.join('\n')}\n\`\`\``;
                output += `\n_Use \`!checkin\` during open windows and \`!checkout\` at the end of day._`;
            } else {
                output += `\n\n🧾 **Checkpoints**\nℹ️ No checkpoint records yet. Use \`!checkin\` and \`!checkout\` when windows are open.`;
            }

            return message.reply(output);
        } catch (error) {
            logger.error(`my-attendance error: ${error.message}`, { error: error.message });
            return message.reply('❌ An error occurred while fetching your attendance.');
        }
    }
};
