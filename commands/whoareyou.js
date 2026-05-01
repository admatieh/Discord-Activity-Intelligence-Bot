// commands/whoareyou.js

const logger = require('../utils/logger');

module.exports = {
    name: 'whoareyou',
    description: 'Learn what this bot does.',
    usage: '!whoareyou',
    options: [],
    execute(message) {
        try {
            return message.reply(
                "I am a Discord-based bot created by Adam Abo Atieh that automatically monitors live sessions, " +
                "tracks attendance through voice channel activity, and evaluates engagement using message-based " +
                "participation signals. At the end of each session, I may generate a structured summary highlighting " +
                "attendance, engagement levels, and top contributors, providing instructors with a clear and immediate " +
                "overview of session dynamics."
            );
        } catch (error) {
            logger.error(`Whoareyou command error: ${error.message}`, { error: error.message });
            return message.reply('❌ An error occurred.');
        }
    }
};