const { sendResponse } = require('../../utils/responseHelper');
const { requireInstructor } = require('../../utils/permissions');
// commands/session/cancel-scheduled.js
// Usage: !cancel-scheduled --id <itemId>

const schedulerService = require('../../services/schedulerService');

module.exports = {
    name: 'cancel-scheduled',
    description: 'Cancel a scheduled session or message by ID.',
    usage: '!cancel-scheduled --id <itemId>',
    category: 'session',
    requiredPermission: 'instructor',
    aliases: ['cancel-schedule'],
    supportsDashboard: true,
    options: [
{ name: 'id', type: 'number', required: true, description: 'Scheduled item ID' },
        { name: 'private', type: 'boolean', required: false, description: 'Send the response privately by DM' },
        { name: 'quiet', type: 'boolean', required: false, description: 'Only send a short confirmation' },
        { name: 'silent', type: 'boolean', required: false, description: 'Do not send a public response' }
    ],

    async execute(message, args, context) {
        const permission = await requireInstructor(message);
        if (!permission.allowed) return message.reply(permission.message);

        if (!args.id) return '❌ --id is required.';
        const result = schedulerService.cancelScheduledItem(Number(args.id));
        return result.ok ? `✅ ${result.message}` : `❌ ${result.error}`;
    }
};
