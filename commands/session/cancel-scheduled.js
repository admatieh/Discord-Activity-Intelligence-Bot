// commands/session/cancel-scheduled.js
// Usage: !cancel-scheduled --id <itemId>

const schedulerService = require('../../services/schedulerService');

module.exports = {
    name: 'cancel-scheduled',
    description: 'Cancel a scheduled session or message by ID.',
    usage: '!cancel-scheduled --id <itemId>',
    category: 'session',
    aliases: ['cancel-schedule'],
    supportsDashboard: true,
    options: [
        { name: 'id', type: 'number', required: true, description: 'Scheduled item ID' }
    ],

    async execute(message, args, context) {
        if (!args.id) return '❌ --id is required.';
        const result = schedulerService.cancelScheduledItem(Number(args.id));
        return result.ok ? `✅ ${result.message}` : `❌ ${result.error}`;
    }
};
