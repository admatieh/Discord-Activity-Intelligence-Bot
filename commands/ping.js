const { requireInstructor } = require('../utils/permissions');
// commands/ping.js

const logger = require('../utils/logger');

module.exports = {
    name: 'ping',
    category: 'general',
    requiredPermission: 'instructor',
    description: 'Check if the bot is online and responsive.',
    usage: '!ping',
    options: [],
    async execute(message) {
        const permission = await requireInstructor(message);
        if (!permission.allowed) return message.reply(permission.message);

        try {
            return message.reply('Pong!');
        } catch (error) {
            logger.error(`Ping command error: ${error.message}`, { error: error.message });
            return message.reply('❌ An error occurred.');
        }
    }
};