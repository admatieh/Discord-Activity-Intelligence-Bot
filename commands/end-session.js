const sessionManager = require('../services/sessionManager');

module.exports = {
    name: 'end-session',
    execute(message) {
        if (!message.guild) {
            return message.reply('❌ Sessions can only be ended inside a server channel.');
        }
        const result = sessionManager.endSession();
        return message.reply(result.message);
    }
};