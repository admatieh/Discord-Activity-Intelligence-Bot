// events/messageCreate.js
//
// Event routing ONLY — parses commands and dispatches.
// No attendance tracking here (attendance is voice-based only).
// ---------------------------------------------------------------------------

const commands = require('../commands');
const logger = require('../utils/logger');

const PREFIX = '!';

module.exports = {
    name: 'messageCreate',
    execute(message) {
        if (message.author.bot) return;

        const content = message.content.trim();
        if (!content.startsWith(PREFIX)) return;

        const args = content.slice(PREFIX.length).split(/ +/);
        const commandName = args.shift().toLowerCase();
        const command = commands.get(commandName);

        if (!command) return;

        try {
            command.execute(message, args);
        } catch (error) {
            logger.error(`Command '${commandName}' threw an error: ${error.message}`, {
                commandName,
                error: error.message
            });
            message.reply('❌ An error occurred while executing that command.').catch(() => {});
        }
    }
};