// commands/session-start.js
const sessionService = require('../modules/sessions/sessionService');
const { DEFAULT_SESSION_DURATION } = require('../config/constants');
const { checkInstructor } = require('../utils/permissions');

module.exports = {
    name: 'session-start',
    execute(message, args) {
        if (!message.guild) {
            return message.reply('❌ Server only.');
        }

        const perm = checkInstructor(message.member);
        if (!perm.allowed) return message.reply(perm.message);

        const voiceChannel = message.member.voice?.channel;
        if (!voiceChannel) {
            return message.reply('❌ You must be in a voice channel.');
        }

        let duration = DEFAULT_SESSION_DURATION;
        if (args && args.length > 0) {
            const parsed = parseInt(args[0], 10);
            if (!isNaN(parsed) && parsed > 0) duration = parsed;
        }

        const result = sessionService.startSession(voiceChannel.id, message.author.tag, {
            durationMinutes: duration
        });
        return message.reply(result.message);
    }
};
