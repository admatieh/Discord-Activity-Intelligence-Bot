const { requireInstructor } = require('../../utils/permissions');
// commands/session/scheduled.js
// Usage: !scheduled [--type session|message] [--status scheduled|completed|failed|cancelled]

const schedulerService = require('../../services/schedulerService');
const { parseRecurrenceRule, DAY_CODE_TO_SHORT } = require('../../utils/recurrence');

module.exports = {
    name: 'scheduled',
    description: 'List scheduled items (sessions and messages).',
    usage: '!scheduled [--type session|message] [--status scheduled]',
    category: 'session',
    requiredPermission: 'instructor',
    aliases: ['schedule-list'],
    supportsDashboard: true,
    options: [
        { name: 'type', type: 'string', required: false, description: 'Filter by type: session or message' },
        { name: 'status', type: 'string', required: false, description: 'Filter by status', default: 'scheduled' }
    ],

    async execute(message, args, context) {
        const permission = await requireInstructor(message);
        if (!permission.allowed) return message.reply(permission.message);

        const items = schedulerService.getScheduledItems({
            type: args.type || null,
            status: args.status || 'scheduled',
            limit: 15
        });

        if (items.length === 0) return '📅 No scheduled items found.';

        let text = `📅 **Scheduled Items** (${items.length})\n\n`;
        for (const item of items) {
            const dt = new Date(item.scheduled_for).toLocaleString();
            const isRecurring = !!item.recurrence_rule;

            if (isRecurring) {
                const parsed = parseRecurrenceRule(item.recurrence_rule);
                let recurrenceStr = '🔁 recurring';
                if (parsed.ok) {
                    const days = parsed.rule.daysOfWeek.map(d => DAY_CODE_TO_SHORT[d] || d).join(', ');
                    recurrenceStr = `🔁 ${days} at ${parsed.rule.time} ${parsed.rule.timezone}`;
                }
                const nextRun = item.next_run_at ? new Date(item.next_run_at).toLocaleString() : dt;
                text += `**#${item.id}** [${item.type}] **${item.title || '(no title)'}**\n`;
                text += `   ${recurrenceStr}\n`;
                text += `   Next run: ${nextRun} — ${item.status}\n\n`;
            } else {
                text += `**#${item.id}** [${item.type}] ${item.title || '(no title)'} — ${dt} — ${item.status}\n`;
            }
        }
        return text.trim();
    }
};
