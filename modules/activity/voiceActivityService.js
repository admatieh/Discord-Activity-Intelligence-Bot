// modules/activity/voiceActivityService.js
//
// Responsibilities:
//   - Track user speaking behavior (voice activity intervals).
//   - Open intervals on VOICE_UNMUTE and VOICE_JOIN (if unmuted).
//   - Close intervals on VOICE_MUTE, VOICE_LEAVE, and SESSION_ENDED.
// ---------------------------------------------------------------------------

const { eventBus, Events } = require('../../core/eventBus');
const voiceActivityModel = require('../../models/voiceActivityModel');
const sessionService = require('../sessions/sessionService');
const logger = require('../../utils/logger');

let initialized = false;

function handleStartInterval({ userId, channelId, sessionId, timestamp }) {
    try {
        const activeSessionId = sessionId || sessionService.getSessionId(channelId);
        if (!activeSessionId) return; // No active session, do not track

        const openInterval = voiceActivityModel.getOpenInterval(activeSessionId, userId);
        if (openInterval) return; // Prevent duplicate open intervals

        const id = voiceActivityModel.createStart(activeSessionId, userId, timestamp);
        if (id) {
            logger.log(`Voice activity interval started for user ${userId} in session #${activeSessionId}`, {
                userId,
                channelId,
                sessionId: activeSessionId
            });
        }
    } catch (error) {
        logger.error(`voiceActivityService start interval error: ${error.message}`);
    }
}

function handleCloseInterval({ userId, channelId, sessionId, timestamp }) {
    try {
        const activeSessionId = sessionId || sessionService.getSessionId(channelId);
        if (!activeSessionId) return; // No active session

        const closed = voiceActivityModel.closeOpenInterval(activeSessionId, userId, timestamp);
        if (closed) {
            logger.log(`Voice activity interval closed for user ${userId} in session #${activeSessionId}`, {
                userId,
                channelId,
                sessionId: activeSessionId
            });
        }
    } catch (error) {
        logger.error(`voiceActivityService close interval error: ${error.message}`);
    }
}

function handleSessionEnded({ sessionId, timestamp }) {
    try {
        const closedCount = voiceActivityModel.closeAllOpenIntervals(sessionId, timestamp);
        if (closedCount > 0) {
            logger.log(`Closed ${closedCount} open voice activity intervals for ended session #${sessionId}`);
        }
    } catch (error) {
        logger.error(`voiceActivityService handleSessionEnded error: ${error.message}`);
    }
}

function register() {
    if (initialized) return;
    initialized = true;

    eventBus.on(Events.VOICE_UNMUTE, (payload) => {
        handleStartInterval(payload);
    });

    eventBus.on(Events.VOICE_MUTE, (payload) => {
        handleCloseInterval(payload);
    });

    eventBus.on(Events.VOICE_JOIN, (payload) => {
        // If they join already unmuted, start an interval
        if (payload.isMuted === false) {
            handleStartInterval(payload);
        }
    });

    eventBus.on(Events.VOICE_LEAVE, (payload) => {
        handleCloseInterval(payload);
    });

    eventBus.on(Events.SESSION_ENDED, (payload) => {
        handleSessionEnded(payload);
    });

    logger.log('VoiceActivityService registered on event bus.');
}

module.exports = { register };
