// events/voiceStateUpdate.js
//
// Event routing ONLY — no business logic here.
// Detects join / leave / switch and delegates to attendanceTracker.
// Passes remaining member count so empty-channel detection works.
// ---------------------------------------------------------------------------

const attendanceTracker = require('../services/attendanceTracker');
const logger = require('../utils/logger');

module.exports = {
    name: 'voiceStateUpdate',
    execute(oldState, newState) {
        try {
            const userId = newState.id;
            const oldChannelId = oldState.channelId;
            const newChannelId = newState.channelId;

            // Ignore bots
            if (newState.member?.user?.bot) return;

            // No channel change — mute/deafen/etc. — ignore
            if (oldChannelId === newChannelId) return;

            if (!oldChannelId && newChannelId) {
                // Join
                attendanceTracker.handleVoiceJoin(userId, newChannelId);
            } else if (oldChannelId && !newChannelId) {
                // Leave — count remaining non-bot members
                const remaining = countHumanMembers(oldState.channel);
                attendanceTracker.handleVoiceLeave(userId, oldChannelId, remaining);
            } else if (oldChannelId && newChannelId) {
                // Switch
                const remaining = countHumanMembers(oldState.channel);
                attendanceTracker.handleVoiceSwitch(userId, oldChannelId, newChannelId, remaining);
            }
        } catch (error) {
            logger.error(`voiceStateUpdate event error: ${error.message}`, {
                error: error.message
            });
        }
    }
};

/**
 * Count non-bot members in a voice channel.
 * Returns 0 if channel is null/undefined.
 */
function countHumanMembers(channel) {
    if (!channel || !channel.members) return 0;
    return channel.members.filter(m => !m.user.bot).size;
}
