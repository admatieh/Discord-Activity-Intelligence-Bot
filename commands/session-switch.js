// commands/session-switch.js
//
// Switch an active session to a different voice channel.
// Usage:
//   !session-switch --channel <#channel>  → move session to specified channel
//   !session-switch                       → switch to your current voice channel
// ---------------------------------------------------------------------------

const sessionService = require('../modules/sessions/sessionService');
const sessionModel = require('../models/sessionModel');
const { checkInstructor } = require('../utils/permissions');
const logger = require('../utils/logger');

module.exports = {
    name: 'session-switch',
    description: 'Move an active session to a different voice channel.',
    usage: '!session-switch --channel <#channel>',
    options: [
        { name: 'channel', type: 'channel', required: false, description: 'Target voice channel to switch to (default: your current voice channel)' }
    ],
    execute(message, _args, { parsed } = {}) {
        try {
            if (!message.guild) {
                return message.reply('❌ Server only.');
            }

            const perm = checkInstructor(message.member);
            if (!perm.allowed) return message.reply(perm.message);

            const options = parsed?.options || {};

            // Determine target channel
            let targetChannel = options.channel || message.member.voice?.channel;

            if (!targetChannel) {
                return message.reply('❌ You must be in a voice channel or specify one with `--channel`.');
            }

            // If channel was provided as a string name, resolve it
            if (typeof targetChannel === 'string') {
                const found = message.guild.channels.cache.find(
                    c => c.name.toLowerCase() === targetChannel.toLowerCase() && c.isVoiceBased()
                );
                if (!found) {
                    return message.reply(`❌ Voice channel "${targetChannel}" not found.`);
                }
                targetChannel = found;
            }

            // Validate it's a voice channel
            if (typeof targetChannel.isVoiceBased === 'function' && !targetChannel.isVoiceBased()) {
                return message.reply('❌ The specified channel is not a voice channel.');
            }

            // Find the active session to switch
            const userVoice = message.member.voice?.channel;
            let sessionId = null;

            if (userVoice) {
                sessionId = sessionService.getSessionId(userVoice.id);
            }

            if (!sessionId) {
                const activeSessions = sessionModel.getActiveSessions();
                if (activeSessions.length === 1) {
                    sessionId = activeSessions[0].id;
                } else if (activeSessions.length > 1) {
                    return message.reply('❌ Multiple active sessions. Join the voice channel of the session you want to switch.');
                }
            }

            if (!sessionId) {
                return message.reply('❌ No active session found to switch.');
            }

            const result = sessionService.switchSessionChannel(sessionId, targetChannel.id);
            return message.reply(result.message);
        } catch (error) {
            logger.error(`session-switch command error: ${error.message}`, { error: error.message });
            return message.reply('❌ An error occurred while switching the session channel.');
        }
    }
};
