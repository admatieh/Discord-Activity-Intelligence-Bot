// models/attendanceModel.js
const db = require('../database/db');
const logger = require('../utils/logger');

/**
 * Register a user as an attendee of a session.
 * Uses INSERT OR IGNORE to avoid duplicates (composite PK).
 */
function addAttendee(sessionId, userId) {
    try {
        db.prepare(
            'INSERT OR IGNORE INTO attendees (session_id, user_id) VALUES (?, ?)'
        ).run(sessionId, userId);
        return true;
    } catch (error) {
        logger.error(`attendanceModel.addAttendee error: ${error.message}`);
        return false;
    }
}

/**
 * Get all attendee user IDs for a given session.
 */
function getAttendeesBySession(sessionId) {
    try {
        return db.prepare(
            'SELECT user_id FROM attendees WHERE session_id = ? ORDER BY user_id ASC'
        ).all(sessionId);
    } catch (error) {
        logger.error(`attendanceModel.getAttendeesBySession error: ${error.message}`);
        return [];
    }
}

/**
 * Get attendee count for a session.
 */
function getAttendeeCount(sessionId) {
    try {
        const row = db.prepare(
            'SELECT COUNT(*) as count FROM attendees WHERE session_id = ?'
        ).get(sessionId);
        return row ? row.count : 0;
    } catch (error) {
        logger.error(`attendanceModel.getAttendeeCount error: ${error.message}`);
        return 0;
    }
}

/**
 * Check if a user is an attendee of a session.
 */
function isUserAttendee(sessionId, userId) {
    try {
        const row = db.prepare(
            'SELECT 1 FROM attendees WHERE session_id = ? AND user_id = ?'
        ).get(sessionId, userId);
        return !!row;
    } catch (error) {
        logger.error(`attendanceModel.isUserAttendee error: ${error.message}`);
        return false;
    }
}

module.exports = {
    addAttendee,
    getAttendeesBySession,
    getAttendeeCount,
    isUserAttendee
};