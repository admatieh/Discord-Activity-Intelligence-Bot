// models/voiceActivityModel.js
const db = require('../database/db');
const logger = require('../utils/logger');

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/**
 * Insert an interval start event. end_time starts as NULL.
 * @returns {number|null} The new row id, or null on failure.
 */
function createStart(sessionId, userId, startTime) {
    try {
        const result = db.prepare(
            `INSERT INTO voice_activity_intervals (session_id, user_id, start_time, end_time)
             VALUES (?, ?, ?, NULL)`
        ).run(sessionId, userId, startTime);

        return Number(result.lastInsertRowid);
    } catch (error) {
        logger.error(`voiceActivityModel.createStart error: ${error.message}`);
        return null;
    }
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * Get the most recent open (end_time IS NULL) interval for a user in a session.
 */
function getOpenInterval(sessionId, userId) {
    try {
        return db.prepare(
            `SELECT *
             FROM voice_activity_intervals
             WHERE session_id = ?
               AND user_id = ?
               AND end_time IS NULL
             ORDER BY start_time DESC
             LIMIT 1`
        ).get(sessionId, userId) || null;
    } catch (error) {
        logger.error(`voiceActivityModel.getOpenInterval error: ${error.message}`);
        return null;
    }
}

/**
 * Get all voice activity intervals for a session, ordered by start_time.
 */
function getIntervalsBySession(sessionId) {
    try {
        return db.prepare(
            `SELECT *
             FROM voice_activity_intervals
             WHERE session_id = ?
             ORDER BY start_time ASC`
        ).all(sessionId);
    } catch (error) {
        logger.error(`voiceActivityModel.getIntervalsBySession error: ${error.message}`);
        return [];
    }
}

/**
 * Get all voice activity intervals for a specific user in a session, ordered by start_time.
 */
function getIntervalsBySessionAndUser(sessionId, userId) {
    try {
        return db.prepare(
            `SELECT *
             FROM voice_activity_intervals
             WHERE session_id = ?
               AND user_id = ?
             ORDER BY start_time ASC`
        ).all(sessionId, userId);
    } catch (error) {
        logger.error(`voiceActivityModel.getIntervalsBySessionAndUser error: ${error.message}`);
        return [];
    }
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

/**
 * Close the most recent open interval for a specific user in a session.
 * @returns {boolean} true if a row was updated.
 */
function closeOpenInterval(sessionId, userId, endTime) {
    try {
        const result = db.prepare(
            `UPDATE voice_activity_intervals
             SET end_time = ?
             WHERE id = (
                SELECT id
                FROM voice_activity_intervals
                WHERE session_id = ?
                  AND user_id = ?
                  AND end_time IS NULL
                ORDER BY start_time DESC
                LIMIT 1
             )`
        ).run(endTime, sessionId, userId);

        return result.changes > 0;
    } catch (error) {
        logger.error(`voiceActivityModel.closeOpenInterval error: ${error.message}`);
        return false;
    }
}

/**
 * Close ALL open intervals for a session (used when a session ends).
 * @returns {number} Number of rows closed.
 */
function closeAllOpenIntervals(sessionId, endTime) {
    try {
        const result = db.prepare(
            `UPDATE voice_activity_intervals
             SET end_time = ?
             WHERE session_id = ?
               AND end_time IS NULL`
        ).run(endTime, sessionId);

        return result.changes;
    } catch (error) {
        logger.error(`voiceActivityModel.closeAllOpenIntervals error: ${error.message}`);
        return 0;
    }
}

module.exports = {
    createStart,
    getOpenInterval,
    getIntervalsBySession,
    getIntervalsBySessionAndUser,
    closeOpenInterval,
    closeAllOpenIntervals
};
