const sessionManager = require('../services/sessionManager');
const commands = require('../commands');

module.exports = {
    name: 'messageCreate',
    execute(message) {
        if (message.author.bot) return;

        const content = message.content.trim();
        const prefix = '!'; // could be moved to config later

        // Check if it's a valid command with the prefix
        if (content.startsWith(prefix)) {
            const commandName = content.slice(prefix.length); // e.g., 'start-session'

            const command = commands.get(commandName);
            if (command) {
                // Execute the command handler
                return command.execute(message);
            }
            // else: unknown command, optionally reply with help or ignore
        }

        // If not a command, continue attendance tracking (text-based)
        sessionManager.trackAttendance(message.author.id, message.channel.id);
    },
};