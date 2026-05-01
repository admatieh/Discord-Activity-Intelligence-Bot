// commands/help.js
//
// Dynamic help system that reads command metadata at runtime.
// ---------------------------------------------------------------------------

const logger = require('../utils/logger');

module.exports = {
    name: 'help',
    description: 'Show a list of all commands or details about a specific command.',
    usage: '!help [--command <name>]',
    options: [
        { name: 'command', type: 'string', required: false, description: 'Command name to get detailed help for' }
    ],
    execute(message, _args, { commands, parsed } = {}) {
        try {
            if (!commands) {
                return message.reply('❌ Help system unavailable.');
            }

            // Determine target command: --command flag or first positional arg
            const target = parsed?.options?.command
                || (parsed?.positional?.[0])
                || null;

            // Detailed help for a specific command
            if (target) {
                const cmd = commands.get(target.toLowerCase());
                if (!cmd) {
                    return message.reply(`❌ Unknown command: \`${target}\`. Use \`!help\` to see all commands.`);
                }
                return message.reply(formatCommandDetail(cmd));
            }

            // General help — list all commands
            const lines = ['📖 **Available Commands:**\n'];

            for (const [, cmd] of commands) {
                const desc = cmd.description || 'No description.';
                lines.push(`▸ \`!${cmd.name}\` — ${desc}`);
            }

            lines.push('\n_Use `!help <command>` for detailed info on a specific command._');

            return message.reply(lines.join('\n'));
        } catch (error) {
            logger.error(`Help command error: ${error.message}`, { error: error.message });
            return message.reply('❌ An error occurred while displaying help.');
        }
    }
};

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatCommandDetail(cmd) {
    const lines = [
        `📘 **Command: ${cmd.name}**`,
        `**Description:** ${cmd.description || 'No description.'}`,
        `**Usage:**\n\`${cmd.usage || `!${cmd.name}`}\``
    ];

    if (cmd.options && cmd.options.length > 0) {
        lines.push('\n**Options:**');
        for (const opt of cmd.options) {
            const required = opt.required ? '(required)' : '(optional)';
            const desc = opt.description ? ` — ${opt.description}` : '';
            lines.push(`  \`--${opt.name}\`  ${opt.type}  ${required}${desc}`);
        }
    }

    return lines.join('\n');
}
