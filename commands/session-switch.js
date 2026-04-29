// commands/session-switch.js
const sessionManager = require('../services/sessionManager');
const { checkInstructor } = require('../utils/permissions');

module.exports = {
    name: 'session-switch',
    execute(message, args) {
        if (!message.guild) {
            return message.reply('❌ Server only.');
        }

        const perm = checkInstructor(message.member);
        if (!perm.allowed) return message.reply(perm.message);

        // Determine target channel
        let targetChannel;

        if (!args || args.length === 0 || args[0].toLowerCase() === 'here') {
            // !session-switch or !session-switch here → user's current voice channel
            targetChannel = message.member.voice?.channel;
            if (!targetChannel) {
                return message.reply('❌ You must be in a voice channel.');
            }
        } else {
            // !session-switch <channel name>
            const channelName = args.join(' ').toLowerCase();
            targetChannel = message.guild.channels.cache.find(
                c => c.name.toLowerCase() === channelName && c.isVoiceBased()
            );
            if (!targetChannel) {
                return message.reply(`❌ Voice channel "${channelName}" not found.`);
            }
        }

        // Find the active session to switch (any active session the user controls)
        // First try user's current voice channel, then try any active session
        const userVoice = message.member.voice?.channel;
        let sessionId = null;

        if (userVoice) {
            sessionId = sessionManager.getSessionId(userVoice.id);
        }

        if (!sessionId) {
            // Fallback: find any active session
            const sessionModel = require('../models/sessionModel');
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

        const result = sessionManager.switchSessionChannel(sessionId, targetChannel.id);
        return message.reply(result.message);
    }
};
