// commands/session-switch.js
const sessionService = require('../modules/sessions/sessionService');
const sessionModel = require('../models/sessionModel');
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
            targetChannel = message.member.voice?.channel;
            if (!targetChannel) {
                return message.reply('❌ You must be in a voice channel.');
            }
        } else {
            const channelName = args.join(' ').toLowerCase();
            targetChannel = message.guild.channels.cache.find(
                c => c.name.toLowerCase() === channelName && c.isVoiceBased()
            );
            if (!targetChannel) {
                return message.reply(`❌ Voice channel "${channelName}" not found.`);
            }
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
    }
};
