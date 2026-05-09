// commands/interaction/schedule-message.js
// Usage: !schedule-message --channel <textChannelId> --at "2026-05-09 13:50" --content "Session starts in 10 minutes."

const schedulerService = require('../../services/schedulerService');

module.exports = {
    name: 'schedule-message',
    description: 'Schedule a message to be sent to a text channel at a future time.',
    usage: '!schedule-message --channel <textChannelId> --at "<datetime>" --content "<text>"',
    category: 'interaction',
    aliases: ['sched-msg'],
    supportsDashboard: true,
    requiresGuild: true,
    requiresTextChannel: true,
    options: [
        { name: 'channel', type: 'string', required: true, description: 'Text channel ID' },
        { name: 'at', type: 'string', required: true, description: 'ISO datetime or readable date string' },
        { name: 'content', type: 'string', required: true, description: 'Message content (max 2000 chars)' }
    ],

    async execute(message, args, context) {
        const textChannelId = args.channel;
        const scheduledFor = args.at;
        const content = args.content;
        const guildId = context?.guild?.id || message?.guild?.id;

        if (!textChannelId) return '❌ --channel is required.';
        if (!scheduledFor) return '❌ --at (datetime) is required.';
        if (!content) return '❌ --content is required.';
        if (!guildId) return '❌ Guild context required.';

        const result = schedulerService.scheduleMessage({
            guildId,
            textChannelId,
            content,
            scheduledFor,
            createdBy: context?.user?.username || message?.author?.username || 'command'
        });

        return result.ok
            ? `✅ Message scheduled for ${new Date(scheduledFor).toLocaleString()}. Item ID: #${result.id}`
            : `❌ ${result.error}`;
    }
};
