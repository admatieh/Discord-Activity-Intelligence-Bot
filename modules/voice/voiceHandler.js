// modules/voice/voiceHandler.js
//
// Thin adapter between Discord voiceStateUpdate and the internal event bus.
// Detects join / leave / switch and emits events. No business logic.
// Switch = LEAVE(old) + JOIN(new). No separate VOICE_SWITCH event.
// ---------------------------------------------------------------------------

const { eventBus, Events } = require('../../core/eventBus');
const logger = require('../../utils/logger');

/**
 * Count non-bot members in a voice channel.
 * Returns 0 if channel is null/undefined.
 */
function countHumanMembers(channel) {
    if (!channel || !channel.members) return 0;
    return channel.members.filter(m => !m.user.bot).size;
}

/**
 * Handle the raw Discord voiceStateUpdate event.
 * Emits VOICE_JOIN / VOICE_LEAVE events onto the event bus.
 * Payloads follow standard format: { userId, channelId, sessionId, timestamp, ... }
 */
function handleVoiceStateUpdate(oldState, newState) {
    try {
        const userId = newState.id;
        const oldChannelId = oldState.channelId;
        const newChannelId = newState.channelId;
        const timestamp = new Date().toISOString();

        // Ignore bots
        if (newState.member?.user?.bot) return;

        // No channel change — mute/deafen/etc. — ignore
        if (oldChannelId === newChannelId) return;

        if (!oldChannelId && newChannelId) {
            // Join
            eventBus.emit(Events.VOICE_JOIN, { userId, channelId: newChannelId, sessionId: null, timestamp });
        } else if (oldChannelId && !newChannelId) {
            // Leave
            const remaining = countHumanMembers(oldState.channel);
            eventBus.emit(Events.VOICE_LEAVE, { userId, channelId: oldChannelId, sessionId: null, timestamp, remainingMembers: remaining });
        } else if (oldChannelId && newChannelId) {
            // Switch — emit leave then join
            const remaining = countHumanMembers(oldState.channel);
            eventBus.emit(Events.VOICE_LEAVE, { userId, channelId: oldChannelId, sessionId: null, timestamp, remainingMembers: remaining });
            eventBus.emit(Events.VOICE_JOIN, { userId, channelId: newChannelId, sessionId: null, timestamp });
        }
    } catch (error) {
        logger.error(`voiceHandler error: ${error.message}`, {
            error: error.message
        });
    }
}

module.exports = { handleVoiceStateUpdate };
