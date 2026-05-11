// commands/help.js
//
// Dynamic, professional command explorer.
// Groups commands by category, supports filtering, and provides detailed help.
//
// Usage:
//   !help
//   !help --category <name>
//   !help --command <name>
// ---------------------------------------------------------------------------

const logger = require('../utils/logger');

const MAX_PER_CATEGORY = 15;

module.exports = {
    name: 'help',
    category: 'general',
    requiredPermission: 'public',
    aliases: ['h', 'commands'],
    description: 'Show a list of all commands or details about a specific command/category.',
    usage: '!help [--category <name>] [--command <name>]',
    options: [
        { name: 'category', type: 'string', required: false, description: 'Filter commands by category (e.g., session, participation)' },
        { name: 'command',  type: 'string', required: false, description: 'Command name to get detailed help for' }
    ],
    async execute(message, _args, { commands, parsed } = {}) {
        try {
            if (!commands) {
                return message.reply('❌ Help system unavailable.');
            }

            const { checkInstructor, checkBotAdmin } = require('../utils/permissions');
            const isInstructor = checkInstructor(message.member).allowed;
            const isAdmin = checkBotAdmin(message.member).allowed;

            const options = parsed?.options || {};
            const targetCommand = options.command || (parsed?.positional?.[0]);
            const targetCategory = options.category;

            // Extract unique primary commands
            const uniqueCommands = new Set();
            for (const [key, cmd] of commands.entries()) {
                if (key === cmd.name.toLowerCase()) {
                    // Filter out commands based on permissions
                    if (!isInstructor && cmd.requiredPermission !== 'public') continue;
                    if (!isAdmin && cmd.requiredPermission === 'admin') continue;
                    uniqueCommands.add(cmd);
                }
            }

            // 1. Detailed help for a specific command
            if (targetCommand) {
                const cmd = commands.get(targetCommand.toLowerCase());
                const isHidden = !cmd || (!isInstructor && cmd.requiredPermission !== 'public') || (!isAdmin && cmd.requiredPermission === 'admin');
                if (isHidden) {
                    return message.reply(`❌ Command not found: \`${targetCommand}\`.`);
                }
                return message.reply(formatCommandDetail(cmd));
            }

            // 2. Filter by category
            if (targetCategory) {
                const cat = targetCategory.toLowerCase();
                const categoryCmds = Array.from(uniqueCommands).filter(c => c.category === cat && !c.hidden);
                
                if (categoryCmds.length === 0) {
                    return message.reply(`⚠️ No commands found in category: \`${targetCategory}\`.`);
                }

                let output = `📦 **${cat.toUpperCase()} COMMANDS**\n\n`;
                for (const cmd of categoryCmds) {
                    output += `▸ \`!${cmd.name}\` — ${cmd.description || 'No description'}\n`;
                }
                return message.reply(output);
            }

            // 3. General help — group by category
            const grouped = {};
            for (const cmd of uniqueCommands) {
                if (cmd.hidden) continue;
                const cat = cmd.category || 'general';
                if (!grouped[cat]) grouped[cat] = [];
                grouped[cat].push(cmd);
            }

            // Sort categories (general first, then alphabetically)
            const sortedCategories = Object.keys(grouped).sort((a, b) => {
                if (a === 'general') return -1;
                if (b === 'general') return 1;
                return a.localeCompare(b);
            });

            const lines = ['📖 **Command Explorer**\n_Use `!help --command <name>` for details._\n'];

            for (const cat of sortedCategories) {
                lines.push(`📦 **${cat.toUpperCase()} COMMANDS**`);
                const cmds = grouped[cat];
                
                const showCmds = cmds.slice(0, MAX_PER_CATEGORY);
                for (const cmd of showCmds) {
                    lines.push(`- \`${cmd.name}\` — ${cmd.description || 'No description.'}`);
                }

                if (cmds.length > MAX_PER_CATEGORY) {
                    lines.push(`_... +${cmds.length - MAX_PER_CATEGORY} more. Use \`!help --category ${cat}\` to see all._`);
                }
                lines.push(''); // blank line
            }

            const fullText = lines.join('\n').trim();
            
            if (fullText.length <= 1900) {
                return await message.reply(fullText);
            }

            const chunks = [];
            let currentChunk = '';
            for (const line of lines) {
                if (currentChunk.length + line.length + 1 > 1900) {
                    chunks.push(currentChunk);
                    currentChunk = line;
                } else {
                    currentChunk += (currentChunk ? '\n' : '') + line;
                }
            }
            if (currentChunk) chunks.push(currentChunk);

            await message.reply(chunks[0]);
            for (let i = 1; i < chunks.length; i++) {
                await message.channel.send(chunks[i]);
            }
            return true;
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
        `**Usage:** \`${cmd.usage || `!${cmd.name}`}\``
    ];

    if (cmd.aliases && cmd.aliases.length > 0) {
        lines.push(`**Aliases:** ${cmd.aliases.join(', ')}`);
    }

    if (cmd.options && cmd.options.length > 0) {
        lines.push('\n**Options:**');
        for (const opt of cmd.options) {
            const req = opt.required ? '(required)' : `(${opt.type})`;
            const desc = opt.description ? `  ${opt.description}` : '';
            lines.push(`  \`--${opt.name.padEnd(10)}\` ${req.padEnd(12)} ${desc}`);
        }
    }

    return lines.join('\n');
}
