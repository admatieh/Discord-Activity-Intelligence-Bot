const { sendResponse } = require('../../utils/responseHelper');
const { requireInstructor } = require('../../utils/permissions');
// commands/participation/participation-user.js
//
// Show the participation record for a specific user in a session.
//
// Usage:
//   !participation-user --user <@mention|id> [--id <n>] [--channel <#ch>] [--latest]
// ---------------------------------------------------------------------------

const participationSummaryModel = require('../../models/participationSummaryModel');
const { resolveSessionContext, resolveUserContext } = require('../../utils/commandResolver');
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
    requiredPermission: 'instructor',
    description: "Show a specific user's participation record for a session.",
    usage: '!participation-user --user <@mention|id> [--id <n>] [--channel <#ch>] [--latest]',
    options: [
{ name: 'user',    type: 'string',  required: true,  description: 'User mention or ID' },
        { name: 'id',      type: 'number',  required: false, description: 'Session ID' },
        { name: 'channel', type: 'channel', required: false, description: 'Voice channel' },
        { name: 'latest',  type: 'boolean', required: false, description: 'Use most recent session' },
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
            const ctx     = resolveSessionContext(message, options);
            const userCtx = resolveUserContext(message, options);

            if (ctx.error)     return sendResponse(message, ctx.error, parsed?.options || {});
            if (userCtx.error) return sendResponse(message, userCtx.error, parsed?.options || {});

            const record = participationSummaryModel.getByUser(ctx.sessionId, userCtx.userId);

            if (!record) {
                return sendResponse(message, 
                    `⚠️ No participation record for <@${userCtx.userId}> in Session #${ctx.sessionId}. ` +
                    `The session may not have been finalized yet, or this user was not tracked.`
                , parsed?.options || {});
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
            return sendResponse(message, '❌ An error occurred while fetching user participation.', parsed?.options || {});
        }
    }
};
