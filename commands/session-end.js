const { requireInstructor } = require('../utils/permissions');
// commands/session-end.js
//
// End a voice tracking session with named arguments.
// Usage:
//   !session-end                       → end session in your voice channel
//   !session-end --target all          → end all active sessions
//   !session-end --target here         → end session in your voice channel
//   !session-end --id <sessionId>      → end a specific session by ID
//   !session-end --channel <#channel>  → end session in a specific channel
// ---------------------------------------------------------------------------

const sessionService = require('../modules/sessions/sessionService');
const logger = require('../utils/logger');

module.exports = {
    name: 'session-end',
    category: 'session',
    requiredPermission: 'instructor',
    aliases: ['stop', 'end'],
    description: 'End an active voice tracking session.',
    usage: '!session-end [--target all|here] [--id <sessionId>] [--channel <#channel>]',
    options: [
        { name: 'target', type: 'string', required: false, description: '"all" to end all sessions, "here" to end in your channel' },
        { name: 'id', type: 'number', required: false, description: 'Specific session ID to end' },
        { name: 'channel', type: 'channel', required: false, description: 'Target voice channel to end session in' }
    ],
    async execute(message, _args, { parsed } = {}) {
        const permission = await requireInstructor(message);
        if (!permission.allowed) return message.reply(permission.message);

        try {
            if (!message.guild) {
                return message.reply('❌ Server only.');
            }

            const options = parsed?.options || {};

            // --target all
            if (options.target === 'all') {
                const result = sessionService.endAllSessions();
                return message.reply(result.message);
            }

            // --id <sessionId>
            if (options.id !== undefined) {
                const sessionId = Number(options.id);
                if (isNaN(sessionId)) {
                    return message.reply('❌ Session ID must be a number.');
                }
                const result = sessionService.endSessionById(sessionId, 'Manual end');
                return message.reply(result.message);
            }

            // --channel <#channel>
            if (options.channel) {
                const ch = options.channel;
                if (typeof ch === 'object' && typeof ch.isVoiceBased === 'function') {
                    if (!ch.isVoiceBased()) {
                        return message.reply('❌ The specified channel is not a voice channel.');
                    }
                    const result = sessionService.endSession(ch.id);
                    return message.reply(result.message);
                }
                // Channel was passed as a string name — try to find it
                const found = message.guild.channels.cache.find(
                    c => c.name.toLowerCase() === String(ch).toLowerCase() && c.isVoiceBased()
                );
                if (!found) {
                    return message.reply(`❌ Voice channel "${ch}" not found.`);
                }
                const result = sessionService.endSession(found.id);
                return message.reply(result.message);
            }

            // Default (--target here or no args): end session in user's voice channel
            const voiceChannel = message.member.voice?.channel;
            if (!voiceChannel) {
                return message.reply('❌ You must be in a voice channel, or specify a target with `--channel`, `--id`, or `--target all`.');
            }
            const result = sessionService.endSession(voiceChannel.id);
            return message.reply(result.message);
        } catch (error) {
            logger.error(`session-end command error: ${error.message}`, { error: error.message });
            return message.reply('❌ An error occurred while ending the session.');
        }
    }
};
