// commands/session-end.js
const sessionService = require('../modules/sessions/sessionService');
const { checkInstructor } = require('../utils/permissions');

module.exports = {
    name: 'session-end',
    execute(message, args) {
        if (!message.guild) {
            return message.reply('❌ Server only.');
        }

        const perm = checkInstructor(message.member);
        if (!perm.allowed) return message.reply(perm.message);

        // No args → end session in user's current voice channel
        if (!args || args.length === 0) {
            const voiceChannel = message.member.voice?.channel;
            if (!voiceChannel) {
                return message.reply('❌ You must be in a voice channel, or specify a target.');
            }
            const result = sessionService.endSession(voiceChannel.id);
            return message.reply(result.message);
        }

        const sub = args[0].toLowerCase();

        // !session-end all
        if (sub === 'all') {
            const result = sessionService.endAllSessions();
            return message.reply(result.message);
        }

        // !session-end here
        if (sub === 'here') {
            const voiceChannel = message.member.voice?.channel;
            if (!voiceChannel) {
                return message.reply('❌ You must be in a voice channel.');
            }
            const result = sessionService.endSession(voiceChannel.id);
            return message.reply(result.message);
        }

        // !session-end <sessionId> (number)
        const sessionId = parseInt(sub, 10);
        if (!isNaN(sessionId)) {
            const result = sessionService.endSessionById(sessionId, 'Manual end');
            return message.reply(result.message);
        }

        // !session-end <channel name>
        const channelName = args.join(' ').toLowerCase();
        const voiceChannel = message.guild.channels.cache.find(
            c => c.name.toLowerCase() === channelName && c.isVoiceBased()
        );
        if (!voiceChannel) {
            return message.reply(`❌ Voice channel "${channelName}" not found.`);
        }
        const result = sessionService.endSession(voiceChannel.id);
        return message.reply(result.message);
    }
};
