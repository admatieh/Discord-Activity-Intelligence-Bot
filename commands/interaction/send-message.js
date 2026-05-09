// commands/interaction/send-message.js
// Usage: !send-message --channel <textChannelId> --content "Your message here"

const messageService = require('../../services/messageService');
const { resolveChannelContext } = require('../../utils/commandResolver');

module.exports = {
    name: 'send-message',
    description: 'Send a message to a text channel immediately.',
    usage: '!send-message --channel <textChannelId> --content "<text>"',
    category: 'interaction',
    aliases: ['msg'],
    supportsDashboard: true,
    requiresGuild: true,
    requiresTextChannel: true,
    options: [
        { name: 'channel', type: 'string', required: true, description: 'Text channel ID' },
        { name: 'content', type: 'string', required: true, description: 'Message content' }
    ],

    async execute(message, args, context) {
        const parsed = context?.parsed || { options: args };
        const channelCtx = resolveChannelContext(message, parsed.options, true);
        if (channelCtx.error) return channelCtx.error;

        const textChannelId = channelCtx.channelId;
        const content = args.content;
        const guildId = context?.guild?.id || message?.guild?.id;

        if (!content) return '❌ --content is required.';

        const result = await messageService.sendMessageNow({
            guildId,
            textChannelId,
            content,
            requestedBy: context?.user?.username || message?.author?.username || 'command',
            source: 'command'
        });

        return result.ok ? `✅ ${result.message}` : `❌ ${result.error}`;
    }
};
