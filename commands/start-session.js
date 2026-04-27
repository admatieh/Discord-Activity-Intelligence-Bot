const sessionManager = require('../services/sessionManager');

module.exports = {
    name: 'start-session',
    execute(message) {
        if (!message.guild) {
            return message.reply('❌ Sessions can only be started inside a server channel.');
        }
        const result = sessionManager.startSession(message.channel.id, message.author.tag);
        return message.reply(result.message);
    }
};