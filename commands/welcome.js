// commands/welcome.js

const logger = require('../utils/logger');

module.exports = {
    name: 'welcome',
    category: 'general',
    description: 'Send a welcome message to the current channel.',
    usage: '!welcome',
    options: [],
    execute(message) {
        try {
            if (!message.guild) {
                return message.reply('❌ This command can only be used inside a server channel.');
            }

            const channelName = message.channel.name;
            const roleName = 'Students';

            return message.reply(
                `Welcome everyone in ${channelName}! Don't forget to mute your microphone when you're not speaking. ` +
                `${roleName} will be used to track attendance.`
            );
        } catch (error) {
            logger.error(`Welcome command error: ${error.message}`, { error: error.message });
            return message.reply('❌ An error occurred.');
        }
    }
};