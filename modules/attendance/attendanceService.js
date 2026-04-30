// modules/attendance/attendanceService.js
//
// Responsibilities (ONLY):
//   - Record attendance (unique users) on VOICE_JOIN
//   - Record voice event intervals (join/leave)
//   - Trigger empty-channel grace when channel empties
//
// Listens to: VOICE_JOIN, VOICE_LEAVE
// Does NOT manage sessions. Uses sessionService only to check active state.
// All DB access goes through models.
// ---------------------------------------------------------------------------

const sessionService = require('../sessions/sessionService');
const attendanceModel = require('../../models/attendanceModel');
const voiceEventModel = require('../../models/voiceEventModel');
const logger = require('../../utils/logger');
const { eventBus, Events } = require('../../core/eventBus');

let initialized = false;

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

function onVoiceJoin({ userId, channelId, timestamp }) {
    try {
        if (!sessionService.isSessionActive(channelId)) return;

        const sessionId = sessionService.getSessionId(channelId);
        if (!sessionId) return;

        // Cancel empty-channel grace if someone rejoined
        sessionService.cancelEmptyGrace(channelId);

        const now = timestamp || new Date().toISOString();

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
        logger.error(`attendanceService.onVoiceJoin error: ${error.message}`, {
            userId,
            channelId,
            error: error.message
        });
    }
}

function onVoiceLeave({ userId, channelId, timestamp, remainingMembers }) {
    try {
        if (!sessionService.isSessionActive(channelId)) return;

        const sessionId = sessionService.getSessionId(channelId);
        if (!sessionId) return;

        const now = timestamp || new Date().toISOString();

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
            sessionService.startEmptyGrace(channelId);
        }
    } catch (error) {
        logger.error(`attendanceService.onVoiceLeave error: ${error.message}`, {
            userId,
            channelId,
            error: error.message
        });
    }
}

// ---------------------------------------------------------------------------
// Register listeners (once only)
// ---------------------------------------------------------------------------

function register() {
    if (initialized) return;
    initialized = true;

    eventBus.on(Events.VOICE_JOIN, (payload) => {
        try { onVoiceJoin(payload); } catch (err) {
            logger.error(`attendanceService VOICE_JOIN listener crash: ${err.message}`);
        }
    });

    eventBus.on(Events.VOICE_LEAVE, (payload) => {
        try { onVoiceLeave(payload); } catch (err) {
            logger.error(`attendanceService VOICE_LEAVE listener crash: ${err.message}`);
        }
    });

    logger.log('AttendanceService registered on event bus.');
}

module.exports = { register };
