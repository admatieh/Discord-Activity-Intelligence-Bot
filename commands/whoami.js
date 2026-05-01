// commands/whoami.js

const logger = require('../utils/logger');

module.exports = {
    name: 'whoami',
    description: 'Display your Discord identity.',
    usage: '!whoami',
    options: [],
    execute(message) {
        try {
            return message.reply(`You are ${message.author}`);
        } catch (error) {
            logger.error(`Whoami command error: ${error.message}`, { error: error.message });
            return message.reply('❌ An error occurred.');
        }
    }
};