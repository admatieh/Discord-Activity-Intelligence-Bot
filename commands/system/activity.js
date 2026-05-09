// commands/system/activity.js
// Usage: !activity [--limit 20] [--session <id>]

const activityFeedService = require('../../services/activityFeedService');

module.exports = {
    name: 'activity',
    description: 'Show recent activity feed from the bot.',
    usage: '!activity [--limit 20] [--session <sessionId>]',
    category: 'system',
    aliases: ['feed'],
    supportsDashboard: true,
    options: [
        { name: 'limit', type: 'number', required: false, description: 'Max entries to show', default: 15 },
        { name: 'session', type: 'number', required: false, description: 'Filter by session ID' }
    ],

    async execute(message, args, context) {
        const limit = Math.min(Number(args.limit) || 15, 30);
        const sessionId = args.session ? Number(args.session) : null;

        const feed = activityFeedService.getActivityFeed({ limit, sessionId });

        if (feed.length === 0) return '📋 No activity entries found.';

        let text = `📋 **Recent Activity** (${feed.length})\n\n`;
        for (const entry of feed) {
            const ts = entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : '?';
            const sev = entry.severity === 'error' ? '🔴' : entry.severity === 'warning' ? '🟡' : '🟢';
            text += `${sev} \`${ts}\` ${entry.label}\n`;
        }
        return text.trim().slice(0, 1900);
    }
};
