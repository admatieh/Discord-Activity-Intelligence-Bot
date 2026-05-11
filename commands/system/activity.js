const { sendResponse } = require('../../utils/responseHelper');
const { requireInstructor } = require('../../utils/permissions');
// commands/system/activity.js
// Usage: !activity [--limit 20] [--session <id>]

const activityFeedService = require('../../services/activityFeedService');

module.exports = {
    name: 'activity',
    description: 'Show recent activity feed from the bot.',
    usage: '!activity [--private]',
    category: 'system',
    requiredPermission: 'instructor',
    aliases: ['feed'],
    supportsDashboard: true,
    options: [
        { name: 'limit', type: 'number', required: false, description: 'Max entries to show', default: 15 },
        { name: 'session', type: 'number', required: false, description: 'Filter by session ID' },
        { name: 'private', type: 'boolean', required: false, description: 'Send the response privately by DM' },
        { name: 'quiet', type: 'boolean', required: false, description: 'Only send a short confirmation' },
        { name: 'silent', type: 'boolean', required: false, description: 'Do not send a public response' }
    ],

    async execute(message, args, context) {
        const permission = await requireInstructor(message);
        if (!permission.allowed) return message.reply(permission.message);

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
