const db = require('../../database/db');
const logger = require('../../utils/logger');
const { COMMAND_LIMITS } = require('../../config/constants');

const LABEL_EMOJI = {
    HIGHLY_ACTIVE: '🔥',
    ACTIVE:        '✅',
    MODERATE:      '🟡',
    LOW:           '🟠',
    INACTIVE:      '⬛'
};

module.exports = {
    name: 'my-participation',
    description: 'View your own participation history across sessions.',
    usage: '!my-participation',
    category: 'participation',
    aliases: ['participation-me'],
    requiredPermission: 'public',
    supportsDashboard: true,

    execute(message) {
        try {
            if (!message.guild) return message.reply('❌ Server only.');

            const userId = message.author?.id;
            if (!userId) return message.reply('❌ Could not determine your user ID.');

            // Get records from participation_summary
            const records = db.prepare('SELECT * FROM participation_summary WHERE user_id = ? ORDER BY session_id DESC').all(userId);

            if (!records || records.length === 0) {
                return message.reply(`ℹ️ I don't have any participation records for you yet.`);
            }

            const limit = COMMAND_LIMITS.DEFAULT;
            const rows = records.slice(0, limit);
            const truncated = records.length > limit;

            let totalScore = 0;
            let totalSpeaking = 0;
            for (const r of records) {
                totalScore += r.score || 0;
                totalSpeaking += r.speaking_score || 0;
            }
            const avgScore = records.length ? Math.round(totalScore / records.length) : 0;

            const COL_SID = 6;
            const COL_SCORE = 8;
            const COL_LABEL = 15;

            const header  = `${'Sess'.padEnd(COL_SID)} ${'Score'.padEnd(COL_SCORE)} Label`;
            const divider = '─'.repeat(header.length);

            const lines = rows.map(r => {
                const sid    = String(r.session_id).padEnd(COL_SID);
                const score  = String(r.score).padEnd(COL_SCORE);
                const emoji  = LABEL_EMOJI[r.label] || '—';
                const label  = `${emoji} ${r.label}`;
                return `${sid} ${score} ${label}`;
            });

            let output = `📊 **Your Participation History** (${records.length} sessions)\n`;
            output += `Average Score: **${avgScore} / 100**\n`;
            output += `\`\`\`\n${header}\n${divider}\n${lines.join('\n')}\n\`\`\``;
            
            if (truncated) output += `\n_Showing recent ${limit} sessions._`;

            return message.reply(output);
        } catch (error) {
            logger.error(`my-participation error: ${error.message}`, { error: error.message });
            return message.reply('❌ An error occurred while fetching your participation.');
        }
    }
};
