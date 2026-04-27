const logger = require('../utils/logger');

// In-memory state (private to this module)
let sessionActive = false;
let sessionChannelId = null;
let attendees = new Set();

function startSession(channelId, triggeredBy) {
    if (sessionActive) {
        return { success: false, message: '⚠️ A session is already running.' };
    }
    sessionActive = true;
    sessionChannelId = channelId;
    attendees.clear();
    logger.log(`Session started by ${triggeredBy} in channel ${channelId}`);
    return { success: true, message: '✅ Session started successfully. Attendance tracking is now active.' };
}

function endSession() {
    if (!sessionActive) {
        return { success: false, message: '❌ No active session to end.' };
    }
    const totalAttendees = attendees.size;
    sessionActive = false;
    sessionChannelId = null;
    attendees.clear();
    logger.log(`Session ended. Total attendees: ${totalAttendees}`);
    return { success: true, message: `🧾 Session ended. Total attendees: ${totalAttendees}` };
}

function trackAttendance(userId, channelId) {
    if (!sessionActive) return false;
    if (channelId !== sessionChannelId) return false;
    attendees.add(userId);
    return true;
}

function isSessionActive() {
    return sessionActive;
}

function getSessionChannelId() {
    return sessionChannelId;
}

module.exports = {
    startSession,
    endSession,
    trackAttendance,
    isSessionActive,
    getSessionChannelId,
};