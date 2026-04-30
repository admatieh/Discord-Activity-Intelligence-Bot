// modules/activity/activityEventModel.js
//
// Generic activity events table for future extensibility.
// Stores typed events with optional metadata and session linkage.
// ---------------------------------------------------------------------------

const db = require('../../database/db');
const logger = require('../../utils/logger');

/**
 * Insert an activity event.
 * @param {{ type: string, userId: string, channelId: string, sessionId?: number, metadata?: object }} params
 * @returns {number|null} Row id or null on failure.
 */
function insertEvent({ type, userId, channelId, sessionId = null, metadata = null }) {
    try {
        const metaStr = metadata && typeof metadata === 'object'
            ? JSON.stringify(metadata)
            : metadata;

        const result = db.prepare(
            `INSERT INTO activity_events (type, user_id, channel_id, session_id, metadata)
             VALUES (?, ?, ?, ?, ?)`
        ).run(type, userId, channelId, sessionId || null, metaStr || null);

        return Number(result.lastInsertRowid);
    } catch (error) {
        logger.error(`activityEventModel.insertEvent error: ${error.message}`, { type, userId });
        return null;
    }
}

/**
 * Get events by type.
 */
function getEventsByType(type, limit = 100) {
    try {
        return db.prepare(
            `SELECT * FROM activity_events WHERE type = ? ORDER BY created_at DESC LIMIT ?`
        ).all(type, limit);
    } catch (error) {
        logger.error(`activityEventModel.getEventsByType error: ${error.message}`);
        return [];
    }
}

/**
 * Get events by session.
 */
function getEventsBySession(sessionId) {
    try {
        return db.prepare(
            `SELECT * FROM activity_events WHERE session_id = ? ORDER BY created_at ASC`
        ).all(sessionId);
    } catch (error) {
        logger.error(`activityEventModel.getEventsBySession error: ${error.message}`);
        return [];
    }
}

module.exports = { insertEvent, getEventsByType, getEventsBySession };
