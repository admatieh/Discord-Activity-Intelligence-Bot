// services/attendanceTracker.js
//
// Responsibilities (ONLY):
//   - Handle voice join / leave / channel-switch events
//   - Record attendance (unique users) + voice event intervals
//   - Trigger empty-channel grace when channel empties
//
// Does NOT manage sessions. Uses sessionManager only to check active state.
// All DB access goes through models.
// ---------------------------------------------------------------------------

const sessionManager = require('./sessionManager');
const attendanceModel = require('../models/attendanceModel');
const voiceEventModel = require('../models/voiceEventModel');
const logger = require('../utils/logger');

// ---------------------------------------------------------------------------
// handleVoiceJoin
// ---------------------------------------------------------------------------

function handleVoiceJoin(userId, channelId) {
    try {
        if (!sessionManager.isSessionActive(channelId)) return;

        const sessionId = sessionManager.getSessionId(channelId);
        if (!sessionId) return;

        // Cancel empty-channel grace if someone rejoined
        sessionManager.cancelEmptyGrace(channelId);

        const now = new Date().toISOString();

        // Register as attendee (idempotent)
        attendanceModel.addAttendee(sessionId, userId);

        // Open a new voice event interval
        voiceEventModel.createJoinEvent(sessionId, userId, now);

        logger.log(`User ${userId} joined tracked channel ${channelId} (session #${sessionId}).`, {
            event: 'voice_join',
            userId,
            channelId,
            sessionId
        });
    } catch (error) {
        logger.error(`attendanceTracker.handleVoiceJoin error: ${error.message}`, {
            userId,
            channelId,
            error: error.message
        });
    }
}

// ---------------------------------------------------------------------------
// handleVoiceLeave
// ---------------------------------------------------------------------------

function handleVoiceLeave(userId, channelId, remainingMembers) {
    try {
        if (!sessionManager.isSessionActive(channelId)) return;

        const sessionId = sessionManager.getSessionId(channelId);
        if (!sessionId) return;

        const now = new Date().toISOString();

        const closed = voiceEventModel.closeOpenEvent(sessionId, userId, now);

        if (closed) {
            logger.log(`User ${userId} left tracked channel ${channelId} (session #${sessionId}).`, {
                event: 'voice_leave',
                userId,
                channelId,
                sessionId
            });
        }

        // If channel is now empty, start grace timer
        if (typeof remainingMembers === 'number' && remainingMembers === 0) {
            sessionManager.startEmptyGrace(channelId);
        }
    } catch (error) {
        logger.error(`attendanceTracker.handleVoiceLeave error: ${error.message}`, {
            userId,
            channelId,
            error: error.message
        });
    }
}

// ---------------------------------------------------------------------------
// handleVoiceSwitch
// ---------------------------------------------------------------------------

function handleVoiceSwitch(userId, oldChannelId, newChannelId, oldChannelRemainingMembers) {
    try {
        handleVoiceLeave(userId, oldChannelId, oldChannelRemainingMembers);
        handleVoiceJoin(userId, newChannelId);
    } catch (error) {
        logger.error(`attendanceTracker.handleVoiceSwitch error: ${error.message}`, {
            userId,
            oldChannelId,
            newChannelId,
            error: error.message
        });
    }
}

module.exports = {
    handleVoiceJoin,
    handleVoiceLeave,
    handleVoiceSwitch
};