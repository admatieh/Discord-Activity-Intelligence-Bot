// events/messageCreate.js
//
// Event routing ONLY — parses commands and dispatches.
// No attendance tracking here (attendance is voice-based only).
// ---------------------------------------------------------------------------

const commands = require('../commands');
const logger = require('../utils/logger');
const { parseArgs } = require('../utils/argParser');

const PREFIX = '!';

module.exports = {
    name: 'messageCreate',
    execute(message) {
        if (message.author.bot) return;

        // Interaction Data Layer
        const interactionService = require('../modules/interaction/interactionService');
        interactionService.handleMessageCreate(message);

        const content = message.content.trim();
        if (!content.startsWith(PREFIX)) return;

        // Parse the full message into { command, positional, options }
        const parsed = parseArgs(message);
        const commandName = parsed.command;
        const command = commands.get(commandName);

        if (!command) return;

        try {
            // Pass parsed args + the commands map (for help system)
            command.execute(message, parsed.positional, {
                parsed,
                commands
            });
        } catch (error) {
            logger.error(`Command '${commandName}' threw an error: ${error.message}`, {
                commandName,
                error: error.message
            });
            message.reply('❌ An error occurred while executing that command.').catch(() => {});
        }
    }
};