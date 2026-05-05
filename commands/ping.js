// commands/ping.js

const logger = require('../utils/logger');

module.exports = {
    name: 'ping',
    category: 'general',
    description: 'Check if the bot is online and responsive.',
    usage: '!ping',
    options: [],
    execute(message) {
        try {
            return message.reply('Pong!');
        } catch (error) {
            logger.error(`Ping command error: ${error.message}`, { error: error.message });
            return message.reply('❌ An error occurred.');
        }
    }
};