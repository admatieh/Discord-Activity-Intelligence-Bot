// models/voiceEventModel.js
const db = require('../database/db');
const logger = require('../utils/logger');

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/**
 * Insert a join event row. leave_time starts as NULL.
 * @returns {number|null} The new row id, or null on failure.
 */
function createJoinEvent(sessionId, userId, joinTime) {
    try {
        const result = db.prepare(
            `INSERT INTO voice_events (session_id, user_id, join_time, leave_time)
             VALUES (?, ?, ?, NULL)`
        ).run(sessionId, userId, joinTime);

        return Number(result.lastInsertRowid);
    } catch (error) {
        logger.error(`voiceEventModel.createJoinEvent error: ${error.message}`);
        return null;
    }
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * Get the most recent open (leave_time IS NULL) event for a user in a session.
 */
function getOpenEvent(sessionId, userId) {
    try {
        return db.prepare(
            `SELECT *
             FROM voice_events
             WHERE session_id = ?
               AND user_id = ?
               AND leave_time IS NULL
             ORDER BY join_time DESC
             LIMIT 1`
        ).get(sessionId, userId) || null;
    } catch (error) {
        logger.error(`voiceEventModel.getOpenEvent error: ${error.message}`);
        return null;
    }
}

/**
 * Get all voice event rows for a session, ordered by join_time.
 */
function getEventsBySession(sessionId) {
    try {
        return db.prepare(
            `SELECT *
             FROM voice_events
             WHERE session_id = ?
             ORDER BY join_time ASC`
        ).all(sessionId);
    } catch (error) {
        logger.error(`voiceEventModel.getEventsBySession error: ${error.message}`);
        return [];
    }
}

/**
 * Get all voice event rows for a specific user in a session, ordered by join_time.
 */
function getEventsBySessionAndUser(sessionId, userId) {
    try {
        return db.prepare(
            `SELECT *
             FROM voice_events
             WHERE session_id = ?
               AND user_id = ?
             ORDER BY join_time ASC`
        ).all(sessionId, userId);
    } catch (error) {
        logger.error(`voiceEventModel.getEventsBySessionAndUser error: ${error.message}`);
        return [];
    }
}

/**
 * Get voice event count for a session.
 */
function getEventCountBySession(sessionId) {
    try {
        const row = db.prepare(
            'SELECT COUNT(*) as count FROM voice_events WHERE session_id = ?'
        ).get(sessionId);
        return row ? row.count : 0;
    } catch (error) {
        logger.error(`voiceEventModel.getEventCountBySession error: ${error.message}`);
        return 0;
    }
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

/**
 * Close the most recent open event for a specific user in a session.
 * @returns {boolean} true if a row was updated.
 */
function closeOpenEvent(sessionId, userId, leaveTime) {
    try {
        const result = db.prepare(
            `UPDATE voice_events
             SET leave_time = ?
             WHERE id = (
                SELECT id
                FROM voice_events
                WHERE session_id = ?
                  AND user_id = ?
                  AND leave_time IS NULL
                ORDER BY join_time DESC
                LIMIT 1
             )`
        ).run(leaveTime, sessionId, userId);

        return result.changes > 0;
    } catch (error) {
        logger.error(`voiceEventModel.closeOpenEvent error: ${error.message}`);
        return false;
    }
}

/**
 * Close ALL open voice events for a session (used when a session ends).
 * @returns {number} Number of rows closed.
 */
function closeAllOpenEvents(sessionId, leaveTime) {
    try {
        const result = db.prepare(
            `UPDATE voice_events
             SET leave_time = ?
             WHERE session_id = ?
               AND leave_time IS NULL`
        ).run(leaveTime, sessionId);

        return result.changes;
    } catch (error) {
        logger.error(`voiceEventModel.closeAllOpenEvents error: ${error.message}`);
        return 0;
    }
}

module.exports = {
    createJoinEvent,
    getOpenEvent,
    getEventsBySession,
    getEventsBySessionAndUser,
    getEventCountBySession,
    closeOpenEvent,
    closeAllOpenEvents
};