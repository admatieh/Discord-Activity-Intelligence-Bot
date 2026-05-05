// modules/voice/voiceHandler.js
//
// Thin adapter between Discord voiceStateUpdate and the internal event bus.
// Detects join / leave / switch and emits events. No business logic.
// Switch = LEAVE(old) + JOIN(new). No separate VOICE_SWITCH event.
// ---------------------------------------------------------------------------

const { eventBus, Events } = require('../../core/eventBus');
const { safeEmit } = require('../../utils/safeEmit');
const sessionService = require('../sessions/sessionService');
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

        const isMuted = newState.selfMute || newState.serverMute;

        const oldSessionId = oldChannelId && sessionService.isSessionActive(oldChannelId) ? sessionService.getSessionId(oldChannelId) : null;
        const newSessionId = newChannelId && sessionService.isSessionActive(newChannelId) ? sessionService.getSessionId(newChannelId) : null;

        // No channel change — mute/deafen/etc.
        if (oldChannelId === newChannelId) {
            const wasMuted = oldState.selfMute || oldState.serverMute;
            if (wasMuted !== isMuted) {
                if (newSessionId) {
                    if (!wasMuted && isMuted) {
                        safeEmit(eventBus, Events.VOICE_MUTE, { userId, channelId: newChannelId, sessionId: newSessionId, timestamp });
                    } else if (wasMuted && !isMuted) {
                        safeEmit(eventBus, Events.VOICE_UNMUTE, { userId, channelId: newChannelId, sessionId: newSessionId, timestamp });
                    }
                }
            }
            return;
        }

        if (!oldChannelId && newChannelId) {
            // Join
            logger.log(`Emitting VOICE_JOIN with sessionId=${newSessionId}`);
            safeEmit(eventBus, Events.VOICE_JOIN, { userId, channelId: newChannelId, sessionId: newSessionId, timestamp, isMuted });
        } else if (oldChannelId && !newChannelId) {
            // Leave
            const remaining = countHumanMembers(oldState.channel);
            safeEmit(eventBus, Events.VOICE_LEAVE, { userId, channelId: oldChannelId, sessionId: oldSessionId, timestamp, remainingMembers: remaining });
        } else if (oldChannelId && newChannelId) {
            // Switch — emit leave then join
            const remaining = countHumanMembers(oldState.channel);
            safeEmit(eventBus, Events.VOICE_LEAVE, { userId, channelId: oldChannelId, sessionId: oldSessionId, timestamp, remainingMembers: remaining });
            logger.log(`Emitting VOICE_JOIN with sessionId=${newSessionId}`);
            safeEmit(eventBus, Events.VOICE_JOIN, { userId, channelId: newChannelId, sessionId: newSessionId, timestamp, isMuted });
        }
    } catch (error) {
        logger.error(`voiceHandler error: ${error.message}`, {
            error: error.message
        });
    }
}

module.exports = { handleVoiceStateUpdate };
