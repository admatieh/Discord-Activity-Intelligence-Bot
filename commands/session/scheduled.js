// commands/session/scheduled.js
// Usage: !scheduled [--type session|message] [--status scheduled|completed|failed|cancelled]

const schedulerService = require('../../services/schedulerService');

module.exports = {
    name: 'scheduled',
    description: 'List scheduled items (sessions and messages).',
    usage: '!scheduled [--type session|message] [--status scheduled]',
    category: 'session',
    aliases: ['schedule-list'],
    supportsDashboard: true,
    options: [
        { name: 'type', type: 'string', required: false, description: 'Filter by type: session or message' },
        { name: 'status', type: 'string', required: false, description: 'Filter by status', default: 'scheduled' }
    ],

    async execute(message, args, context) {
        const items = schedulerService.getScheduledItems({
            type: args.type || null,
            status: args.status || 'scheduled',
            limit: 15
        });

        if (items.length === 0) return '📅 No scheduled items found.';

        let text = `📅 **Scheduled Items** (${items.length})\n\n`;
        for (const item of items) {
            const dt = new Date(item.scheduled_for).toLocaleString();
            text += `**#${item.id}** [${item.type}] ${item.title || '(no title)'} — ${dt} — ${item.status}\n`;
        }
        return text.trim();
    }
};
