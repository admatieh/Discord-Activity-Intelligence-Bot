// core/commandExecutor.js
const commands = require('../commands');
const logger = require('../utils/logger');
const { parseArgs } = require('../utils/argParser');
const db = require('../database/db');
const { ChannelType } = require('discord.js');
const { toRoleCollection } = require('../utils/mockDiscord');

// Removed global mutex — it caused false "another command executing" errors
// Each command handles its own concurrency if needed

class MockChannel {
    constructor() {
        this.output = [];
    }
    send(message) {
        this.output.push(message);
        return Promise.resolve();
    }
}

class MockMessage {
    constructor(commandString, context) {
        this.content = commandString;
        this.author = {
            bot: false,
            id: context.user?.id || 'dashboard_user',
            tag: context.user?.username || 'Dashboard',
            username: context.user?.username || 'Dashboard'
        };

        const client = global.client;
        const cache = client?.channels?.cache;

        let voiceChannel = null;
        if (context.voiceChannelId && cache) {
            const vc = cache.get(context.voiceChannelId);
            if (
                vc &&
                (vc.type === ChannelType.GuildVoice || vc.type === ChannelType.GuildStageVoice)
            ) {
                voiceChannel = vc;
            }
        }

        const isTrustedDashboard = (context.source || 'dashboard') === 'dashboard';

        this.member = {
            id: context.user?.id || 'dashboard_user',
            user: {
                id: context.user?.id || 'dashboard_user',
                username: context.user?.username || 'Dashboard',
                tag: context.user?.username || 'Dashboard'
            },
            displayName: context.user?.displayName || context.user?.username || 'Dashboard',
            voice: { channel: voiceChannel },
            permissions: {
                has: () => isTrustedDashboard // Only trusted for internal API execution
            },
            roles: {
                // Discord.js expects member.roles.cache to be a Collection-like structure.
                // For dashboard/API execution we mimic enough of the API for permission helpers.
                cache: toRoleCollection(context.user?.roles)
            }
        };
        this.guild = {
            id: context.guild?.id || 'dashboard_guild',
            channels: {
                cache: {
                    get: (id) => global.client?.channels?.cache?.get(id),
                    find: (fn) => global.client?.channels?.cache?.find(fn)
                }
            }
        };

        const textId = context.textChannelId || context.channel?.id;
        let channelImpl = new MockChannel();
        if (textId && cache) {
            const real = cache.get(textId);
            if (
                real &&
                typeof real.isTextBased === 'function' &&
                real.isTextBased()
            ) {
                channelImpl = real;
            }
        }
        this.channel = channelImpl;
        this.output = [];
    }

    async reply(message) {
        this.output.push(message);
        return Promise.resolve();
    }
}

async function executeCommand(commandString, context) {
    const startMs = Date.now();

    try {
        const mockMessage = new MockMessage(commandString, context);
        const parsed = parseArgs(mockMessage);

        const commandName = parsed.command;
        const command = commands.get(commandName);

        if (!command) {
            throw new Error(`Unknown command: ${commandName}`);
        }

        // IMPORTANT: pass parsed.options as `args` so commands can do args.channel, args.duration etc.
        // Also pass parsed in context so commands using { parsed } destructuring still work.
        const result = await Promise.resolve(
            command.execute(mockMessage, parsed.options, {
                parsed,
                commands,
                source: context.source || 'dashboard',
                user: context.user,
                guild: context.guild
            })
        );

        const durationMs = Date.now() - startMs;

        // Collect output: from mockMessage.output array OR direct string return value
        const outputParts = [...mockMessage.output];
        if (result && typeof result === 'string') outputParts.push(result);
        const output = outputParts.join('\n');

        logExecutionToDb(context, commandString, durationMs, true, null);

        return {
            output: output || 'Command executed successfully with no output.',
            exitCode: 0,
            executionMs: durationMs,
            logs: [],
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        const durationMs = Date.now() - startMs;
        logger.error(`[COMMAND EXECUTOR] Error executing: ${commandString}`, { error: error.message });
        logExecutionToDb(context, commandString, durationMs, false, error.message);

        return {
            output: error.message,
            exitCode: 1,
            executionMs: durationMs,
            logs: [error.message],
            timestamp: new Date().toISOString()
        };
    }
}

function logExecutionToDb(context, commandString, durationMs, success, errorMsg) {
    try {
        const msg = success ? `Executed: ${commandString}` : `Failed: ${commandString} - ${errorMsg}`;
        const level = success ? 'info' : 'error';
        const source = `dashboard-executor-${context.user?.username || 'unknown'}`;

        const stmt = db.prepare('INSERT INTO logs (level, message, context) VALUES (?, ?, ?)');
        stmt.run(level, msg, JSON.stringify({
            source: context.source,
            durationMs,
            commandString,
            userId: context.user?.id
        }));
    } catch (err) {
        logger.error('Failed to log execution to DB', { error: err.message });
    }
}

module.exports = {
    executeCommand
};
