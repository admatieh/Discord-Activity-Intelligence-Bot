// commands/participation/participation-user.js
//
// Show the participation record for a specific user in a session.
//
// Usage:
//   !participation-user --user <@mention|id> [--id <n>] [--channel <#ch>] [--latest]
// ---------------------------------------------------------------------------

const participationSummaryModel = require('../../models/participationSummaryModel');
const { resolveSessionContext, resolveUserContext } = require('../../utils/commandResolver');
const { checkInstructor } = require('../../utils/permissions');
const logger = require('../../utils/logger');

const LABEL_EMOJI = {
    HIGHLY_ACTIVE: '🔥',
    ACTIVE:        '✅',
    MODERATE:      '🟡',
    LOW:           '🟠',
    INACTIVE:      '⬛'
};

module.exports = {
    name: 'participation-user',
    description: "Show a specific user's participation record for a session.",
    usage: '!participation-user --user <@mention|id> [--id <n>] [--channel <#ch>] [--latest]',
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
            const userCtx = resolveUserContext(message, options);

            if (ctx.error)     return message.reply(ctx.error);
            if (userCtx.error) return message.reply(userCtx.error);

            const record = participationSummaryModel.getByUser(ctx.sessionId, userCtx.userId);

            if (!record) {
                return message.reply(
                    `⚠️ No participation record for <@${userCtx.userId}> in Session #${ctx.sessionId}. ` +
                    `The session may not have been finalized yet, or this user was not tracked.`
                );
            }

            const emoji = LABEL_EMOJI[record.label] || '—';

            const lines = [
                `📊 **Participation — <@${userCtx.userId}> / Session #${ctx.sessionId}**`,
                ``,
                `${emoji}  **Label:**          ${record.label}`,
                `⭐  **Total Score:**     ${record.score} / 100`,
                ``,
                `🎙️  Speaking Score:    ${record.speaking_score} / 50`,
                `💬  Interaction Score: ${record.interaction_score} / 30`,
                `📅  Attendance Score:  ${record.attendance_score} / 20`,
                ``,
                `_Recorded: ${record.created_at ? record.created_at.slice(0, 19).replace('T', ' ') : '—'}_`
            ];

            return message.reply(lines.join('\n'));
        } catch (error) {
            logger.error(`participation-user command error: ${error.message}`, { error: error.message });
            return message.reply('❌ An error occurred while fetching user participation.');
        }
    }
};
