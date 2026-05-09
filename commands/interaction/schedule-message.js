// commands/interaction/schedule-message.js
// Usage:
// !schedule-message --channel <textChannelId> --at "tomorrow 9 AM" --content "Reminder: session starts soon."
// !schedule-message --channel <textChannelId> --in 10m --content "Session starts in 10 minutes."

const schedulerService = require('../../services/schedulerService');
const parseScheduleTime = require('../../utils/parseScheduleTime');

module.exports = {
    name: 'schedule-message',
    description: 'Schedule a message to be sent to a text channel at a future time.',
    usage: '!schedule-message --channel <textChannelId> --at "<time>" [or --in "<relative time>"] --content "<text>"',
    category: 'interaction',
    aliases: ['sched-msg'],
    supportsDashboard: true,
    requiresGuild: true,
    requiresTextChannel: true,
    options: [
        { name: 'channel', type: 'string', required: true, description: 'Text channel ID' },
        { name: 'at', type: 'string', required: false, description: 'Time (e.g. "today 10:10 AM", "tomorrow 2:30 PM", or ISO)' },
        { name: 'in', type: 'string', required: false, description: 'Relative time (e.g. "30m", "1h 30m")' },
        { name: 'content', type: 'string', required: true, description: 'Message content (max 2000 chars)' }
    ],

    async execute(message, args, context) {
        let textChannelId = args.channel;
        if (typeof textChannelId === 'object' && textChannelId !== null) textChannelId = textChannelId.id;
        else if (textChannelId) textChannelId = String(textChannelId).replace(/[<#>]/g, '');

        let guildId = context?.guild?.id || message?.guild?.id;
        if (typeof guildId === 'object' && guildId !== null) guildId = guildId.id;

        if (typeof textChannelId === 'object' && textChannelId !== null) return '❌ textChannelId must be a string ID.';
        if (typeof guildId === 'object' && guildId !== null) return '❌ guildId must be a string ID.';

        const content = args.content ? String(args.content) : null;
        const rawTimeInput = args.at || args.in;

        if (!textChannelId) return '❌ --channel is required.';
        if (!rawTimeInput) return '❌ --at (e.g. "tomorrow 9 AM") or --in (e.g. "10m") is required.';
        if (!content) return '❌ --content is required.';
        if (!guildId) return '❌ Guild context required.';

        const parsedTimeResult = parseScheduleTime(rawTimeInput);
        if (!parsedTimeResult.ok) {
            let errStr = `❌ ${parsedTimeResult.error}`;
            if (parsedTimeResult.examples && parsedTimeResult.examples.length) {
                errStr += `\nExamples:\n- ` + parsedTimeResult.examples.join('\n- ');
            }
            return errStr;
        }

        const result = schedulerService.scheduleMessage({
            guildId: String(guildId),
            textChannelId: String(textChannelId),
            content,
            scheduledFor: parsedTimeResult.scheduledFor,
            createdBy: String(context?.user?.username || message?.author?.username || 'command')
        });

        return result.ok
            ? `✅ Message scheduled for ${parsedTimeResult.displayTime}. Item ID: #${result.id}`
            : `❌ Failed to schedule message: ${result.error}`;
    }
};
