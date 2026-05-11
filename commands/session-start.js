const { requireInstructor } = require('../utils/permissions');
// commands/session-start.js
//
// Start a voice tracking session with named arguments.
// Usage: !session-start --duration <minutes> --channel <#channel>
// ---------------------------------------------------------------------------

const sessionService = require('../modules/sessions/sessionService');
const { DEFAULT_SESSION_DURATION } = require('../config/constants');
const logger = require('../utils/logger');

module.exports = {
    name: 'session-start',
    category: 'session',
    requiredPermission: 'instructor',
    aliases: ['start'],
    description: 'Start a voice tracking session in a channel.',
    usage: '!session-start --duration <minutes> --channel <#channel>',
    options: [
        { name: 'duration', type: 'number', required: false, description: 'Session length in minutes (default: 60)' },
        { name: 'channel', type: 'channel', required: false, description: 'Target voice channel (default: your current voice channel)' }
    ],
    async execute(message, _args, { parsed } = {}) {
        const permission = await requireInstructor(message);
        if (!permission.allowed) return message.reply(permission.message);

        try {
            if (!message.guild) {
                return message.reply('❌ Server only.');
            }

            const options = parsed?.options || {};

            // Resolve channel
            let voiceChannel = options.channel || message.member.voice?.channel;

            if (!voiceChannel) {
                return message.reply('❌ You must be in a voice channel or specify one with `--channel`.');
            }

            // Validate that the resolved channel is voice-based
            if (typeof voiceChannel === 'object' && typeof voiceChannel.isVoiceBased === 'function') {
                if (!voiceChannel.isVoiceBased()) {
                    return message.reply('❌ The specified channel is not a voice channel.');
                }
            }

            // Resolve duration
            let duration = DEFAULT_SESSION_DURATION;
            if (options.duration !== undefined) {
                const parsed = Number(options.duration);
                if (isNaN(parsed) || parsed <= 0) {
                    return message.reply('❌ Duration must be a positive number (minutes).');
                }
                duration = parsed;
            }

            const result = sessionService.startSession(voiceChannel.id, message.author.tag, {
                durationMinutes: duration
            });

            if (result.success) {
                sessionService.bootstrapChannelUsers(voiceChannel, result.sessionId);
                sessionService.ensureChannelState(voiceChannel);
            }

            return message.reply(result.message);
        } catch (error) {
            logger.error(`session-start command error: ${error.message}`, { error: error.message });
            return message.reply('❌ An error occurred while starting the session.');
        }
    }
};
